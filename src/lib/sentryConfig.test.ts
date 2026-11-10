import { describe, expect, it } from 'vitest'
import { readSentryConfig, resolveEnvironment } from './sentryConfig.ts'

const DSN = 'https://abc123@o1.ingest.sentry.io/42'

describe('resolveEnvironment', () => {
  it('passes production and preview through', () => {
    expect(resolveEnvironment('production')).toBe('production')
    expect(resolveEnvironment('preview')).toBe('preview')
  })

  it('calls everything else development', () => {
    expect(resolveEnvironment('development')).toBe('development')
    expect(resolveEnvironment(null)).toBe('development')
    expect(resolveEnvironment(undefined)).toBe('development')
    expect(resolveEnvironment('Production')).toBe('development')
    expect(resolveEnvironment('')).toBe('development')
  })
})

describe('readSentryConfig', () => {
  it('returns the DSN and environment when the DSN is set', () => {
    expect(readSentryConfig({ dsn: DSN, vercelEnv: 'production' })).toEqual({
      dsn: DSN,
      environment: 'production',
    })
  })

  it('trims the DSN', () => {
    expect(
      readSentryConfig({ dsn: ` ${DSN}\n`, vercelEnv: 'preview' }),
    ).toEqual({ dsn: DSN, environment: 'preview' })
  })

  it('stays off when the DSN is missing or blank', () => {
    expect(readSentryConfig({ dsn: undefined, vercelEnv: 'production' })).toBe(
      null,
    )
    expect(readSentryConfig({ dsn: '', vercelEnv: 'production' })).toBe(null)
    expect(readSentryConfig({ dsn: '   ', vercelEnv: 'production' })).toBe(null)
  })

  it('stays off, without throwing, when the DSN is not a URL', () => {
    expect(
      readSentryConfig({ dsn: 'not a dsn', vercelEnv: 'production' }),
    ).toBe(null)
    expect(
      readSentryConfig({ dsn: 'ftp://abc@host/1', vercelEnv: 'production' }),
    ).toBe(null)
  })

  it('uses development when not built on Vercel', () => {
    expect(readSentryConfig({ dsn: DSN, vercelEnv: null })).toEqual({
      dsn: DSN,
      environment: 'development',
    })
  })
})
