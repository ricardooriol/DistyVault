import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './pages/App.jsx';
import Header from './components/Header';

const root = createRoot(document.getElementById('root'));
root.render(
  <>
    <Header />
    <App />
  </>
);
