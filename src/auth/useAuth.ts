import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.ts'

export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; session: Session }

function fromSession(session: Session | null): AuthState {
  return session ? { status: 'signedIn', session } : { status: 'signedOut' }
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(
      ({ data }) => {
        if (active) setState(fromSession(data.session))
      },
      () => {
        if (active) setState({ status: 'signedOut' })
      },
    )

    // Only sets state here: awaiting other supabase calls inside this
    // callback can deadlock the auth client.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setState(fromSession(session))
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  return state
}
