import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../shared/database.types.ts'
import { readSupabaseConfig } from './env.ts'

// Throws on import when an env var is missing, so the app fails at startup
// instead of on the first auth call.
//
// Each variable is named on its own on purpose. Passing `import.meta.env`
// itself makes Vite inline the whole env object, so every VITE_* variable in
// the build environment ships to the browser, including the ones Vercel adds
// (VITE_VERCEL_GIT_COMMIT_MESSAGE and friends). vite.bundle-check.ts fails
// the build if that happens again.
const { url, publishableKey } = readSupabaseConfig({
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
})

// The one Supabase client for the browser. The publishable key is meant to
// be public; RLS is what protects the data.
export const supabase = createClient<Database>(url, publishableKey)
