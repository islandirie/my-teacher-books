import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

// Request persistent storage if supported
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().then((persistent) => {
    console.log(`[Storage] Persistent storage granted: ${persistent}`);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
