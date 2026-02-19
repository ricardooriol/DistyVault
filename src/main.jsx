import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import './core/utils';
import './core/eventBus';
import './core/toast';
import './core/db';
import './core/queue';
import './ai/service'; // Assuming it registers AI providers


// Initialize global DV object for legacy compatibility during migration
// This will be removed in Phase 3
window.DV = window.DV || {};
window.DV.version = '0.4.0';

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
