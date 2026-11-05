// Reads the settings `npm run eval` needs from the environment (.env).

export interface EvalEnv {
  url: string
  publishableKey: string
  email: string
  password: string
}

type Env = Readonly<Record<string, string | undefined>>

// The legacy API keys are JWTs whose payload has a "role" claim.
function legacyJwtRole(key: string): string | null {
  const parts = key.split('.')
  if (parts.length !== 3) return null
  try {
    const payload: unknown = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf8'),
    )
    if (typeof payload === 'object' && payload !== null && 'role' in payload) {
      return typeof payload.role === 'string' ? payload.role : null
    }
  } catch {
    // Not a JWT we can read; treat it as an ordinary key.
  }
  return null
}

// True for the keys that bypass Row Level Security.
export function isServiceRoleKey(key: string): boolean {
  return key.startsWith('sb_secret_') || legacyJwtRole(key) === 'service_role'
}

// The eval signs in as me with the publishable key so RLS applies, exactly
// as in the app. It refuses a service-role key even if one is put in the
// publishable key's place. Error messages name variables, never values.
export function readEvalEnv(env: Env): EvalEnv {
  const url = env.VITE_SUPABASE_URL?.trim()
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  const email = env.EVAL_EMAIL?.trim()
  // The password is used as typed: spaces can be part of it.
  const password = env.EVAL_PASSWORD

  const missing = [
    !url && 'VITE_SUPABASE_URL',
    !publishableKey && 'VITE_SUPABASE_PUBLISHABLE_KEY',
    !email && 'EVAL_EMAIL',
    !password && 'EVAL_PASSWORD',
  ].filter((name) => name !== false)
  if (!url || !publishableKey || !email || !password) {
    throw new Error(
      `Missing env var ${missing.join(', ')}. Add ${missing.length === 1 ? 'it' : 'them'} to .env (names are listed in .env.example).`,
    )
  }

  if (isServiceRoleKey(publishableKey)) {
    throw new Error(
      'VITE_SUPABASE_PUBLISHABLE_KEY holds a service-role (secret) key. ' +
        'The eval must run with the publishable key so Row Level Security applies.',
    )
  }

  return { url, publishableKey, email, password }
}
