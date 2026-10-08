import { z } from 'zod'
import { ExtractionSchema, type Extraction } from './schema.ts'

export type ParseError =
  | { kind: 'no_json'; message: string }
  | { kind: 'invalid_json'; message: string }
  | { kind: 'schema'; message: string; issues: z.core.$ZodIssue[] }

export type ParseResult =
  { ok: true; data: Extraction } | { ok: false; error: ParseError }

const FENCE = /```(?:json)?\s*([\s\S]*?)```/i

// Pulls the JSON object out of the model's reply: prefers a ``` fenced block,
// otherwise takes everything from the first "{" to the last "}".
function findJson(raw: string): string | null {
  const fenced = FENCE.exec(raw)
  const candidate = fenced ? fenced[1] : raw
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end < start) return null
  return candidate.slice(start, end + 1)
}

export function parseExtraction(raw: string): ParseResult {
  const json = findJson(raw)
  if (json === null) {
    return {
      ok: false,
      error: { kind: 'no_json', message: 'No JSON object found in reply' },
    }
  }

  let value: unknown
  try {
    value = JSON.parse(json)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: { kind: 'invalid_json', message } }
  }

  const result = ExtractionSchema.safeParse(value)
  if (!result.success) {
    return {
      ok: false,
      error: {
        kind: 'schema',
        message: z.prettifyError(result.error),
        issues: result.error.issues,
      },
    }
  }
  return { ok: true, data: result.data }
}
