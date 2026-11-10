import type { Breadcrumb, ErrorEvent } from '@sentry/react'
import { describe, expect, it } from 'vitest'
import { scrubBreadcrumb, scrubEvent, stripUrlDetails } from './sentryScrub.ts'

const USER_ID = '8d1f7c1e-0000-4000-8000-000000000001'

// Stand-ins for the things that must never leave the browser.
const EMAIL = 'me@example.com'
const HIGHLIGHT = 'The nature of war is uncertainty and friction.'

function baseEvent(overrides: Partial<ErrorEvent> = {}): ErrorEvent {
  return { type: undefined, ...overrides }
}

describe('stripUrlDetails', () => {
  it('removes the query string', () => {
    expect(
      stripUrlDetails(
        'https://x.supabase.co/rest/v1/highlights?text=ilike.*war*&color=eq.pink',
      ),
    ).toBe('https://x.supabase.co/rest/v1/highlights')
  })

  it('removes the fragment, where auth tokens can appear', () => {
    expect(
      stripUrlDetails('https://reprise.app/#access_token=secret&type=signup'),
    ).toBe('https://reprise.app/')
  })

  it('removes both, and handles relative URLs', () => {
    expect(stripUrlDetails('/api/extract?x=1#y')).toBe('/api/extract')
  })

  it('leaves a URL with neither alone', () => {
    expect(stripUrlDetails('https://reprise.app/')).toBe('https://reprise.app/')
  })
})

describe('scrubBreadcrumb', () => {
  it('drops console breadcrumbs', () => {
    expect(
      scrubBreadcrumb({ category: 'console', message: HIGHLIGHT }),
    ).toBeNull()
  })

  it('drops click and input breadcrumbs', () => {
    for (const category of ['ui.click', 'ui.input', 'ui.keypress']) {
      expect(scrubBreadcrumb({ category, message: HIGHLIGHT })).toBeNull()
    }
  })

  it('strips the query string from a fetch breadcrumb and keeps the rest', () => {
    const crumb: Breadcrumb = {
      category: 'fetch',
      type: 'http',
      data: {
        method: 'GET',
        url: `https://x.supabase.co/rest/v1/highlights?text=ilike.*${HIGHLIGHT}*`,
        status_code: 200,
      },
    }
    expect(scrubBreadcrumb(crumb)).toEqual({
      category: 'fetch',
      type: 'http',
      data: {
        method: 'GET',
        url: 'https://x.supabase.co/rest/v1/highlights',
        status_code: 200,
      },
    })
  })

  it('strips from and to on navigation breadcrumbs', () => {
    const result = scrubBreadcrumb({
      category: 'navigation',
      data: { from: '/?a=1', to: '/#sentry-test' },
    })
    expect(result?.data).toEqual({ from: '/', to: '/' })
  })

  it('passes a breadcrumb without data through', () => {
    const crumb: Breadcrumb = { category: 'sentry.event', message: 'sent' }
    expect(scrubBreadcrumb(crumb)).toEqual(crumb)
  })

  it('does not change the breadcrumb it was given', () => {
    const data = { url: '/a?b=1' }
    scrubBreadcrumb({ category: 'fetch', data })
    expect(data.url).toBe('/a?b=1')
  })
})

