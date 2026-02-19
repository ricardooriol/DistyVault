import React from 'react';

export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, info) {
        console.error('DistyVault ErrorBoundary caught:', error, info);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
                    <div style={{ textAlign: 'center', maxWidth: 480 }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>Something went wrong</h1>
                        <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
                            {String(this.state.error?.message || 'An unexpected error occurred.')}
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            style={{ padding: '0.5rem 1.5rem', borderRadius: '0.5rem', background: '#6d28d9', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '1rem' }}
                        >
                            Reload
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}
