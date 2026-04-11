import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from './ErrorBoundary';
import { SiteSettingsProvider } from './context/SiteSettingsContext';
import './theme.css';
import './index.css';
import App from './App.jsx';
import { reportWebVitals } from './reportWebVitals';
document.documentElement.dataset.theme = 'light';
document.documentElement.style.colorScheme = 'light';
reportWebVitals();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <SiteSettingsProvider>
        <App />
      </SiteSettingsProvider>
    </ErrorBoundary>
  </StrictMode>
);
