// Fails the build when a served file (JS, CSS, HTML) contains something that
// must never reach the browser. It runs in generateBundle, before anything is
// written to dist/ or uploaded to Sentry, so a leaking build deploys nothing.
//
// Unlike a failed source map upload (a warning, see vite.config.ts), a leak
// stops the deploy: a minified stack trace is an inconvenience, a published
// token is an incident.
//
// Messages name the environment variable, never its value, so the build log
// doesn't repeat the leak.

import type { Plugin } from 'vite'

// Prefixes of secret keys that have no business in browser code under any
// name: Sentry auth tokens and Anthropic API keys.
const FORBIDDEN_MARKERS = ['sntrys_', 'sk-ant']

// The only variables whose values the browser is meant to see. The Supabase
// publishable key and the DSN are public by design; the commit SHA is the
// Sentry release name the Sentry plugin injects; VERCEL_ENV is baked in
// through `define`.
const PUBLIC_ENV_NAMES = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'VITE_SENTRY_DSN',
  'VERCEL_ENV',
  'VERCEL_GIT_COMMIT_SHA',
]

// Shorter values ("production", "1", a user name) appear in ordinary code by
// coincidence, so only values at least this long are looked for.
const MIN_ENV_VALUE_LENGTH = 20

// A commit message line this long or longer is specific enough to look for.
// Lines are checked one by one because the minifier may escape the message
// as a whole (quotes, backticks) but leaves plain lines as they are.
const MIN_COMMIT_LINE_LENGTH = 12

const COMMIT_MESSAGE_NAMES = [
  'VERCEL_GIT_COMMIT_MESSAGE',
  'VITE_VERCEL_GIT_COMMIT_MESSAGE',
]

export type BuildEnv = Readonly<Record<string, string | undefined>>

export interface BundleLeak {
  file: string
  reason: string
}

function commitMessageLines(env: BuildEnv): string[] {
  const lines = new Set<string>()
  for (const name of COMMIT_MESSAGE_NAMES) {
    for (const line of env[name]?.split(/\r?\n/) ?? []) {
      const trimmed = line.trim()
      if (trimmed.length >= MIN_COMMIT_LINE_LENGTH) lines.add(trimmed)
    }
  }
  return [...lines]
}

// Values of every variable that is not public, keyed by value so each is
// reported once (Vercel sets the same value under several names).
function privateEnvValues(env: BuildEnv): Map<string, string> {
  const publicValues = new Set(
    PUBLIC_ENV_NAMES.map((name) => env[name]?.trim()).filter(Boolean),
  )
  const values = new Map<string, string>()
  for (const [name, raw] of Object.entries(env)) {
    const value = raw?.trim()
    if (!value || value.length < MIN_ENV_VALUE_LENGTH) continue
    if (publicValues.has(value) || values.has(value)) continue
    values.set(value, name)
  }
  return values
}

export function findBundleLeaks(
  files: ReadonlyArray<{ file: string; content: string }>,
  env: BuildEnv,
): BundleLeak[] {
  const leaks: BundleLeak[] = []
  const messageLines = commitMessageLines(env)
  const envValues = privateEnvValues(env)

  for (const { file, content } of files) {
    for (const marker of FORBIDDEN_MARKERS) {
      if (content.includes(marker)) {
        leaks.push({ file, reason: `contains "${marker}" (a secret key)` })
      }
    }
    if (messageLines.some((line) => content.includes(line))) {
      leaks.push({ file, reason: 'contains the git commit message' })
    }
    for (const [value, name] of envValues) {
      if (content.includes(value)) {
        leaks.push({ file, reason: `contains the value of ${name}` })
      }
    }
  }
  return leaks
}

function isServedFile(fileName: string): boolean {
  return /\.(?:[cm]?js|css|html)$/.test(fileName)
}

export function bundleCheckPlugin(env: BuildEnv): Plugin {
  return {
    name: 'reprise-bundle-check',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files: Array<{ file: string; content: string }> = []
      for (const output of Object.values(bundle)) {
        if (!isServedFile(output.fileName)) continue
        const content =
          output.type === 'chunk'
            ? output.code
            : typeof output.source === 'string'
              ? output.source
              : new TextDecoder().decode(output.source)
        files.push({ file: output.fileName, content })
      }

      const leaks = findBundleLeaks(files, env)
      if (leaks.length > 0) {
        this.error(
          'The bundle contains data that must not reach the browser:\n' +
            leaks.map((leak) => `  - ${leak.file} ${leak.reason}`).join('\n'),
        )
      }
    },
  }
}
