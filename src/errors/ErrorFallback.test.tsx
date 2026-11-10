// The server/ import ban matches this React path by name; it is React's
// renderer here, not the repo's server/ folder.
// oxlint-disable-next-line no-restricted-imports
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ErrorFallback } from './ErrorFallback.tsx'

describe('ErrorFallback', () => {
  const html = renderToStaticMarkup(<ErrorFallback />)

  it('says something went wrong, calmly', () => {
    expect(html).toContain('Something went wrong')
    expect(html).toContain('Anything you already saved is safe.')
  })

  it('offers one Reload button', () => {
    expect(html.match(/<button/g)).toHaveLength(1)
    expect(html).toContain('>Reload</button>')
  })

  it('announces itself to screen readers', () => {
    expect(html).toContain('role="alert"')
  })

  it('keeps the wordmark so the page still looks like reprise', () => {
    expect(html).toContain('>reprise</h1>')
  })

  it('uses shared classes only, with no inline styles or colors', () => {
    expect(html).not.toContain('style=')
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,6}\b/)
  })
})
