import { useEffect } from 'react';
import { BrowserRouter, Routes, Navigate } from 'react-router-dom';
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
    <Routes>
      {BusinessRoutes}
      {AdminRoutes}
      {AuthRoutes}
      {UserRoutes}
      {PublicRoutes}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
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
