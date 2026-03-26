import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import api, { getToken, getStoredUser } from './api/client';
import Layout from './components/Layout';
import ScrollToTop from './components/ScrollToTop';
import Explore from './pages/Explore';
import Discover from './pages/Discover';
import Messages from './pages/Messages';
import MapPage from './pages/Map';
import Trips from './pages/Trips';
import TripDetail from './pages/TripDetail';
import Favourites from './pages/Favourites';
import Profile from './pages/Profile';
import Login from './pages/Login';
import Register from './pages/Register';
import PlaceDetail from './pages/PlaceDetail';
import TourDetail from './pages/TourDetail';
import EventDetail from './pages/EventDetail';
import ForgotPassword from './pages/ForgotPassword';
import VerifyEmail from './pages/VerifyEmail';
import ActivitiesHub from './pages/ActivitiesHub';
import Plan from './pages/Plan';
import AiPlanner from './pages/AiPlanner';
import PlaceDiscover from './pages/PlaceDiscover';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminPlaces from './pages/admin/AdminPlaces';
import AdminCategories from './pages/admin/AdminCategories';
import AdminExperiences from './pages/admin/AdminExperiences';
import AdminEvents from './pages/admin/AdminEvents';
import AdminSettings from './pages/admin/AdminSettings';
import AdminUsers from './pages/admin/AdminUsers';
import AdminUserTrips from './pages/admin/AdminUserTrips';
import AdminFeed from './pages/admin/AdminFeed';
import AdminInterests from './pages/admin/AdminInterests';
import AdminPlaceOwners from './pages/admin/AdminPlaceOwners';
import BusinessLayout from './pages/business/BusinessLayout';
import BusinessDashboard from './pages/business/BusinessDashboard';
import BusinessPlaceEdit from './pages/business/BusinessPlaceEdit';
import BusinessPlaceFeed from './pages/business/BusinessPlaceFeed';
import BusinessGateLoader from './pages/business/BusinessGateLoader';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <BusinessGateLoader message="Loading…" />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname + location.search + (location.hash || '') }} replace />;
  return children;
}

/** Web + app shared admin (requires users.is_admin or ADMIN_EMAILS on server). */
function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const hasCachedAdminSession =
    typeof window !== 'undefined' && Boolean(getToken() && getStoredUser()?.isAdmin === true);
  if (loading && !hasCachedAdminSession) {
    return <BusinessGateLoader message="Loading admin console…" />;
  }
  if (!user) return <Navigate to="/login" state={{ from: location.pathname + location.search + (location.hash || '') }} replace />;
  if (!user.isAdmin) return <Navigate to="/" replace />;
  return children;
}

/** Place owners: not admin; profile hints + GET /api/business/me confirms access. */
function BusinessRoute({ children }) {
  const { user, loading, logout } = useAuth();
  const location = useLocation();
  /** null = verifying; true = ok; false = forbidden */
  const [apiAccess, setApiAccess] = useState(null);

  const profileSuggestsBusiness =
    user?.isBusinessOwner === true || (user?.ownedPlaceCount ?? 0) > 0;

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    api.business
      .me()
      .then(() => {
        if (!cancelled) setApiAccess(true);
      })
      .catch((e) => {
        if (cancelled) return;
        if (e.status === 401) logout();
        setApiAccess(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, loading, logout]);

  if (loading) {
    return <BusinessGateLoader />;
  }
  if (!user) return <Navigate to="/login" state={{ from: location.pathname + location.search + (location.hash || '') }} replace />;
  if (apiAccess === false) return <Navigate to="/" replace />;
  if (apiAccess === null && !profileSuggestsBusiness) {
    return <BusinessGateLoader />;
  }
  return children;
}

/** Remount gate when account changes so `apiAccess` state cannot leak across users. */
function BusinessRouteWithKey({ children }) {
  const { user } = useAuth();
  return <BusinessRoute key={String(user?.id ?? 'anon')}>{children}</BusinessRoute>;
}

/** Old `/discover/place/:id` links → `/community/place/:id`. */
function LegacyDiscoverPlaceRedirect() {
  const { placeId } = useParams();
  return <Navigate to={`/community/place/${placeId}`} replace />;
}

/** Old `/ways#…` links → `/discover` (theme hash no longer used). */
function WaysLegacyRedirect() {
  return <Navigate to="/discover" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/business" element={<BusinessRouteWithKey><BusinessLayout /></BusinessRouteWithKey>}>
        <Route index element={<BusinessDashboard />} />
        <Route path="places" element={<BusinessPlaceFeed />} />
        <Route path="places/:placeId" element={<BusinessPlaceEdit />} />
      </Route>
      {/* Admin: login required – no page opens without auth */}
      <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
        <Route index element={<AdminDashboard />} />
        <Route path="places" element={<AdminPlaces />} />
        <Route path="categories" element={<AdminCategories />} />
        <Route path="experiences" element={<AdminExperiences />} />
        <Route path="events" element={<AdminEvents />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="user-trips" element={<AdminUserTrips />} />
        <Route path="feed" element={<AdminFeed />} />
        <Route path="interests" element={<AdminInterests />} />
        <Route path="place-owners" element={<AdminPlaceOwners />} />
      </Route>
      {/* Auth pages */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      {/* Main app with nav */}
      <Route path="/" element={<Layout />}>
        <Route index element={<Explore />} />
        <Route path="community/place/:placeId" element={<Discover />} />
        <Route path="community" element={<Discover />} />
        <Route path="discover/place/:placeId" element={<LegacyDiscoverPlaceRedirect />} />
        <Route path="discover" element={<PlaceDiscover />} />
        <Route path="map" element={<ProtectedRoute><MapPage /></ProtectedRoute>} />
        <Route path="spots" element={<Navigate to="/discover" replace />} />
        <Route path="activities" element={<ActivitiesHub />} />
        <Route path="experiences" element={<Navigate to="/activities" replace />} />
        <Route path="events" element={<Navigate to="/activities?tab=events" replace />} />
        <Route path="plan/ai" element={<ProtectedRoute><AiPlanner /></ProtectedRoute>} />
        <Route path="plan" element={<ProtectedRoute><Plan /></ProtectedRoute>} />
        <Route path="ways" element={<WaysLegacyRedirect />} />
        <Route path="place/:id" element={<PlaceDetail />} />
        <Route path="tour/:id" element={<TourDetail />} />
        <Route path="event/:id" element={<EventDetail />} />
        <Route path="trips/:tripId" element={<ProtectedRoute><TripDetail /></ProtectedRoute>} />
        <Route path="trips" element={<ProtectedRoute><Trips /></ProtectedRoute>} />
        <Route path="favourites" element={<ProtectedRoute><Favourites /></ProtectedRoute>} />
        <Route path="messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
        <Route path="messages/:placeId" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
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
