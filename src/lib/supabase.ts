import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../shared/database.types.ts'
import { readSupabaseConfig } from './env.ts'

// Throws on import when an env var is missing, so the app fails at startup
// instead of on the first auth call.
const { url, publishableKey } = readSupabaseConfig(import.meta.env)

// The one Supabase client for the browser. The publishable key is meant to
// be public; RLS is what protects the data.
export const supabase = createClient<Database>(url, publishableKey)
