import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import Layout from './components/Layout';
import ScrollToTop from './components/ScrollToTop';
import Explore from './pages/Explore';
import MapPage from './pages/Map';
import Trips from './pages/Trips';
import Favourites from './pages/Favourites';
import Profile from './pages/Profile';
import Login from './pages/Login';
import Register from './pages/Register';
import PlaceDetail from './pages/PlaceDetail';
import TourDetail from './pages/TourDetail';
import EventDetail from './pages/EventDetail';
import ForgotPassword from './pages/ForgotPassword';
import Spots from './pages/Spots';
import Experiences from './pages/Experiences';
import Events from './pages/Events';
import Plan from './pages/Plan';
import FindYourWay from './pages/FindYourWay';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminPlaces from './pages/admin/AdminPlaces';
import AdminCategories from './pages/admin/AdminCategories';
import AdminExperiences from './pages/admin/AdminExperiences';
import AdminEvents from './pages/admin/AdminEvents';
import AdminSettings from './pages/admin/AdminSettings';
import AdminContent from './pages/admin/AdminContent';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div style={{ padding: 24, textAlign: 'center' }}>Loading…</div>;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname + location.search + (location.hash || '') }} replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Admin: login required – no page opens without auth */}
      <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
        <Route index element={<AdminDashboard />} />
        <Route path="places" element={<AdminPlaces />} />
        <Route path="categories" element={<AdminCategories />} />
        <Route path="experiences" element={<AdminExperiences />} />
        <Route path="events" element={<AdminEvents />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="content" element={<AdminContent />} />
      </Route>
      {/* Auth pages */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      {/* Main app with nav */}
      <Route path="/" element={<Layout />}>
        <Route index element={<Explore />} />
        <Route path="map" element={<ProtectedRoute><MapPage /></ProtectedRoute>} />
        <Route path="spots" element={<Spots />} />
        <Route path="experiences" element={<Experiences />} />
        <Route path="events" element={<Events />} />
        <Route path="plan" element={<ProtectedRoute><Plan /></ProtectedRoute>} />
        <Route path="ways" element={<FindYourWay />} />
        <Route path="place/:id" element={<PlaceDetail />} />
        <Route path="tour/:id" element={<TourDetail />} />
        <Route path="event/:id" element={<EventDetail />} />
        <Route path="trips" element={<ProtectedRoute><Trips /></ProtectedRoute>} />
        <Route path="favourites" element={<ProtectedRoute><Favourites /></ProtectedRoute>} />
        <Route path="profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <LanguageProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}
