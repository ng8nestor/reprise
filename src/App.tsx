import { useState } from 'react'
import { AccountBar } from './auth/AccountBar.tsx'
import { LoginForm } from './auth/LoginForm.tsx'
import { useAuth } from './auth/useAuth.ts'
import { BrowseHighlights } from './browse/BrowseHighlights.tsx'
import { CaptureFlow } from './capture/CaptureFlow.tsx'
import { Home } from './Home.tsx'
import { DailyReview } from './review/DailyReview.tsx'

type Screen = 'home' | 'returnedHome' | 'capture' | 'review' | 'browse'

// Lives only while signed in, so signing out (or a session expiring
// mid-capture) always starts the next session from home.
function SignedIn() {
  const [screen, setScreen] = useState<Screen>('home')
  const toHome = () => setScreen('returnedHome')

  return (
    <main>
      {screen === 'capture' && <CaptureFlow onExit={toHome} />}
      {screen === 'review' && <DailyReview onExit={toHome} />}
      {screen === 'browse' && (
        <BrowseHighlights
          onCapture={() => setScreen('capture')}
          onExit={toHome}
        />
      )}
      {(screen === 'home' || screen === 'returnedHome') && (
        <Home
          onCapture={() => setScreen('capture')}
          onReview={() => setScreen('review')}
          onBrowse={() => setScreen('browse')}
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
