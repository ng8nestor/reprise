import { setUser } from '@sentry/react'
import { useEffect } from 'react'

// Tags every error with the signed-in user's id and nothing else. The id is a
// random UUID from Supabase; the email never goes near Sentry. Does nothing
// visible when Sentry is off (setUser only stores the value locally).
export function useSentryUser(userId: string | null): void {
  useEffect(() => {
    setUser(userId ? { id: userId } : null)
  }, [userId])
}
