import { setUser } from '@sentry/react'

// Only the part of a Supabase session this file reads, so tests don't need a
// full Session.
interface SessionUser {
  user: { id: string }
}

// The signed-in user's id and nothing else. The id is a random UUID from
// Supabase; the email never goes near Sentry.
export function sentryUserFor(
  session: SessionUser | null,
): { id: string } | null {
  return session ? { id: session.user.id } : null
}

// Called by useAuth the moment a session arrives or ends, BEFORE the auth
// state is updated, so the id is already on the scope when the signed-in
// screens render and run their effects.
//
// It used to be set in a useEffect in App. React runs a child's effects
// before its parent's, so anything reported while the signed-in screens
// first mounted (the #sentry-test error, a crash on first render, an error
// in a child's effect) was sent before the id was set, with no user.
//
// Does nothing visible when Sentry is off (setUser only stores the value).
export function syncSentryUser(session: SessionUser | null): void {
  setUser(sentryUserFor(session))
}
