import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './renderer/App.js';
import './renderer/theme.css';

const container = document.getElementById('root');
if (!container) throw new Error('#root element not found');

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
