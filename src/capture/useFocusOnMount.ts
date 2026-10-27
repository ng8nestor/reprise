import { useEffect, useRef } from 'react'

// Moves focus to the element (usually a step's heading, with tabIndex={-1})
// when it first renders, so keyboard and screen reader users land at the
// top of the new step instead of on <body>.
export function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [])
  return ref
}
