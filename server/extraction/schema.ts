import { z } from 'zod'
import { CODES, COLORS, SYMBOLS } from '../../shared/vocabulary.ts'

export const HighlightSchema = z.object({
  position: z.number().int().positive(),
  color: z.enum(COLORS),
  text: z.string().trim().min(1),
  // Missing lists are treated as empty rather than costing a retry.
  codes: z.array(z.enum(CODES)).default([]),
  symbols: z.array(z.enum(SYMBOLS)).default([]),
})

export const ExtractionSchema = z.object({
  highlights: z.array(HighlightSchema),
  warnings: z.array(z.string()).default([]),
})

export type Highlight = z.infer<typeof HighlightSchema>
export type Extraction = z.infer<typeof ExtractionSchema>
