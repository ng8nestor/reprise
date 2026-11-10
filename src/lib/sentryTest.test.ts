import { describe, expect, it } from 'vitest'
import {
  isSentryTestHash,
  sendSentryTestError,
  throwSentryTestError,
} from './sentryTest.ts'

describe('isSentryTestHash', () => {
  it('matches only the exact test hash', () => {
    expect(isSentryTestHash('#sentry-test')).toBe(true)
  })

  it('ignores every other hash', () => {
    for (const hash of [
      '',
      '#',
      '#sentry-test2',
      '#Sentry-Test',
      '#sentry-test&x=1',
      '#access_token=abc',
    ]) {
      expect(isSentryTestHash(hash)).toBe(false)
    }
  })
})

describe('throwSentryTestError', () => {
  it('throws an error that says it is a test', () => {
    expect(() => throwSentryTestError()).toThrow(/Sentry test error/)
  })
})

describe('sendSentryTestError', () => {
  it('reports that Sentry is off, without throwing, when it was never started', () => {
    expect(sendSentryTestError()).toEqual({ sent: false, reason: 'sentry-off' })
  })
})
