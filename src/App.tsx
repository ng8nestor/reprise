import { AccountBar } from './auth/AccountBar.tsx'
import { LoginForm } from './auth/LoginForm.tsx'
import { useAuth } from './auth/useAuth.ts'

function App() {
  const auth = useAuth()

  // The title renders in every state at the same spot, so loading is just
  // the title on a calm page and the rest appears below it without a jump.
  return (
    <div className="page" aria-busy={auth.status === 'loading'}>
      <header className="page-header">
        <h1 className="wordmark">reprise</h1>
        {auth.status === 'signedIn' && (
          <AccountBar email={auth.session.user.email} />
        )}
      </header>

      {auth.status === 'signedOut' && (
        <main>
          <LoginForm />
        </main>
      )}
    </div>
  )
}

export default App
