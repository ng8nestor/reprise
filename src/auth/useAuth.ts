import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { syncSentryUser } from '../lib/sentryUser.ts'
import { supabase } from '../lib/supabase.ts'

export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; session: Session }

function fromSession(session: Session | null): AuthState {
  return session ? { status: 'signedIn', session } : { status: 'signedOut' }
}

// Every auth change goes through here. The Sentry user is set first, so it is
// in place before React renders anything for the new state (see
// sentryUser.ts for why an effect was too late).
export function applySession(
  session: Session | null,
  setState: (state: AuthState) => void,
): void {
  syncSentryUser(session)
  setState(fromSession(session))
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(
      ({ data }) => {
        if (active) applySession(data.session, setState)
      },
      () => {
        if (active) applySession(null, setState)
      },
    )

    // Only sets state here: awaiting other supabase calls inside this
    // callback can deadlock the auth client.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) applySession(session, setState)
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  return state
}
