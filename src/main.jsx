import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { initEmbedHeight } from './utils/embedHeight';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// After render, so there is a .slide-container to measure.
initEmbedHeight();
