import { isAuthRetryableFetchError } from '@supabase/supabase-js'

export const SIGN_IN_FAILED = 'Email or password is incorrect'
export const SERVER_UNREACHABLE = "Couldn't connect. Try again."

// Picks the message by how the request failed, never by which account was
// tried, so neither message reveals whether an email has an account.
// supabase-js reports a fetch that got no response (offline, DNS, aborted)
// and 5xx replies as AuthRetryableFetchError. Everything else, including
// Supabase's single invalid_credentials error, gets the generic message.
export function signInErrorMessage(error: unknown): string {
  return isAuthRetryableFetchError(error) ? SERVER_UNREACHABLE : SIGN_IN_FAILED
}
