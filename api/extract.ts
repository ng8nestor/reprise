// POST /api/extract: a logged-in user sends one page photo (base64 JPEG),
// gets back the extracted highlights. The Anthropic key lives only here, on
// the server; auth stops strangers from spending it.

import Anthropic from '@anthropic-ai/sdk'
import { createClient, isAuthRetryableFetchError } from '@supabase/supabase-js'
import { z } from 'zod'
import { extractHighlights } from '../server/extraction/extract.ts'

// Hobby plan maximum (and default) with Fluid compute.
export const config = { maxDuration: 300 }

// Worst-case time for one request's slow steps: auth (SUPABASE_TIMEOUT_MS,
// 10s) + extraction (260s, below) = 270s. Both give up before Vercel's
// maxDuration (300s), so the browser gets our 502 (JSON) instead of Vercel's
// 504; the last 30s cover reading the body and sending the reply.
export const REQUEST_BUDGET_MS = 270_000

// supabase-js sets no timeout of its own. An aborted fetch comes back from
// getUser as AuthRetryableFetchError, which we answer with auth_unavailable.
export const SUPABASE_TIMEOUT_MS = 10_000

const fetchWithTimeout: typeof fetch = (input, init) => {
  const timeout = AbortSignal.timeout(SUPABASE_TIMEOUT_MS)
  const signal = init?.signal
    ? AbortSignal.any([init.signal, timeout])
    : timeout
  return fetch(input, { ...init, signal })
}

// Worst case = MAX_ATTEMPTS (2: first try + parse retry) x one HTTP try each
// x timeout = 2 x 130s = 260s. A normal page replies in 15-40s.
// maxRetries is 0 because the SDK sleeps for whatever retry-after says, with
// no cap, so any SDK retry makes the worst case unbounded. On a 429/529 the
// browser retries instead, and that request gets a fresh 300s.
export const ANTHROPIC_OPTIONS = { timeout: 130_000, maxRetries: 0 }

// 3 MB of JPEG is 4 MB of base64 (x 4/3), under Vercel's 4.5 MB body limit,
// so photos just over the limit get our JSON 413. Past ~3.3 MB the body
// itself is too big and Vercel answers first; the browser should shrink
// photos before upload.
const MAX_IMAGE_BYTES = 3 * 1024 * 1024

const BodySchema = z.object({
  // Plain base64, no "data:image/jpeg;base64," prefix.
  image: z.base64().min(1),
})

type ErrorKind =
  | 'method_not_allowed'
  | 'unauthorized'
  | 'auth_unavailable'
  | 'invalid_body'
  | 'not_jpeg'
  | 'too_large'
  | 'parse'
  | 'refusal'
  | 'truncated'
  | 'api'
  | 'internal'

function errorResponse(
  status: number,
  kind: ErrorKind,
  message: string,
  headers?: Record<string, string>,
): Response {
  return Response.json({ error: { kind, message } }, { status, headers })
}

// Decoded size from the base64 length, without decoding the whole image.
function decodedBytes(base64: string): number {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return (base64.length / 4) * 3 - padding
}

// Every JPEG starts with the SOI marker FF D8 followed by another marker (FF).
function isJpeg(base64: string): boolean {
  const head = Buffer.from(base64.slice(0, 8), 'base64')
  return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization')
  const match = header ? /^Bearer\s+(\S+)$/i.exec(header) : null
  return match ? match[1] : null
}

// Same names as the browser uses; on Vercel every project env var is also
// available to functions at runtime.
function readEnv(): { supabaseUrl: string; supabaseKey: string } | null {
  const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim()
  const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (supabaseUrl && supabaseKey && anthropicKey) {
    return { supabaseUrl, supabaseKey }
  }
  const missing = [
    !supabaseUrl && 'VITE_SUPABASE_URL',
    !supabaseKey && 'VITE_SUPABASE_PUBLISHABLE_KEY',
    !anthropicKey && 'ANTHROPIC_API_KEY',
  ].filter((name) => name !== false)
  // Names only, never values.
  console.error(`[extract] missing env var ${missing.join(', ')}`)
  return null
}

async function handle(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return errorResponse(405, 'method_not_allowed', 'Use POST.', {
      Allow: 'POST',
    })
  }

  const env = readEnv()
  if (!env) {
    return errorResponse(500, 'internal', 'Server is misconfigured.')
  }

  // Auth before reading the body, so strangers cost nothing but this check.
  const token = bearerToken(request)
  if (!token) {
    return errorResponse(401, 'unauthorized', 'Missing bearer token.')
  }
  const supabase = createClient(env.supabaseUrl, env.supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { fetch: fetchWithTimeout },
  })
  const { data, error: authError } = await supabase.auth.getUser(token)
  if (authError && isAuthRetryableFetchError(authError)) {
    // Supabase unreachable, slower than SUPABASE_TIMEOUT_MS, or 5xx: the
    // token may be fine, so don't send the browser a 401 that reads as
    // "you're logged out".
    console.error(`[extract] auth check failed: ${authError.message}`)
    return errorResponse(
      502,
      'auth_unavailable',
      'Could not verify your session. Try again.',
    )
  }
  if (authError || !data.user) {
    return errorResponse(401, 'unauthorized', 'Invalid or expired token.')
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return errorResponse(400, 'invalid_body', 'Body must be JSON.')
  }
  const body = BodySchema.safeParse(json)
  if (!body.success) {
    return errorResponse(
      400,
      'invalid_body',
      'Body must be { "image": "<base64 JPEG>" }.',
    )
  }
  const { image } = body.data
  if (decodedBytes(image) > MAX_IMAGE_BYTES) {
    return errorResponse(413, 'too_large', 'Image is larger than 3 MB.')
  }
  if (!isJpeg(image)) {
    return errorResponse(400, 'not_jpeg', 'Image must be a JPEG.')
  }

  const result = await extractHighlights(
    { imageBase64: image, mediaType: 'image/jpeg' },
    new Anthropic(ANTHROPIC_OPTIONS),
  )
  if (!result.ok) {
    const { error } = result
    // Kind and short details only: no image, no raw replies, no key.
    const detail =
      error.kind === 'parse'
        ? `${error.parseError.kind}: ${error.parseError.message}`
        : error.kind === 'refusal'
          ? (error.explanation ?? '')
          : error.kind === 'truncated'
            ? error.stopReason
            : `${error.status ?? 'no status'}: ${error.message}`
    console.error(
      `[extract] ${error.kind} after ${result.attempts} attempt(s): ${detail}`,
    )
    const message =
      error.kind === 'parse'
        ? "The model's reply could not be read, even after a retry."
        : error.kind === 'refusal'
          ? 'The model declined to read this page.'
          : error.kind === 'truncated'
            ? "The model's reply was cut off."
            : 'The extraction service is unavailable. Try again.'
    return errorResponse(502, error.kind, message)
  }

  return Response.json({
    highlights: result.data.highlights,
    warnings: result.data.warnings,
    raw: result.raws[result.raws.length - 1],
    promptVersion: result.promptVersion,
    model: result.model,
  })
}

export default {
  async fetch(request: Request): Promise<Response> {
    try {
      return await handle(request)
    } catch (err) {
      // Message and stack only; the request (token, image) is never logged.
      console.error(
        '[extract] unexpected error:',
        err instanceof Error ? (err.stack ?? err.message) : typeof err,
      )
      return errorResponse(500, 'internal', 'Something went wrong.')
    }
  },
}
