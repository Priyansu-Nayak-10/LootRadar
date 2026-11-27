import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error)
    if (errorInfo?.componentStack) {
      console.error('Component stack:', errorInfo.componentStack)
    }
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: this.props.minHeight || '60vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg)',
            color: 'var(--text)',
            padding: '24px',
            textAlign: 'center',
            fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
          }}
        >
          <div
            style={{
              maxWidth: '480px',
              width: '100%',
              padding: '36px 28px',
              borderRadius: '16px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-card, 0 18px 45px rgba(0, 0, 0, 0.4))',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'var(--accent-soft)',
                border: '1px solid var(--border-strong)',
                color: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                fontSize: '20px',
                fontWeight: 800,
              }}
            >
              !
            </div>
            <h1
              style={{
                margin: '0 0 12px',
                fontSize: '24px',
                fontWeight: 800,
                letterSpacing: '-0.03em',
                color: 'var(--text)',
              }}
            >
              Something went wrong
            </h1>
            <p
              style={{
                margin: '0 0 24px',
                fontSize: '14px',
                color: 'var(--text-muted)',
                lineHeight: 1.5,
              }}
            >
              An unexpected error occurred. Please try reloading the page.
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="lr-button"
              style={{
                minHeight: '44px',
                padding: '10px 24px',
                borderRadius: '999px',
                background: 'var(--accent-fill)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 800,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Reload
            </button>
            {import.meta.env.DEV && this.state.error && (
              <details style={{ marginTop: '16px', textAlign: 'left', fontSize: '12px', color: 'var(--danger)' }}>
                <summary style={{ cursor: 'pointer' }}>Error details</summary>
                <pre style={{ whiteSpace: 'pre-wrap', marginTop: '8px' }}>
                  {this.state.error.toString()}
                  {'\n'}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
