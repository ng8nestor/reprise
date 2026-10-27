import { SERVER_UNREACHABLE } from '../auth/signInError.ts'

// How a call to /api/extract failed, as far as the browser can tell.
// badResponse: a 2xx whose body didn't match the expected shape.
export type ExtractFailure =
  | { kind: 'http'; status: number }
  | { kind: 'network' }
  | { kind: 'badResponse' }

// The one thing the error screen offers as its main way forward.
export type Recovery = 'retry' | 'retake' | 'signIn'

export interface ExtractErrorView {
  message: string
  recovery: Recovery
}

export const SESSION_EXPIRED = 'Your session expired. Sign in again.'
export const PHOTO_TOO_LARGE = 'This photo is too large. Take another one.'
export const COULD_NOT_READ = "Couldn't read this page. Try again."
export const SOMETHING_WENT_WRONG = 'Something went wrong. Try again.'

export function extractErrorView(failure: ExtractFailure): ExtractErrorView {
  if (failure.kind === 'network') {
    return { message: SERVER_UNREACHABLE, recovery: 'retry' }
  }
  if (failure.kind === 'http') {
    switch (failure.status) {
      case 401:
        return { message: SESSION_EXPIRED, recovery: 'signIn' }
      case 413:
        return { message: PHOTO_TOO_LARGE, recovery: 'retake' }
      case 502:
      case 504:
        return { message: COULD_NOT_READ, recovery: 'retry' }
    }
  }
  return { message: SOMETHING_WENT_WRONG, recovery: 'retry' }
}
