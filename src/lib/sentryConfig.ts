export type SentryEnvironment = 'production' | 'preview' | 'development'

export interface SentryConfig {
  dsn: string
  environment: SentryEnvironment
}

interface SentryConfigInput {
  // VITE_SENTRY_DSN. Missing in local dev and CI, which keeps Sentry off.
  dsn: string | undefined
  // Vercel's VERCEL_ENV as seen by the build (see `define` in vite.config.ts).
  vercelEnv: string | null | undefined
}

// Anything that is not clearly a Vercel production or preview build counts as
// development, so a local build can never pollute the production dashboard.
export function resolveEnvironment(
  vercelEnv: string | null | undefined,
): SentryEnvironment {
  if (vercelEnv === 'production' || vercelEnv === 'preview') return vercelEnv
  return 'development'
}

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value)
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

// Returns null (Sentry stays off) when there is no usable DSN. A missing DSN
// is normal, so this never throws or logs.
export function readSentryConfig(
  input: SentryConfigInput,
): SentryConfig | null {
  const dsn = input.dsn?.trim()
  if (!dsn || !isHttpUrl(dsn)) return null
  return { dsn, environment: resolveEnvironment(input.vercelEnv) }
}
