// First on purpose: Sentry must start before the rest of the app loads.
import './instrument.ts'
import * as Sentry from '@sentry/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './index.css'
import App from './App.tsx'
import { ErrorFallback } from './errors/ErrorFallback.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Catches errors thrown while rendering. Errors in event handlers and
        async code don't reach a boundary; Sentry's global handlers report
        those, and the screen stays as it is. */}
    <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
