import { describe, expect, it } from 'vitest'
import { readSupabaseConfig } from './env.ts'

const URL = 'https://example.supabase.co'
const KEY = 'sb_publishable_test'

describe('readSupabaseConfig', () => {
  it('returns trimmed values when both are set', () => {
    expect(
      readSupabaseConfig({
        VITE_SUPABASE_URL: ` ${URL} `,
        VITE_SUPABASE_PUBLISHABLE_KEY: `${KEY}\n`,
      }),
    ).toEqual({ url: URL, publishableKey: KEY })
  })

  it('names the missing URL', () => {
    expect(() =>
      readSupabaseConfig({
        VITE_SUPABASE_URL: undefined,
        VITE_SUPABASE_PUBLISHABLE_KEY: KEY,
      }),
    ).toThrow(/Missing env var VITE_SUPABASE_URL\./)
  })

  it('treats an empty value as missing', () => {
    expect(() =>
      readSupabaseConfig({
        VITE_SUPABASE_URL: URL,
        VITE_SUPABASE_PUBLISHABLE_KEY: '  ',
      }),
    ).toThrow(/Missing env var VITE_SUPABASE_PUBLISHABLE_KEY\./)
  })

  it('names both when both are missing', () => {
    expect(() =>
      readSupabaseConfig({
        VITE_SUPABASE_URL: undefined,
        VITE_SUPABASE_PUBLISHABLE_KEY: undefined,
      }),
    ).toThrow(/VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY/)
  })
})
