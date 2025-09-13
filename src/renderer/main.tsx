import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles.css';

const rootNode = document.getElementById('root');

if (!rootNode) {
  throw new Error('Missing #root element');
}

createRoot(rootNode).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
