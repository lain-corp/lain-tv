import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Lain TV Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(0,0,0,0.9)',
          color: '#00ff00',
          padding: '30px',
          border: '2px solid #ff0000',
          borderRadius: '10px',
          textAlign: 'center',
          fontFamily: 'Monaco, Courier New, monospace',
          maxWidth: '500px',
          zIndex: 10000
        }}>
          <h2 style={{ color: '#ff0000', marginBottom: '15px' }}>⚠️ System Error</h2>
          <p style={{ marginBottom: '10px' }}>Lain TV encountered an unexpected error.</p>
          <details style={{ marginTop: '15px', textAlign: 'left' }}>
            <summary style={{ cursor: 'pointer', color: '#00ff00' }}>Error Details</summary>
            <pre style={{ 
              background: '#000', 
              padding: '10px', 
              marginTop: '10px',
              fontSize: '12px',
              overflow: 'auto',
              maxHeight: '200px',
              border: '1px solid #333'
            }}>
              {this.state.error?.toString() || 'Unknown error'}
            </pre>
          </details>
          <button 
            onClick={() => window.location.reload()}
            style={{
              background: 'linear-gradient(135deg, #006600, #004400)',
              border: '2px solid #008800',
              color: '#fff',
              padding: '10px 20px',
              borderRadius: '5px',
              cursor: 'pointer',
              marginTop: '15px',
              fontFamily: 'inherit'
            }}
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;