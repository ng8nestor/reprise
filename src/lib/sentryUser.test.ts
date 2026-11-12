import * as Sentry from '@sentry/react'
import { afterEach, describe, expect, it } from 'vitest'
import { sentryUserFor, syncSentryUser } from './sentryUser.ts'

const USER_ID = '8d1f7c1e-0000-4000-8000-000000000001'

afterEach(() => {
  Sentry.setUser(null)
})

describe('sentryUserFor', () => {
  it('keeps only the id of a signed-in user', () => {
    const session = { user: { id: USER_ID, email: 'me@example.com' } }
    expect(sentryUserFor(session)).toEqual({ id: USER_ID })
  })

  it('is null when signed out', () => {
    expect(sentryUserFor(null)).toBeNull()
  })
})

describe('syncSentryUser', () => {
  it('puts the id on the scope every event reads from', () => {
    syncSentryUser({ user: { id: USER_ID } })
    expect(Sentry.getIsolationScope().getUser()).toEqual({ id: USER_ID })
  })

  it('clears it on sign-out', () => {
    syncSentryUser({ user: { id: USER_ID } })
    syncSentryUser(null)
    expect(Sentry.getIsolationScope().getUser()).toEqual({})
  })
})
