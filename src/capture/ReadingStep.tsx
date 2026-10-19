import type { ExtractErrorView } from './extractError.ts'
import { useFocusOnMount } from './useFocusOnMount.ts'

interface ReadingStepProps {
  photoUrl: string
  onCancel: () => void
}

export function ReadingStep({ photoUrl, onCancel }: ReadingStepProps) {
  const headingRef = useFocusOnMount<HTMLHeadingElement>()

  return (
    <section className="stack" aria-busy="true">
      <h2 ref={headingRef} tabIndex={-1} className="step-heading">
        Reading your highlights…
      </h2>
      <p className="muted" role="status">
        This usually takes 15 to 40 seconds.
      </p>
      <img className="photo" src={photoUrl} alt="The page you photographed" />
      <button
        type="button"
        className="button button-secondary"
        onClick={onCancel}
      >
        Cancel
      </button>
    </section>
  )
}

interface FailedStepProps {
  photoUrl: string
  error: ExtractErrorView
  onRetry: () => void
  onRetake: () => void
  onSignIn: () => void
}

export function FailedStep({
  photoUrl,
  error,
  onRetry,
  onRetake,
  onSignIn,
}: FailedStepProps) {
  const headingRef = useFocusOnMount<HTMLHeadingElement>()

  const primary =
    error.recovery === 'signIn'
      ? { label: 'Sign in again', onClick: onSignIn }
      : error.recovery === 'retake'
        ? { label: 'Take another photo', onClick: onRetake }
        : { label: 'Try again', onClick: onRetry }

  return (
    <section className="stack">
      <h2 ref={headingRef} tabIndex={-1} className="step-heading">
        That didn't work
      </h2>
      <p className="form-error" role="alert">
        {error.message}
      </p>
      <img className="photo" src={photoUrl} alt="The page you photographed" />
      <button
        type="button"
        className="button button-primary"
        onClick={primary.onClick}
      >
        {primary.label}
      </button>
      {error.recovery === 'retry' && (
        <button
          type="button"
          className="button button-secondary"
          onClick={onRetake}
        >
          Take another photo
        </button>
      )}
    </section>
  )
}
