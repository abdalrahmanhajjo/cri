import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from './ErrorBoundary';
import { SiteSettingsProvider } from './context/SiteSettingsContext';
import { ThemeProvider } from './context/ThemeContext';
import './theme.css';
import './index.css';
import App from './App.jsx';
import { reportWebVitals } from './reportWebVitals';
function getInitialTheme() {
  try {
    const stored = window.localStorage.getItem('tripoli-theme');
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

document.documentElement.dataset.theme = getInitialTheme();
reportWebVitals();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <SiteSettingsProvider>
          <App />
        </SiteSettingsProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>
);
