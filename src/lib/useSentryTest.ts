import { useEffect, useState } from 'react'
import {
  isSentryTestHash,
  sendSentryTestError,
  type SentryTestResult,
} from './sentryTest.ts'

// Sends one test error when the page is opened at /#sentry-test. Used only
// inside the signed-in app, so these rules hold:
//
// - Signed in only: a stranger opening the URL gets the sign-in form and
//   sends nothing, so nobody else can spend the error quota.
// - Once per visit: the hash is removed from the address bar before the
//   error is sent, so a reload or back/forward does not send it again.
// - Caught and sent on purpose: nothing is thrown into the UI, so the
//   screen never changes, and the message says it is a test.
// - Nothing attached: the error carries no data, only the (scrubbed) user id.
export function useSentryTest(): SentryTestResult | null {
  const [result, setResult] = useState<SentryTestResult | null>(null)

  useEffect(() => {
    function run() {
      if (!isSentryTestHash(window.location.hash)) return
      window.history.replaceState(
        null,
        '',
        window.location.pathname + window.location.search,
      )
      setResult(sendSentryTestError())
    }

    run()
    // Also works when the hash is typed into an already-open tab.
    window.addEventListener('hashchange', run)
    return () => window.removeEventListener('hashchange', run)
  }, [])

  return result
}
