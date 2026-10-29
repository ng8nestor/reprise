import { describe, expect, it } from 'vitest'
import {
  alreadyCapturedMessage,
  COULD_NOT_SAVE,
  gradeErrorMessage,
  rpcFailure,
  saveErrorMessage,
  shouldDeletePhoto,
  uploadFailure,
  type SaveFailure,
} from './saveError.ts'

describe('gradeErrorMessage', () => {
  it('says it could not connect after a network failure', () => {
    expect(gradeErrorMessage({ kind: 'network' })).toBe(
      "Couldn't connect. Try again.",
    )
  })

  it.each<SaveFailure>([
    { kind: 'database', code: '42501' },
    // Never the capture-only "already captured page" message.
    { kind: 'database', code: '23505' },
    { kind: 'other' },
  ])('uses the generic message for $kind failures', (failure) => {
    expect(gradeErrorMessage(failure)).toBe("Couldn't save. Try again.")
  })
})

describe('saveErrorMessage', () => {
  it('names the page when the book already has it (23505)', () => {
    expect(saveErrorMessage({ kind: 'database', code: '23505' }, 42)).toBe(
      "You've already captured page 42 of this book.",
    )
  })

  it('uses the generic message for a foreign key error (23503)', () => {
    expect(saveErrorMessage({ kind: 'database', code: '23503' }, 42)).toBe(
      "Couldn't save. Try again.",
    )
  })

  it.each(['23514', '42501', '22023', 'PGRST202', 'PGRST301'])(
    'uses the generic message for other database codes (%s)',
    (code) => {
      expect(saveErrorMessage({ kind: 'database', code }, 1)).toBe(
        COULD_NOT_SAVE,
      )
    },
  )

  it('says it could not connect after a network failure', () => {
    expect(saveErrorMessage({ kind: 'network' }, 1)).toBe(
      "Couldn't connect. Try again.",
    )
  })

  it('uses the generic message for anything else', () => {
    expect(saveErrorMessage({ kind: 'other' }, 1)).toBe(COULD_NOT_SAVE)
  })

  it('keeps every message short and free of codes', () => {
    for (const message of [COULD_NOT_SAVE, alreadyCapturedMessage(9999)]) {
      expect(message).not.toMatch(/\d{5}|PGRST/)
      expect(message.length).toBeLessThan(60)
    }
  })
})

describe('rpcFailure', () => {
  it('treats status 0 as a network failure', () => {
    expect(rpcFailure({ status: 0, code: '' })).toEqual({ kind: 'network' })
  })

  it('keeps the database error code', () => {
    expect(rpcFailure({ status: 409, code: '23505' })).toEqual({
      kind: 'database',
      code: '23505',
    })
  })

  it('treats an HTTP error without a code as other', () => {
    expect(rpcFailure({ status: 502, code: '' })).toEqual({ kind: 'other' })
  })
})

describe('uploadFailure', () => {
  function named(name: string): Error {
    const error = new Error('x')
    error.name = name
    return error
  }

  it('treats StorageUnknownError as a network failure', () => {
    expect(uploadFailure(named('StorageUnknownError'))).toEqual({
      kind: 'network',
    })
  })

  it.each([named('StorageApiError'), new Error('x'), 'boom', null])(
    'treats anything else as other (%s)',
    (error) => {
      expect(uploadFailure(error)).toEqual({ kind: 'other' })
    },
  )
})

describe('shouldDeletePhoto', () => {
  it('deletes only when the database refused the save', () => {
    const cases: [SaveFailure, boolean][] = [
      [{ kind: 'database', code: '23505' }, true],
      [{ kind: 'database', code: '23503' }, true],
      [{ kind: 'network' }, false],
      [{ kind: 'other' }, false],
    ]
    for (const [failure, expected] of cases) {
      expect(shouldDeletePhoto(failure)).toBe(expected)
    }
  })
})
