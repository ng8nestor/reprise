import { useState } from 'react'
import { AccountBar } from './auth/AccountBar.tsx'
import { LoginForm } from './auth/LoginForm.tsx'
import { useAuth } from './auth/useAuth.ts'
import { CaptureFlow } from './capture/CaptureFlow.tsx'
import { Home } from './Home.tsx'

type Screen = 'home' | 'returnedHome' | 'capture'

// Lives only while signed in, so signing out (or a session expiring
// mid-capture) always starts the next session from home.
function SignedIn() {
  const [screen, setScreen] = useState<Screen>('home')

  return (
    <main>
      {screen === 'capture' ? (
        <CaptureFlow onExit={() => setScreen('returnedHome')} />
      ) : (
        <Home
          onCapture={() => setScreen('capture')}
          focusOnMount={screen === 'returnedHome'}
        />
      )}
    </main>
  )
}

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

      {auth.status === 'signedIn' && <SignedIn />}
    </div>
  )
}

export default App
