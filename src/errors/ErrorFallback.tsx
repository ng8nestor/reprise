import './errors.css'

// Shown by the error boundary in main.tsx when rendering crashes. It stands
// alone on purpose: it uses no app state, no Supabase, no hooks, so it cannot
// fail for the same reason the app just did. It shows no error details.
export function ErrorFallback() {
  return (
    <div className="page">
      <header className="page-header">
        <h1 className="wordmark">reprise</h1>
      </header>
      <main>
        <section className="card error-fallback" role="alert">
          <h2 className="error-fallback-title">Something went wrong</h2>
          <p className="muted">
            Reload to try again. Anything you already saved is safe.
          </p>
          <button
            type="button"
            className="button button-primary"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </section>
      </main>
    </div>
  )
}
