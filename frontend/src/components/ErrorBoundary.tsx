import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

/**
 * Catches render errors inside a screen so a single bad value or bug shows a
 * recoverable message instead of unmounting the whole app (blank white page).
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Screen crashed:', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--bad)' }}>Something went wrong on this screen.</div>
        <div className="t-2" style={{ fontSize: 12.5, marginTop: 8 }}>{error.message}</div>
        <button type="button" onClick={() => this.setState({ error: null })}
          style={{ marginTop: 16, padding: '8px 16px', borderRadius: 'var(--r-s)', border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--tx-0)', cursor: 'pointer' }}>
          Try again
        </button>
      </div>
    )
  }
}
