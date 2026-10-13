// Lives in test/, not api/: every file in api/ becomes a Vercel function.

import {
  AuthApiError,
  AuthRetryableFetchError,
  createClient,
} from '@supabase/supabase-js'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import handler, {
  ANTHROPIC_OPTIONS,
  REQUEST_BUDGET_MS,
  SUPABASE_TIMEOUT_MS,
  config,
} from '../api/extract.ts'
import {
  MAX_ATTEMPTS,
  extractHighlights,
  type ExtractResult,
} from '../server/extraction/extract.ts'

vi.mock('@supabase/supabase-js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@supabase/supabase-js')>()),
  createClient: vi.fn(),
}))
vi.mock('../server/extraction/extract.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../server/extraction/extract.ts')>()),
  extractHighlights: vi.fn(),
}))

const URL = 'https://reprise.test/api/extract'
const GOOD_TOKEN = 'good-token'
// JPEG SOI + APP0 marker; enough for the magic-byte check.
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]).toString(
  'base64',
)

const getUser = vi.fn()

function post(body: unknown, token: string | null = GOOD_TOKEN): Request {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token !== null) headers.Authorization = `Bearer ${token}`
  return new Request(URL, {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

const meta = {
  model: 'claude-sonnet-5-5',
  promptVersion: 'extract-v3',
  attempts: 1,
  raws: ['{"highlights":[]}'],
  usage: [],
}

beforeEach(() => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test')
  vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test')
  vi.spyOn(console, 'error').mockImplementation(() => {})
  getUser.mockImplementation(async (token: string) =>
    token === GOOD_TOKEN
      ? { data: { user: { id: 'user-1' } }, error: null }
      : {
          data: { user: null },
          error: new AuthApiError('invalid JWT', 403, 'bad_jwt'),
        },
  )
  vi.mocked(createClient).mockReturnValue({
    auth: { getUser },
  } as unknown as ReturnType<typeof createClient>)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetAllMocks()
})

async function errorKind(response: Response): Promise<string> {
  const body = (await response.json()) as { error: { kind: string } }
  return body.error.kind
}

describe('POST /api/extract', () => {
  it('returns 405 for GET', async () => {
    const response = await handler.fetch(new Request(URL))
    expect(response.status).toBe(405)
    expect(response.headers.get('Allow')).toBe('POST')
    expect(await errorKind(response)).toBe('method_not_allowed')
  })

  it('returns 401 without a token', async () => {
    const response = await handler.fetch(post({ image: JPEG }, null))
    expect(response.status).toBe(401)
    expect(getUser).not.toHaveBeenCalled()
    expect(extractHighlights).not.toHaveBeenCalled()
  })

  it('returns 401 with a bad token', async () => {
    const response = await handler.fetch(post({ image: JPEG }, 'bad-token'))
    expect(response.status).toBe(401)
    expect(getUser).toHaveBeenCalledWith('bad-token')
    expect(extractHighlights).not.toHaveBeenCalled()
  })

  it('returns 502, not 401, when Supabase auth is unreachable', async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: new AuthRetryableFetchError('fetch failed', 0),
    })
    const response = await handler.fetch(post({ image: JPEG }))
    expect(response.status).toBe(502)
    expect(await errorKind(response)).toBe('auth_unavailable')
    expect(extractHighlights).not.toHaveBeenCalled()
  })

  it('returns 502 auth_unavailable when Supabase takes longer than the timeout', async () => {
    // Real supabase-js client against a server that never answers.
    const { createClient: realCreateClient } = await vi.importActual<
      typeof import('@supabase/supabase-js')
    >('@supabase/supabase-js')
    vi.mocked(createClient).mockImplementation(realCreateClient)
    const server = http.createServer(() => {})
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const { port } = server.address() as AddressInfo
    vi.stubEnv('VITE_SUPABASE_URL', `http://127.0.0.1:${port}`)
    // Shrink the 10s timeout to 50ms so the test stays fast.
    const realTimeout = AbortSignal.timeout.bind(AbortSignal)
    const timeoutSpy = vi
      .spyOn(AbortSignal, 'timeout')
      .mockImplementation((ms) =>
        realTimeout(ms === SUPABASE_TIMEOUT_MS ? 50 : ms),
      )

    try {
      const response = await handler.fetch(post({ image: JPEG }))
      expect(response.status).toBe(502)
      expect(await errorKind(response)).toBe('auth_unavailable')
      expect(timeoutSpy).toHaveBeenCalledWith(SUPABASE_TIMEOUT_MS)
      expect(extractHighlights).not.toHaveBeenCalled()
    } finally {
      timeoutSpy.mockRestore()
      server.closeAllConnections()
      server.close()
    }
  })

  it.each([
    ['not JSON', 'nope'],
    ['missing image', {}],
    ['image not a string', { image: 42 }],
    ['data URL prefix', { image: `data:image/jpeg;base64,${JPEG}` }],
    ['empty image', { image: '' }],
  ])('returns 400 for a bad body (%s)', async (_, body) => {
    const response = await handler.fetch(post(body))
    expect(response.status).toBe(400)
    expect(await errorKind(response)).toBe('invalid_body')
    expect(extractHighlights).not.toHaveBeenCalled()
  })

  it('returns 400 when the image is not a JPEG', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]).toString(
      'base64',
    )
    const response = await handler.fetch(post({ image: png }))
    expect(response.status).toBe(400)
    expect(await errorKind(response)).toBe('not_jpeg')
  })

  it('returns 413 when the image decodes to more than 3 MB', async () => {
    const bytes = Buffer.alloc(3 * 1024 * 1024 + 1)
    bytes.set([0xff, 0xd8, 0xff, 0xe0])
    const response = await handler.fetch(
      post({ image: bytes.toString('base64') }),
    )
    expect(response.status).toBe(413)
    expect(extractHighlights).not.toHaveBeenCalled()
  })

  it('accepts an image of exactly 3 MB', async () => {
    const bytes = Buffer.alloc(3 * 1024 * 1024)
    bytes.set([0xff, 0xd8, 0xff, 0xe0])
    vi.mocked(extractHighlights).mockResolvedValue({
      ok: true,
      data: { highlights: [], warnings: [] },
      ...meta,
    })
    const response = await handler.fetch(
      post({ image: bytes.toString('base64') }),
    )
    expect(response.status).toBe(200)
  })

  it('returns 200 with the extraction on success', async () => {
    const result: ExtractResult = {
      ok: true,
      data: {
        highlights: [
          {
            position: 1,
            color: 'pink',
            text: 'born in Ajaccio,',
            codes: ['H'],
            symbols: [],
          },
        ],
        warnings: ['page is curved'],
      },
      ...meta,
      attempts: 2,
      raws: ['not json', '{"highlights":[...]}'],
    }
    vi.mocked(extractHighlights).mockResolvedValue(result)

    const response = await handler.fetch(post({ image: JPEG }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      highlights: result.data.highlights,
      warnings: ['page is curved'],
      raw: '{"highlights":[...]}',
      promptVersion: 'extract-v3',
      model: 'claude-sonnet-5-5',
    })
    expect(extractHighlights).toHaveBeenCalledWith(
      { imageBase64: JPEG, mediaType: 'image/jpeg' },
      expect.objectContaining(ANTHROPIC_OPTIONS),
    )
  })

  it('returns 502 when extraction fails', async () => {
    vi.mocked(extractHighlights).mockResolvedValue({
      ok: false,
      error: {
        kind: 'parse',
        parseError: { kind: 'no_json', message: 'No JSON object found' },
      },
      ...meta,
      attempts: 2,
    })

    const response = await handler.fetch(post({ image: JPEG }))

    expect(response.status).toBe(502)
    const body = (await response.json()) as {
      error: { kind: string; message: string }
    }
    expect(body.error.kind).toBe('parse')
    expect(body.error.message).toEqual(expect.any(String))
  })

  it('returns 500 on an unexpected error without logging the image or token', async () => {
    vi.mocked(extractHighlights).mockRejectedValue(new Error('boom'))

    const response = await handler.fetch(post({ image: JPEG }))

    expect(response.status).toBe(500)
    expect(await errorKind(response)).toBe('internal')
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls)
    expect(logged).not.toContain(JPEG)
    expect(logged).not.toContain(GOOD_TOKEN)
    expect(logged).not.toContain('sk-ant-test')
  })

  it('returns 500 when an env var is missing', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    const response = await handler.fetch(post({ image: JPEG }))
    expect(response.status).toBe(500)
    expect(getUser).not.toHaveBeenCalled()
  })

  it("keeps the base64 of the largest allowed image under Vercel's 4.5 MB body limit", () => {
    const body = JSON.stringify({
      image: 'A'.repeat((3 * 1024 * 1024 * 4) / 3),
    })
    expect(Buffer.byteLength(body)).toBeLessThan(4.5 * 1000 * 1000)
  })
})

describe('request time budget', () => {
  it('gives up before the budget, even with a parse retry and every try timing out', () => {
    const tries = MAX_ATTEMPTS * (1 + ANTHROPIC_OPTIONS.maxRetries)
    expect(tries * ANTHROPIC_OPTIONS.timeout).toBeLessThan(REQUEST_BUDGET_MS)
  })

  it('fits the auth timeout plus worst-case extraction inside maxDuration', () => {
    const extractionMs =
      MAX_ATTEMPTS *
      (1 + ANTHROPIC_OPTIONS.maxRetries) *
      ANTHROPIC_OPTIONS.timeout
    // 10s + 260s = 270s < 300s
    expect(SUPABASE_TIMEOUT_MS + extractionMs).toBeLessThanOrEqual(
      REQUEST_BUDGET_MS,
    )
    expect(REQUEST_BUDGET_MS).toBeLessThan(config.maxDuration * 1000)
  })
})
