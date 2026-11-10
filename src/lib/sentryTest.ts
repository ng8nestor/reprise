import * as Sentry from '@sentry/react'

// Visit /#sentry-test while signed in to send one test error. See
// useSentryTest.ts for the safety rules.
export const SENTRY_TEST_HASH = '#sentry-test'

export function isSentryTestHash(hash: string): boolean {
  return hash === SENTRY_TEST_HASH
}

// A named function in our own source, so a test event's stack trace shows
// whether source maps work: the top frame should read
// src/lib/sentryTest.ts in this function, not a minified bundle.
export function throwSentryTestError(): never {
  throw new Error('Sentry test error: sent on purpose, safe to ignore')
}

export type SentryTestResult =
  { sent: true; eventId: string } | { sent: false; reason: 'sentry-off' }

export function sendSentryTestError(): SentryTestResult {
  // Without a client captureException is a silent no-op; say so instead.
  if (!Sentry.getClient()) return { sent: false, reason: 'sentry-off' }

  try {
    throwSentryTestError()
  } catch (error) {
    return { sent: true, eventId: Sentry.captureException(error) }
  }
}
