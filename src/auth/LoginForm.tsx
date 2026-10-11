import { useId, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase.ts'
import { signInErrorMessage } from './signInError.ts'
import './auth.css'

export function LoginForm() {
  const emailId = useId()
  const passwordId = useId()
  const errorId = useId()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    setPending(true)
    setError(null)
    let failure: unknown
    try {
      const result = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      // On success onAuthStateChange swaps this form out; nothing to reset.
      if (!result.error) return
      failure = result.error
    } catch (thrown) {
      failure = thrown
    }
    setError(signInErrorMessage(failure))
    setPending(false)
  }

  const describedBy = error ? errorId : undefined

  return (
    <form className="card login-form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor={emailId}>Email</label>
        <input
          id={emailId}
          name="email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />
      </div>

      <div className="field">
        <label htmlFor={passwordId}>Password</label>
        <input
          id={passwordId}
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />
      </div>

      {/* Always rendered: keeps its line reserved (no layout jump) and lets
          screen readers announce the text when it appears. */}
      <p id={errorId} className="form-error" role="alert">
        {error}
      </p>

      {/* aria-disabled instead of disabled: a disabled button drops keyboard
          focus to <body>; this keeps focus on it while pending. */}
      <button
        type="submit"
        className="button button-primary"
        aria-disabled={pending}
      >
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
