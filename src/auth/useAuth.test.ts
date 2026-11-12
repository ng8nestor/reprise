import * as Sentry from '@sentry/react'
import type { Session } from '@supabase/supabase-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { applySession, type AuthState } from './useAuth.ts'

// useAuth.ts imports the real Supabase client; nothing here talks to it.
vi.mock('../lib/supabase.ts', () => ({ supabase: {} }))

const USER_ID = '8d1f7c1e-0000-4000-8000-000000000001'

function fakeSession(): Session {
  return { user: { id: USER_ID, email: 'me@example.com' } } as Session
}

afterEach(() => {
  Sentry.setUser(null)
})

// The Users: 0 bug: the id was set in a parent's useEffect, which React runs
// after the children's effects, so errors from the first signed-in render
// went out without it. The fix is ordering: the id must be on the scope by
// the time the new auth state reaches React.
describe('applySession', () => {
  it('sets the Sentry user before the app sees the signed-in state', () => {
    const userWhenStateChanged: unknown[] = []
    const setState = vi.fn((_state: AuthState) => {
      userWhenStateChanged.push(Sentry.getIsolationScope().getUser())
    })

    applySession(fakeSession(), setState)

    expect(setState).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'signedIn' }),
    )
    expect(userWhenStateChanged).toEqual([{ id: USER_ID }])
  })

  it('clears the Sentry user before the app sees the signed-out state', () => {
    applySession(fakeSession(), () => {})

    const userWhenStateChanged: unknown[] = []
    applySession(null, (state) => {
      expect(state).toEqual({ status: 'signedOut' })
      userWhenStateChanged.push(Sentry.getIsolationScope().getUser())
    })

    expect(userWhenStateChanged).toEqual([{}])
  })
})
