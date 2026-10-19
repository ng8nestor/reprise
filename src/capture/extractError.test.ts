import { describe, expect, it } from 'vitest'
import {
  COULD_NOT_READ,
  extractErrorView,
  PHOTO_TOO_LARGE,
  SESSION_EXPIRED,
  SOMETHING_WENT_WRONG,
} from './extractError.ts'

describe('extractErrorView', () => {
  it('asks to sign in again on 401', () => {
    expect(extractErrorView({ kind: 'http', status: 401 })).toEqual({
      message: SESSION_EXPIRED,
      recovery: 'signIn',
    })
  })

  it('asks for another photo on 413', () => {
    expect(extractErrorView({ kind: 'http', status: 413 })).toEqual({
      message: PHOTO_TOO_LARGE,
      recovery: 'retake',
    })
  })

  it.each([502, 504])('offers a retry on %i', (status) => {
    expect(extractErrorView({ kind: 'http', status })).toEqual({
      message: "Couldn't read this page. Try again.",
      recovery: 'retry',
    })
  })

  it('says it could not connect when the request got no response', () => {
    expect(extractErrorView({ kind: 'network' })).toEqual({
      message: "Couldn't connect. Try again.",
      recovery: 'retry',
    })
  })

  it.each([400, 404, 405, 429, 500, 503])(
    'uses the generic message for %i',
    (status) => {
      expect(extractErrorView({ kind: 'http', status })).toEqual({
        message: SOMETHING_WENT_WRONG,
        recovery: 'retry',
      })
    },
  )

  it('uses the generic message for a malformed success reply', () => {
    expect(extractErrorView({ kind: 'badResponse' }).message).toBe(
      SOMETHING_WENT_WRONG,
    )
  })

  it('keeps every message short and free of status codes', () => {
    for (const message of [
      SESSION_EXPIRED,
      PHOTO_TOO_LARGE,
      COULD_NOT_READ,
      SOMETHING_WENT_WRONG,
    ]) {
      expect(message).not.toMatch(/\d{3}/)
      expect(message.length).toBeLessThan(60)
    }
  })
})
