import { useEffect, useRef } from 'react'

interface HomeProps {
  onCapture: () => void
  // True when coming back from the capture flow, so focus lands here
  // instead of on <body>. False on first load, so the page reads from the top.
  focusOnMount: boolean
}

export function Home({ onCapture, focusOnMount }: HomeProps) {
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (focusOnMount) buttonRef.current?.focus()
  }, [focusOnMount])

  return (
    <section className="home">
      <button
        ref={buttonRef}
        type="button"
        className="button button-primary button-focal"
        onClick={onCapture}
      >
        Capture a page
      </button>
    </section>
  )
}
