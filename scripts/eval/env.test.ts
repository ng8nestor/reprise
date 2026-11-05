import { describe, expect, it } from 'vitest'
import { isServiceRoleKey, readEvalEnv } from './env.ts'

const GOOD = {
  VITE_SUPABASE_URL: 'https://example.invalid',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fake',
  EVAL_EMAIL: 'eval@example.invalid',
  EVAL_PASSWORD: 'fake password',
}

function fakeJwt(payload: object): string {
  const part = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${part({ alg: 'HS256' })}.${part(payload)}.signature`
}

describe('readEvalEnv', () => {
  it('returns the four settings', () => {
    expect(readEvalEnv(GOOD)).toEqual({
      url: 'https://example.invalid',
      publishableKey: 'sb_publishable_fake',
      email: 'eval@example.invalid',
      password: 'fake password',
    })
  })

  it('trims url, key and email but leaves the password as typed', () => {
    const env = readEvalEnv({
      ...GOOD,
      VITE_SUPABASE_URL: '  https://example.invalid ',
      EVAL_EMAIL: ' eval@example.invalid ',
      EVAL_PASSWORD: ' pass ',
    })
    expect(env.url).toBe('https://example.invalid')
    expect(env.email).toBe('eval@example.invalid')
    expect(env.password).toBe(' pass ')
  })

  it('names every missing variable', () => {
    expect(() => readEvalEnv({})).toThrow(
      /VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, EVAL_EMAIL, EVAL_PASSWORD/,
    )
    expect(() => readEvalEnv({ ...GOOD, EVAL_PASSWORD: '' })).toThrow(
      /Missing env var EVAL_PASSWORD\. Add it/,
    )
  })

  it('treats blank values as missing', () => {
    expect(() => readEvalEnv({ ...GOOD, EVAL_EMAIL: '   ' })).toThrow(
      /EVAL_EMAIL/,
    )
  })

  it('refuses a secret key in place of the publishable key', () => {
    expect(() =>
      readEvalEnv({ ...GOOD, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_fake' }),
    ).toThrow(/service-role/)
  })

  it('refuses a legacy service_role JWT', () => {
    expect(() =>
      readEvalEnv({
        ...GOOD,
        VITE_SUPABASE_PUBLISHABLE_KEY: fakeJwt({ role: 'service_role' }),
      }),
    ).toThrow(/service-role/)
  })

  it('never puts a secret value in an error message', () => {
    let message = ''
    try {
      readEvalEnv({ ...GOOD, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_fake' })
    } catch (err) {
      message = String(err)
    }
    expect(message).not.toContain('sb_secret_fake')
    expect(message).not.toContain('fake password')
  })
})

describe('isServiceRoleKey', () => {
  it('accepts publishable and legacy anon keys', () => {
    expect(isServiceRoleKey('sb_publishable_fake')).toBe(false)
    expect(isServiceRoleKey(fakeJwt({ role: 'anon' }))).toBe(false)
  })

  it('does not choke on text that is not a JWT', () => {
    expect(isServiceRoleKey('a.b.c')).toBe(false)
    expect(isServiceRoleKey(fakeJwt({}))).toBe(false)
  })
})
