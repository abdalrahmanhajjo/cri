import { Component } from 'react';

export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: 'clamp(24px, 5vw, 48px)',
            fontFamily: 'system-ui, sans-serif',
            background: '#fafafa',
            color: '#1a1a1a',
            minHeight: '100vh',
            maxWidth: 520,
            margin: '0 auto',
          }}
        >
          <h1 style={{ fontSize: '1.35rem', fontWeight: 700, margin: '0 0 12px' }}>
            Something went wrong
          </h1>
          <p style={{ margin: '0 0 20px', lineHeight: 1.55, color: '#444' }}>
            The page hit an unexpected error. You can reload to try again. If it keeps happening, try
            Discover or come back later.
          </p>
          {import.meta.env.DEV && this.state.error?.message && (
            <pre
              style={{
                overflow: 'auto',
                fontSize: 13,
                background: '#fff',
                border: '1px solid #e5e5e5',
                borderRadius: 8,
                padding: 12,
                marginBottom: 20,
              }}
            >
              {this.state.error.message}
            </pre>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              minHeight: 44,
              minWidth: 120,
              padding: '12px 20px',
              fontSize: 15,
              fontWeight: 600,
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              background: '#0f766e',
              color: '#fff',
            }}
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
