// Build-time Sentry settings. Kept out of vite.config.ts so the decision
// "may this build upload source maps, and so produce them?" can be tested.
//
// It reads process.env, never .env files, on purpose: a token left in .env
// can't make a local build upload anything. Only a real environment variable
// (Vercel's settings, or an explicit `SENTRY_AUTH_TOKEN=... npm run build`)
// turns uploads on.

import type { Plugin } from 'vite'

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

// Why this exists: the Sentry plugin adds a snippet to each chunk that
// records the chunk's debug ID, and Vite 8's minifier rewrites its string
// literals with backticks: _sentryDebugIds[t]=`<id>`. When the plugin hands
// the files to the Sentry CLI for upload, the CLI looks for that snippet
// with a pattern that only accepts "..." or '...'. It doesn't find it, so it
// prepends a snippet of its own to the uploaded copy and shifts the uploaded
// source map down one line to match. The file Vercel serves never gets that
// line, so every frame is looked up one line too high in the map, and Sentry
// shows the event minified even though the debug IDs match.
//
// Swapping the backticks around the debug ID for double quotes keeps every
// line and column where it was (same length, no newline), so the source map
// stays exact, and the CLI then recognizes the snippet and leaves the file
// and its map alone.
const BACKTICK_DEBUG_ID =
  /(_sentryDebugIds\s*\[\s*[$\w]+\s*\]\s*=\s*|_sentryDebugIdIdentifier\s*=\s*)`((?:sentry-dbid-)?[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})`/g

export function quoteDebugIds(code: string): string {
  return code.replace(BACKTICK_DEBUG_ID, '$1"$2"')
}

// Runs between the Sentry plugin's two generateBundle hooks: after its
// "pre" hook has written the final debug IDs, before its "post" hook copies
// each chunk and map aside for upload.
export function sentryDebugIdQuotesPlugin(): Plugin {
  return {
    name: 'reprise-sentry-debug-id-quotes',
    apply: 'build',
    generateBundle(_options, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type === 'chunk') output.code = quoteDebugIds(output.code)
      }
    },
  }
}
