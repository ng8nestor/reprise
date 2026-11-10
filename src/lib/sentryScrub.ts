import type { Breadcrumb, Contexts, ErrorEvent, User } from '@sentry/react'

// Everything here is pure so it can be tested without Sentry running.
//
// The rule: an event may carry what happened (error type, message, stack,
// browser) and which user id it happened to. It never carries what the app
// was showing or sending: no email, no highlight or book text, no photos, no
// request bodies, no query strings (filters and search text live there), no
// URL fragments (auth tokens can live there).

// Browser, device and trace facts only. Anything else a context might carry
// (custom contexts, app state) is dropped.
const ALLOWED_CONTEXTS = [
  'browser',
  'os',
  'device',
  'runtime',
  'trace',
  'react',
]

// Breadcrumb categories that record what the user typed, clicked, or logged.
function isContentBreadcrumb(category: string | undefined): boolean {
  return (
    category === 'console' ||
    category === 'ui.click' ||
    category === 'ui.input' ||
    category === 'ui.keypress'
  )
}

// "https://x.supabase.co/rest/v1/highlights?text=ilike.*foo*#a" ->
// "https://x.supabase.co/rest/v1/highlights". Works on relative URLs too.
export function stripUrlDetails(url: string): string {
  return url.split(/[?#]/, 1)[0] ?? ''
}

function scrubUser(user: User | undefined): User | undefined {
  const id = user?.id
  if (typeof id === 'string' || typeof id === 'number') return { id }
  return undefined
}

function scrubContexts(contexts: Contexts | undefined): Contexts | undefined {
  if (!contexts) return undefined
  const kept: Contexts = {}
  for (const name of ALLOWED_CONTEXTS) {
    const context = contexts[name]
    if (context) kept[name] = context
  }
  return kept
}

function scrubRequest(
  request: ErrorEvent['request'],
): ErrorEvent['request'] | undefined {
  if (!request) return undefined
  const scrubbed: NonNullable<ErrorEvent['request']> = {}
  if (request.url) scrubbed.url = stripUrlDetails(request.url)
  if (request.method) scrubbed.method = request.method
  // The browser name and version also come from the User-Agent header, and
  // that is the only header worth keeping. Referer, Cookie and the rest go.
  const userAgent = request.headers?.['User-Agent']
  if (userAgent) scrubbed.headers = { 'User-Agent': userAgent }
  return scrubbed
}

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (isContentBreadcrumb(breadcrumb.category)) return null

  const { data } = breadcrumb
  if (!data) return breadcrumb

  // Fetch and XHR breadcrumbs use `url`; navigation breadcrumbs use from/to.
  const scrubbedData: Record<string, unknown> = { ...data }
  for (const key of ['url', 'from', 'to']) {
    const value = scrubbedData[key]
    if (typeof value === 'string') scrubbedData[key] = stripUrlDetails(value)
  }
  return { ...breadcrumb, data: scrubbedData }
}

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  const scrubbed: ErrorEvent = { ...event }

  const user = scrubUser(event.user)
  if (user) scrubbed.user = user
  else delete scrubbed.user

  const request = scrubRequest(event.request)
  if (request) scrubbed.request = request
  else delete scrubbed.request

  const contexts = scrubContexts(event.contexts)
  if (contexts) scrubbed.contexts = contexts
  else delete scrubbed.contexts

  if (event.breadcrumbs) {
    scrubbed.breadcrumbs = event.breadcrumbs
      .map(scrubBreadcrumb)
      .filter((crumb): crumb is Breadcrumb => crumb !== null)
  }

  // `extra` is where Sentry puts the field values of a thrown non-Error object
  // (e.g. a database error whose `details` quotes the failing row).
  delete scrubbed.extra
  delete scrubbed.server_name

  return scrubbed
}
