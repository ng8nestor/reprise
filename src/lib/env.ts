type SupabaseEnv = Pick<
  ImportMetaEnv,
  'VITE_SUPABASE_URL' | 'VITE_SUPABASE_PUBLISHABLE_KEY'
>

export interface SupabaseConfig {
  url: string
  publishableKey: string
}

// Kept apart from supabase.ts so it can be tested without creating a client.
export function readSupabaseConfig(env: SupabaseEnv): SupabaseConfig {
  const url = env.VITE_SUPABASE_URL?.trim()
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

  if (!url || !publishableKey) {
    const missing = [
      !url && 'VITE_SUPABASE_URL',
      !publishableKey && 'VITE_SUPABASE_PUBLISHABLE_KEY',
    ].filter((name) => name !== false)
    throw new Error(
      `Missing env var ${missing.join(' and ')}. ` +
        'Add it to .env (names are listed in .env.example) and restart the dev server. ' +
        "For a deployed build, set it in the host's environment variables and rebuild.",
    )
  }

  return { url, publishableKey }
}
