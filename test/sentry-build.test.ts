import { describe, expect, it } from 'vitest'
import { quoteDebugIds, readSentryBuildSettings } from '../vite.sentry.ts'

// Joined at run time so no token-shaped string sits in the source.
const FAKE_TOKEN = ['sntrys', 'fake'].join('_')

const FULL = {
  SENTRY_AUTH_TOKEN: FAKE_TOKEN,
  SENTRY_ORG: 'my-org',
  SENTRY_PROJECT: 'reprise',
}

describe('readSentryBuildSettings', () => {
  it('skips the upload, quietly, with no token (CI and local builds)', () => {
    expect(readSentryBuildSettings({})).toEqual({
      uploadSourceMaps: false,
      warning: null,
    })
  })

  it('treats an empty or blank token as no token', () => {
    for (const SENTRY_AUTH_TOKEN of ['', '   ']) {
      expect(readSentryBuildSettings({ ...FULL, SENTRY_AUTH_TOKEN })).toEqual({
        uploadSourceMaps: false,
        warning: null,
      })
    }
  })

  it('skips and warns when the token is set without the org', () => {
    const result = readSentryBuildSettings({ ...FULL, SENTRY_ORG: undefined })
    expect(result.uploadSourceMaps).toBe(false)
    expect(result.uploadSourceMaps === false && result.warning).toMatch(
      /SENTRY_ORG is missing/,
    )
  })

  it('names both when the org and the project are missing', () => {
    const result = readSentryBuildSettings({ SENTRY_AUTH_TOKEN: FAKE_TOKEN })
    expect(result.uploadSourceMaps === false && result.warning).toMatch(
      /SENTRY_ORG and SENTRY_PROJECT is missing/,
    )
  })

  it('uploads when token, org and project are all set', () => {
    expect(readSentryBuildSettings(FULL)).toEqual({
      uploadSourceMaps: true,
      authToken: FAKE_TOKEN,
      org: 'my-org',
      project: 'reprise',
      release: undefined,
    })
  })

  it('uses the Vercel commit as the release name', () => {
    const result = readSentryBuildSettings({
      ...FULL,
      VERCEL_GIT_COMMIT_SHA: 'd40de5f',
    })
    expect(result.uploadSourceMaps && result.release).toBe('d40de5f')
  })

  it('trims values', () => {
    const result = readSentryBuildSettings({
      SENTRY_AUTH_TOKEN: ` ${FAKE_TOKEN} `,
      SENTRY_ORG: ' my-org ',
      SENTRY_PROJECT: ' reprise ',
    })
    expect(result).toMatchObject({
      authToken: FAKE_TOKEN,
      org: 'my-org',
      project: 'reprise',
    })
  })
})

const DEBUG_ID = '115757a5-ec14-46a2-b207-ac382172352a'

// Copied from the Sentry CLI (npm package `sentry`, 0.49.0), which decides
// with it whether a file already has a debug ID snippet. When it finds none
// it adds one to the uploaded copy and shifts that copy's source map by a
// line, which the served file never gets.
const CLI_SNIPPET_PATTERN = new RegExp(
  `(?:\\.\\s*_sentryDebugIds|\\[\\s*["']_sentryDebugIds["']\\s*\\])\\s*\\[\\s*[$\\w]+\\s*\\]\\s*=\\s*(["'])(${DEBUG_ID})\\1`,
)

// The snippet as Vite 8's minifier emits it.
const MINIFIED =
  `var t=new e.Error().stack;t&&(e._sentryDebugIds=e._sentryDebugIds||{},` +
  `e._sentryDebugIds[t]=\`${DEBUG_ID}\`,` +
  `e._sentryDebugIdIdentifier=\`sentry-dbid-${DEBUG_ID}\`)`

describe('quoteDebugIds', () => {
  it('reproduces the bug: the CLI does not see the minified snippet', () => {
    expect(CLI_SNIPPET_PATTERN.test(MINIFIED)).toBe(false)
  })

  it('makes the snippet one the CLI recognizes', () => {
    expect(CLI_SNIPPET_PATTERN.test(quoteDebugIds(MINIFIED))).toBe(true)
  })

  it('keeps every character where it was, so the source map stays exact', () => {
    const quoted = quoteDebugIds(MINIFIED)
    expect(quoted).toHaveLength(MINIFIED.length)
    expect(quoted.split('\n')).toHaveLength(MINIFIED.split('\n').length)
    expect(quoted).toContain(`e._sentryDebugIds[t]="${DEBUG_ID}"`)
    expect(quoted).toContain(
      `_sentryDebugIdIdentifier="sentry-dbid-${DEBUG_ID}"`,
    )
  })

  it('leaves other template literals alone', () => {
    const code = `a=\`${DEBUG_ID}\`;e._sentryDebugIds=\`x\``
    expect(quoteDebugIds(code)).toBe(code)
  })

  it('leaves an already quoted snippet alone', () => {
    const code = `e._sentryDebugIds[n]="${DEBUG_ID}"`
    expect(quoteDebugIds(code)).toBe(code)
  })
})
