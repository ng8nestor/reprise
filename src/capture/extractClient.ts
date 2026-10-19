// zod/mini: same checks, ~19 KB (gzip) less in the browser bundle than zod.
import * as z from 'zod/mini'
import { CODES, COLORS, SYMBOLS } from '../../shared/vocabulary.ts'
import type { ExtractFailure } from './extractError.ts'

// The success body of POST /api/extract (see api/extract.ts). Checked here
// too, so a server/browser mismatch fails loudly instead of rendering junk.
const ExtractedHighlightSchema = z.object({
  position: z.int().check(z.positive()),
  color: z.enum(COLORS),
  text: z.string(),
  codes: z.array(z.enum(CODES)),
  symbols: z.array(z.enum(SYMBOLS)),
})

const ExtractResponseSchema = z.object({
  highlights: z.array(ExtractedHighlightSchema),
  warnings: z.array(z.string()),
  // Kept for the save step (pages.raw_extraction, pages.prompt_version).
  raw: z.string(),
  promptVersion: z.string(),
  model: z.string(),
})

export type ExtractedHighlight = z.infer<typeof ExtractedHighlightSchema>
export type ExtractResponse = z.infer<typeof ExtractResponseSchema>

export type ExtractOutcome =
  { ok: true; data: ExtractResponse } | { ok: false; failure: ExtractFailure }

// Never throws. After an abort the outcome is meaningless; callers check
// signal.aborted before using it.
export async function requestExtraction(
  imageBase64: string,
  accessToken: string,
  signal: AbortSignal,
): Promise<ExtractOutcome> {
  let response: Response
  try {
    response = await fetch('/api/extract', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: imageBase64 }),
      signal,
    })
  } catch {
    return { ok: false, failure: { kind: 'network' } }
  }

  if (!response.ok) {
    return { ok: false, failure: { kind: 'http', status: response.status } }
  }

  let json: unknown
  try {
    json = await response.json()
  } catch {
    return { ok: false, failure: { kind: 'badResponse' } }
  }
  const parsed = ExtractResponseSchema.safeParse(json)
  return parsed.success
    ? { ok: true, data: parsed.data }
    : { ok: false, failure: { kind: 'badResponse' } }
}
