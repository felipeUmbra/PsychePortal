import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './i18n';

// PWA registration - only attempt in production or when SW is available
if (import.meta.env.PROD || import.meta.env.DEV) {
  // Dynamically import to avoid errors if virtual module isn't available
  import('virtual:pwa-register').then(({ registerSW }) => {
    try {
      registerSW({ immediate: true });
    } catch {
      // Silently fail if SW isn't available (e.g., in dev mode with disabled SW)
    }
  }).catch(() => {
    // Module not available in current environment
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
