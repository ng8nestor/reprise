// Build-time Sentry settings. Kept out of vite.config.ts so the decision
// "may this build upload source maps, and so produce them?" can be tested.
//
// It reads process.env, never .env files, on purpose: a token left in .env
// can't make a local build upload anything. Only a real environment variable
// (Vercel's settings, or an explicit `SENTRY_AUTH_TOKEN=... npm run build`)
// turns uploads on.

export interface SentryBuildEnv {
  SENTRY_AUTH_TOKEN?: string | undefined
  SENTRY_ORG?: string | undefined
  SENTRY_PROJECT?: string | undefined
  VERCEL_GIT_COMMIT_SHA?: string | undefined
}

export type SentryBuildSettings =
  | { uploadSourceMaps: false; warning: string | null }
  | {
      uploadSourceMaps: true
      authToken: string
      org: string
      project: string
      // Undefined outside Vercel; the plugin then works one out itself.
      release: string | undefined
    }

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export function readSentryBuildSettings(
  env: SentryBuildEnv,
): SentryBuildSettings {
  const authToken = clean(env.SENTRY_AUTH_TOKEN)
  // No token is the normal case for CI and local builds: skip, quietly.
  if (!authToken) return { uploadSourceMaps: false, warning: null }

  const org = clean(env.SENTRY_ORG)
  const project = clean(env.SENTRY_PROJECT)
  if (!org || !project) {
    const missing = [!org && 'SENTRY_ORG', !project && 'SENTRY_PROJECT']
      .filter((name) => name !== false)
      .join(' and ')
    return {
      uploadSourceMaps: false,
      warning: `SENTRY_AUTH_TOKEN is set but ${missing} is missing, so source maps are not uploaded.`,
    }
  }

  return {
    uploadSourceMaps: true,
    authToken,
    org,
    project,
    release: clean(env.VERCEL_GIT_COMMIT_SHA),
  }
}
