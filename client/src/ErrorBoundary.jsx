import { Component } from 'react';

export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: 24,
          fontFamily: 'sans-serif',
          background: '#fef2f2',
          color: '#b91c1c',
          minHeight: '100vh',
        }}>
          <h1>Something went wrong</h1>
          <pre style={{ overflow: 'auto', fontSize: 14 }}>{this.state.error?.message}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
