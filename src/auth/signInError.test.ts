import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import {
  SERVER_UNREACHABLE,
  SIGN_IN_FAILED,
  signInErrorMessage,
} from './signInError.ts'

describe('signInErrorMessage', () => {
  it('uses the generic message for wrong credentials', () => {
    const error = new AuthApiError(
      'Invalid login credentials',
      400,
      'invalid_credentials',
    )
    expect(signInErrorMessage(error)).toBe(SIGN_IN_FAILED)
  })

  it('uses the network message when the request got no response', () => {
    const error = new AuthRetryableFetchError('Failed to fetch', 0)
    expect(signInErrorMessage(error)).toBe("Couldn't connect. Try again.")
  })

  it('uses the network message for a 5xx reply', () => {
    const error = new AuthRetryableFetchError('Service Unavailable', 503)
    expect(signInErrorMessage(error)).toBe(SERVER_UNREACHABLE)
  })

  it('uses the generic message for rate limiting', () => {
    const error = new AuthApiError(
      'Request rate limit reached',
      429,
      'over_request_rate_limit',
    )
    expect(signInErrorMessage(error)).toBe(SIGN_IN_FAILED)
  })

  it('uses the generic message for an unexpected thrown value', () => {
    expect(signInErrorMessage(new Error('boom'))).toBe(SIGN_IN_FAILED)
  })

  it('never mentions the email or account', () => {
    for (const message of [SIGN_IN_FAILED, SERVER_UNREACHABLE]) {
      expect(message).not.toMatch(/exist|registered|no account|not found/i)
    }
  })
})
