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
    if (import.meta.env.DEV) {
      console.error('Uncaught error caught by ErrorBoundary:', error)
      console.error('Component stack:', errorInfo?.componentStack)
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
            background: '#070a0d',
            color: '#eff8f1',
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
              background: 'linear-gradient(145deg, #151e23, #10161b)',
              border: '1px solid rgba(196, 255, 77, 0.28)',
              boxShadow: '0 18px 45px rgba(0, 0, 0, 0.4)',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'rgba(196, 255, 77, 0.12)',
                border: '1px solid rgba(196, 255, 77, 0.3)',
                color: '#c4ff4d',
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
                color: '#eff8f1',
              }}
            >
              Something went wrong
            </h1>
            <p
              style={{
                margin: '0 0 24px',
                fontSize: '14px',
                color: '#97a59f',
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
                background: '#c4ff4d',
                color: '#10150a',
                border: 'none',
                fontWeight: 800,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Reload
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
