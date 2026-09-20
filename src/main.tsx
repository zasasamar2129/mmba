import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { getInitialTheme, applyTheme } from './lib/theme';
import { ErrorBoundary } from './components/common/ErrorBoundary';

// Initialize and apply persistent theme mode on load
applyTheme(getInitialTheme());

// Register Service Worker for PWA + Web Push
// Development: service worker isolated, no stale assets
// Production: full PWA behavior with update management
if ('serviceWorker' in navigator && process.env.NODE_ENV !== 'test') {
  const SW_URL = '/sw.js';
  const SW_SCOPE = '/';

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });

      // Handle updates: notify user when new version available
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // New version available — the app should prompt the user to update
              window.dispatchEvent(new Event('mmba-sw-update-available'));
            } else {
              // First install — content is cached for offline use
              window.dispatchEvent(new Event('mmba-sw-installed'));
            }
          }
        });
      });

      // Check for updates periodically (every 60 seconds in production)
      if (process.env.NODE_ENV === 'production') {
        setInterval(() => {
          registration.update().catch((err) => {
            console.warn('[SW] Update check failed:', err);
          });
        }, 60 * 1000);
      }

      // Handle controller change (new SW took over)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.dispatchEvent(new Event('mmba-sw-controller-change'));
      });

      console.log('[SW] Service Worker registered:', registration.scope);
    } catch (err) {
      console.warn('[SW] Service Worker registration failed:', err);
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