describe('scrubEvent', () => {
  it('keeps only the user id', () => {
    const result = scrubEvent(
      baseEvent({
        user: {
          id: USER_ID,
          email: EMAIL,
          username: 'me',
          ip_address: '203.0.113.7',
        },
      }),
    )
    expect(result.user).toEqual({ id: USER_ID })
  })

  it('removes a user that has no id', () => {
    const result = scrubEvent(
      baseEvent({ user: { email: EMAIL, ip_address: '{{auto}}' } }),
    )
    expect(result.user).toBeUndefined()
    expect('user' in result).toBe(false)
  })

  it('strips query and fragment from the request URL', () => {
    const result = scrubEvent(
      baseEvent({
        request: { url: 'https://reprise.app/?q=war#access_token=secret' },
      }),
    )
    expect(result.request?.url).toBe('https://reprise.app/')
  })

  it('drops request bodies, cookies, query strings and env', () => {
    const result = scrubEvent(
      baseEvent({
        request: {
          url: 'https://reprise.app/',
          method: 'POST',
          data: { text: HIGHLIGHT, photo: 'data:image/jpeg;base64,AAAA' },
          cookies: { session: 'secret' },
          query_string: `text=${HIGHLIGHT}`,
          env: { REMOTE_ADDR: '203.0.113.7' },
        },
      }),
    )
    expect(result.request).toEqual({
      url: 'https://reprise.app/',
      method: 'POST',
    })
  })

  it('keeps the User-Agent header and no other header', () => {
    const result = scrubEvent(
      baseEvent({
        request: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone)',
            Referer: `https://reprise.app/?q=${HIGHLIGHT}`,
            Cookie: 'sb=secret',
            Authorization: 'Bearer secret',
          },
        },
      }),
    )
    expect(result.request?.headers).toEqual({
      'User-Agent': 'Mozilla/5.0 (iPhone)',
    })
  })

  it('drops extra, where a thrown object’s field values end up', () => {
    const result = scrubEvent(
      baseEvent({
        extra: {
          __serialized__: { details: `Failing row contains (${HIGHLIGHT})` },
        },
      }),
    )
    expect(result.extra).toBeUndefined()
  })

  it('keeps browser facts and drops other contexts', () => {
    const result = scrubEvent(
      baseEvent({
        contexts: {
          browser: { name: 'Safari', version: '19.0' },
          os: { name: 'iOS' },
          device: { family: 'iPhone' },
          app: { note: HIGHLIGHT },
          custom: { email: EMAIL },
        },
      }),
    )
    expect(Object.keys(result.contexts ?? {}).sort()).toEqual([
      'browser',
      'device',
      'os',
    ])
  })

  it('scrubs breadcrumbs already attached to the event', () => {
    const result = scrubEvent(
      baseEvent({
        breadcrumbs: [
          { category: 'console', message: HIGHLIGHT },
          { category: 'fetch', data: { url: '/rest/v1/books?title=eq.War' } },
        ],
      }),
    )
    expect(result.breadcrumbs).toEqual([
      { category: 'fetch', data: { url: '/rest/v1/books' } },
    ])
  })

  it('keeps what is needed to debug: message, stack, release, environment', () => {
    const event = baseEvent({
      message: 'Something broke',
      release: 'abc123',
      environment: 'production',
      exception: {
        values: [
          {
            type: 'Error',
            value: 'Canvas 2D is unavailable',
            stacktrace: {
              frames: [{ filename: '/assets/index-1.js', lineno: 1, colno: 9 }],
            },
          },
        ],
      },
      tags: { handled: 'no' },
    })
    expect(scrubEvent(event)).toEqual(event)
  })

  it('leaves no private value anywhere in a fully loaded event', () => {
    const loaded = baseEvent({
      user: { id: USER_ID, email: EMAIL, ip_address: '203.0.113.7' },
      request: {
        url: `https://reprise.app/?q=${HIGHLIGHT}#token=${EMAIL}`,
        data: HIGHLIGHT,
        cookies: { a: EMAIL },
        query_string: HIGHLIGHT,
        headers: { Referer: HIGHLIGHT, 'User-Agent': 'Mozilla/5.0' },
      },
      extra: { highlight: HIGHLIGHT, email: EMAIL },
      contexts: { custom: { text: HIGHLIGHT } },
      breadcrumbs: [
        { category: 'console', message: HIGHLIGHT },
        { category: 'ui.click', message: `button ${HIGHLIGHT}` },
        {
          category: 'fetch',
          data: { url: `/rest/v1/highlights?text=ilike.${HIGHLIGHT}` },
        },
      ],
      server_name: EMAIL,
    })
    const serialized = JSON.stringify(scrubEvent(loaded))
    expect(serialized).not.toContain(EMAIL)
    expect(serialized).not.toContain('nature of war')
    expect(serialized).not.toContain('203.0.113.7')
    expect(serialized).toContain(USER_ID)
  })

  it('does not change the event it was given', () => {
    const event = baseEvent({
      user: { id: USER_ID, email: EMAIL },
      extra: { a: 1 },
      request: { url: '/?q=1', data: 'x' },
    })
    const snapshot = structuredClone(event)
    scrubEvent(event)
    expect(event).toEqual(snapshot)
  })
})
