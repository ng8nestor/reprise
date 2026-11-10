import { describe, expect, it } from 'vitest'
import { readSentryBuildSettings } from '../vite.sentry.ts'

const FULL = {
  SENTRY_AUTH_TOKEN: 'sntrys_fake',
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
    const result = readSentryBuildSettings({ SENTRY_AUTH_TOKEN: 'sntrys_fake' })
    expect(result.uploadSourceMaps === false && result.warning).toMatch(
      /SENTRY_ORG and SENTRY_PROJECT is missing/,
    )
  })

  it('uploads when token, org and project are all set', () => {
    expect(readSentryBuildSettings(FULL)).toEqual({
      uploadSourceMaps: true,
      authToken: 'sntrys_fake',
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
      SENTRY_AUTH_TOKEN: ' sntrys_fake ',
      SENTRY_ORG: ' my-org ',
      SENTRY_PROJECT: ' reprise ',
    })
    expect(result).toMatchObject({
      authToken: 'sntrys_fake',
      org: 'my-org',
      project: 'reprise',
    })
  })
})
