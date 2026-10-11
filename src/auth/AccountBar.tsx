import { useState } from 'react'
import { supabase } from '../lib/supabase.ts'
import './auth.css'

interface AccountBarProps {
  email: string | undefined
}

export function AccountBar({ email }: AccountBarProps) {
  const [pending, setPending] = useState(false)

  async function handleSignOut() {
    if (pending) return
    setPending(true)
    // 'local' signs out this browser only, not every device.
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    // On success onAuthStateChange swaps this out; on failure allow a retry.
    if (error) setPending(false)
  }

  return (
    <div className="account-bar">
      <p className="account-email">{email}</p>
      <button
        type="button"
        className="button button-secondary"
        aria-disabled={pending}
        onClick={handleSignOut}
      >
        Sign out
      </button>
    </div>
  )
}
