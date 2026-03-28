import { Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import RoutePageFallback from './components/RoutePageFallback';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { SiteSettingsProvider } from './context/SiteSettingsContext';
import ScrollToTop from './components/ScrollToTop';
import {
  PublicRoutes,
  AuthRoutes,
  UserRoutes,
  AdminRoutes,
  BusinessRoutes
} from './routes';
import { trackEvent } from './utils/analytics';

function AppRoutes() {
  const { user } = useAuth();
  
  useEffect(() => {
    trackEvent(user, 'app_start', { timestamp: new Date().toISOString() });
  }, [user]);

  return (
    <Suspense fallback={<RoutePageFallback />}>
      <Routes>
        {BusinessRoutes}
        {AdminRoutes}
        {AuthRoutes}
        {UserRoutes}
        {PublicRoutes}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <SiteSettingsProvider>
        <LanguageProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </LanguageProvider>
      </SiteSettingsProvider>
    </BrowserRouter>
  );
}
