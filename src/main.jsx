import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Initialize global DV object for legacy compatibility during migration
// This will be removed in Phase 3
window.DV = window.DV || {};
window.DV.version = '0.4.0';

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
