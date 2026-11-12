import { describe, expect, it } from 'vitest'
import { findBundleLeaks } from '../vite.bundle-check.ts'

// The commit that leaked into production, as Vercel sets it.
const COMMIT_MESSAGE =
  'Feat/sentry (#15)\n\n* docs: update SCOPE dates\n\n* feat(observability): add Sentry error tracking with privacy scrubbing'

const PUBLIC_ENV = {
  VITE_SUPABASE_URL: 'https://abcdefghijklmnop.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_0123456789abcdef',
  VITE_SENTRY_DSN: 'https://abc123@o1.ingest.sentry.io/4500000000000001',
  VERCEL_GIT_COMMIT_SHA: 'fe2ccbc4267e7c88dbc209323bdcbfa08d74ef63',
}

function js(content: string) {
  return [{ file: 'assets/index-abc.js', content }]
}

describe('findBundleLeaks', () => {
  it('passes a bundle that holds only the public values', () => {
    const content = Object.values(PUBLIC_ENV).join(';')
    expect(findBundleLeaks(js(content), PUBLIC_ENV)).toEqual([])
  })

  it('catches a Sentry auth token by its prefix, set or not', () => {
    expect(findBundleLeaks(js('x="sntrys_eyJpYXQiOjE3"'), {})).toEqual([
      {
        file: 'assets/index-abc.js',
        reason: 'contains "sntrys_" (a secret key)',
      },
    ])
  })

  it('catches an Anthropic key by its prefix', () => {
    const leaks = findBundleLeaks(js('k=`sk-ant-api03-xyz`'), {})
    expect(leaks.map((leak) => leak.reason)).toEqual([
      'contains "sk-ant" (a secret key)',
    ])
  })

  it('catches the commit message the way it leaked: one raw line in a template literal', () => {
    // What Vite emitted when import.meta.env was inlined whole.
    const content =
      'Bh=Object.freeze({VITE_VERCEL_GIT_COMMIT_MESSAGE:`Feat/sentry (#15)\n\n* docs: update SCOPE dates\n\n* feat(observability)...`})'
    const leaks = findBundleLeaks(js(content), {
      VERCEL_GIT_COMMIT_MESSAGE: COMMIT_MESSAGE,
    })
    expect(leaks.map((leak) => leak.reason)).toContain(
      'contains the git commit message',
    )
  })

  it('also reads the VITE_-prefixed copy Vercel exposes to Vite', () => {
    const leaks = findBundleLeaks(js('m="* docs: update SCOPE dates"'), {
      VITE_VERCEL_GIT_COMMIT_MESSAGE: COMMIT_MESSAGE,
    })
    expect(leaks).toHaveLength(1)
  })

  it('ignores short commit message lines that would match code by chance', () => {
    const leaks = findBundleLeaks(js('function fix(){}'), {
      VERCEL_GIT_COMMIT_MESSAGE: 'fix',
    })
    expect(leaks).toEqual([])
  })

  it('catches any other environment value, naming the variable but not the value', () => {
    const secret = 'whsec_0123456789abcdefghijklmnop'
    const leaks = findBundleLeaks(js(`a="${secret}"`), {
      ...PUBLIC_ENV,
      VITE_WEBHOOK_SECRET: secret,
    })
    expect(leaks).toEqual([
      {
        file: 'assets/index-abc.js',
        reason: 'contains the value of VITE_WEBHOOK_SECRET',
      },
    ])
    expect(JSON.stringify(leaks)).not.toContain(secret)
  })

  it('allows a public value even when Vercel repeats it under another name', () => {
    const leaks = findBundleLeaks(
      js(`r="${PUBLIC_ENV.VERCEL_GIT_COMMIT_SHA}"`),
      {
        ...PUBLIC_ENV,
        VITE_VERCEL_GIT_COMMIT_SHA: PUBLIC_ENV.VERCEL_GIT_COMMIT_SHA,
      },
    )
    expect(leaks).toEqual([])
  })

  it('ignores short values like "production"', () => {
    const leaks = findBundleLeaks(js('e="production"'), {
      VERCEL_ENV: 'production',
      NODE_ENV: 'production',
    })
    expect(leaks).toEqual([])
  })
})
