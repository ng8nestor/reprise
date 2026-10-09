import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CODES, COLORS, SYMBOLS } from '../shared/vocabulary.ts'

// The database enforces the vocabulary with check constraints. This test
// keeps those lists and shared/vocabulary.ts from drifting apart.

const migrationsDir = new URL('../supabase/migrations/', import.meta.url)
const migrationFile = readdirSync(migrationsDir).find((name) =>
  name.endsWith('_init_schema.sql'),
)
if (!migrationFile) {
  throw new Error('No *_init_schema.sql migration in supabase/migrations')
}
const migrationSql = readFileSync(new URL(migrationFile, migrationsDir), 'utf8')

// Returns the quoted values inside the named check constraint, in order.
function allowedValues(constraintName: string): string[] {
  const match = new RegExp(
    `constraint\\s+${constraintName}\\s+check\\s*\\(([\\s\\S]*?)\\)\\s*,?\\n`,
  ).exec(migrationSql)
  if (!match?.[1]) {
    throw new Error(`Migration has no check constraint ${constraintName}`)
  }
  return [...match[1].matchAll(/'((?:[^']|'')*)'/g)].map((m) =>
    (m[1] ?? '').replaceAll("''", "'"),
  )
}

describe('migration vocabulary matches shared/vocabulary.ts', () => {
  it('colors', () => {
    expect(allowedValues('highlights_color_allowed')).toEqual([...COLORS])
  })

  it('codes', () => {
    expect(allowedValues('highlights_codes_allowed')).toEqual([...CODES])
  })

  it('symbols', () => {
    expect(allowedValues('highlights_symbols_allowed')).toEqual([...SYMBOLS])
  })
})
