import * as Sentry from '@sentry/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { syncSentryUser } from './lib/sentryUser.ts'

// Runs the real instrument.ts against a fake network and reads what Sentry
// would have sent. This is the check that the SDK options still do what the
// comments say: SDK v11 silently dropped `sendDefaultPii`, so a config that
// looked right was not. Re-run after any @sentry/* upgrade.

const DSN = 'https://abc123@o1.ingest.sentry.io/42'
const USER_ID = '8d1f7c1e-0000-4000-8000-000000000001'
const EMAIL = 'me@example.com'
const HIGHLIGHT = 'The nature of war is uncertainty and friction.'

interface SentEvent {
  environment?: string
  user?: Record<string, unknown>
  request?: Record<string, unknown>
  extra?: unknown
  breadcrumbs?: unknown[]
}

function sentEvents(fetchMock: ReturnType<typeof vi.fn>): SentEvent[] {
  const events: SentEvent[] = []
  for (const [, init] of fetchMock.mock.calls) {
    const body = (init as { body?: unknown } | undefined)?.body
    if (typeof body !== 'string') continue
    // An envelope is newline-separated JSON: header, item header, item.
    const lines = body.split('\n')
    for (let i = 0; i + 1 < lines.length; i++) {
      if (lines[i]?.includes('"type":"event"')) {
        events.push(JSON.parse(lines[i + 1] ?? '{}') as SentEvent)
      }
    }
  }
  return events
}

// One mock for the whole file: the SDK caches the first fetch it sees, so a
// fresh mock per test would never be called after the first one.
const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))

afterEach(async () => {
  await Sentry.close(0)
  fetchMock.mockClear()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('instrument.ts', () => {
  it('stays off, with no network traffic, when there is no DSN', async () => {
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('VITE_SENTRY_DSN', '')
    vi.stubGlobal('__VERCEL_ENV__', 'production')

    await import('./instrument.ts')
    Sentry.captureException(new Error('boom'))
    await Sentry.flush(500)

    expect(Sentry.getClient()).toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends the error, the environment and the user id, and nothing private', async () => {
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('VITE_SENTRY_DSN', DSN)
    vi.stubGlobal('__VERCEL_ENV__', 'preview')

    await import('./instrument.ts')
    expect(Sentry.getClient()).toBeDefined()

    // Everything an app (or a library) might attach by mistake.
    Sentry.setUser({ id: USER_ID, email: EMAIL, ip_address: '{{auto}}' })
    Sentry.addBreadcrumb({ category: 'console', message: HIGHLIGHT })
    Sentry.addBreadcrumb({
      category: 'fetch',
      data: { url: `https://x.supabase.co/rest/v1/highlights?q=${HIGHLIGHT}` },
    })
    Sentry.captureException(new Error('boom'), {
      extra: { highlight: HIGHLIGHT },
      contexts: { custom: { email: EMAIL } },
    })
    await Sentry.flush(2000)

    const [event] = sentEvents(fetchMock)
    expect(event).toBeDefined()
    expect(event?.environment).toBe('preview')
    expect(event?.user).toEqual({ id: USER_ID })

    const serialized = JSON.stringify(event)
    expect(serialized).not.toContain(EMAIL)
    expect(serialized).not.toContain('nature of war')
    expect(serialized).not.toContain('{{auto}}')
    expect(event?.extra).toBeUndefined()
  })

  it('attaches the user id set at sign-in to every event, through the scrub', async () => {
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('VITE_SENTRY_DSN', DSN)
    vi.stubGlobal('__VERCEL_ENV__', 'production')

    await import('./instrument.ts')
    // What useAuth does when a session arrives (a full Session has more).
    syncSentryUser({ user: { id: USER_ID } })
    Sentry.captureException(new Error('first render'))
    Sentry.captureMessage('later', 'error')
    await Sentry.flush(2000)

    const events = sentEvents(fetchMock)
    expect(events).toHaveLength(2)
    for (const event of events) expect(event.user).toEqual({ id: USER_ID })
    syncSentryUser(null)
  })
})
