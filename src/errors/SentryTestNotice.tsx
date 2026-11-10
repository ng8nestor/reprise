import { useSentryTest } from '../lib/useSentryTest.ts'

// Shows the result of visiting /#sentry-test. Renders nothing otherwise.
export function SentryTestNotice() {
  const result = useSentryTest()
  if (!result) return null

  return (
    <p className="muted" role="status">
      {result.sent
        ? `Test error sent to Sentry (event ${result.eventId}). It appears under Issues as "Sentry test error".`
        : 'Sentry is off in this build: VITE_SENTRY_DSN was not set when it was built.'}
    </p>
  )
}
