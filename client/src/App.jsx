import { useEffect, useState, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { FavouritesProvider } from './context/FavouritesContext';
import { LanguageProvider } from './context/LanguageContext';
import { ToastProvider } from './context/ToastContext';
import api, { getToken, getStoredUser } from './api/client';
import Layout from './components/Layout';
import ScrollToTop from './components/ScrollToTop';
import Explore from './pages/Explore';
import BusinessGateLoader from './pages/business/BusinessGateLoader';

const MapPage = lazy(() => import('./pages/Map'));
const AdminApp = lazy(() => import('./pages/admin/AdminApp'));
const BusinessApp = lazy(() => import('./pages/business/BusinessApp'));

const Discover = lazy(() => import('./pages/Discover'));
const CommunityCreate = lazy(() => import('./pages/CommunityCreate'));
const PlaceDiscover = lazy(() => import('./pages/PlaceDiscover'));
const PlaceDetail = lazy(() => import('./pages/PlaceDetail'));
const TourDetail = lazy(() => import('./pages/TourDetail'));
const EventDetail = lazy(() => import('./pages/EventDetail'));
const Trips = lazy(() => import('./pages/Trips'));
const TripDetail = lazy(() => import('./pages/TripDetail'));
const Favourites = lazy(() => import('./pages/Favourites'));
const Messages = lazy(() => import('./pages/Messages'));
const Plan = lazy(() => import('./pages/Plan'));
const AiPlanner = lazy(() => import('./pages/AiPlanner'));
const ActivitiesHub = lazy(() => import('./pages/ActivitiesHub'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const BacklinkKit = lazy(() => import('./pages/BacklinkKit'));
const Profile = lazy(() => import('./pages/Profile'));

const ThingsToDoTripoli = lazy(() =>
  import('./pages/SeoLanding').then((m) => ({ default: m.ThingsToDoTripoli }))
);
const OldCityGuide = lazy(() => import('./pages/SeoLanding').then((m) => ({ default: m.OldCityGuide })));
const SouksGuide = lazy(() => import('./pages/SeoLanding').then((m) => ({ default: m.SouksGuide })));
const SweetsGuide = lazy(() => import('./pages/SeoLanding').then((m) => ({ default: m.SweetsGuide })));
const TravelTipsTripoli = lazy(() =>
  import('./pages/SeoLanding').then((m) => ({ default: m.TravelTipsTripoli }))
);
const AboutTripoli = lazy(() => import('./pages/SeoLanding').then((m) => ({ default: m.AboutTripoli })));

function LazyBoundary({ children, message = 'Loading…' }) {
  return <Suspense fallback={<BusinessGateLoader message={message} />}>{children}</Suspense>;
}

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
      <Route
        path="/business/*"
        element={
          <BusinessRouteWithKey>
            <Suspense fallback={<BusinessGateLoader />}>
              <BusinessApp />
            </Suspense>
          </BusinessRouteWithKey>
        }
      />
      <Route
        path="/admin/*"
        element={
          <AdminRoute>
            <Suspense fallback={<BusinessGateLoader message="Loading admin…" />}>
              <AdminApp />
            </Suspense>
          </AdminRoute>
        }
      />
      <Route path="/login" element={<LazyBoundary message="Loading…"><Login /></LazyBoundary>} />
      <Route path="/register" element={<LazyBoundary message="Loading…"><Register /></LazyBoundary>} />
      <Route
        path="/forgot-password"
        element={<LazyBoundary message="Loading…"><ForgotPassword /></LazyBoundary>}
      />
      <Route path="/verify-email" element={<LazyBoundary message="Loading…"><VerifyEmail /></LazyBoundary>} />
      <Route path="/" element={<Layout />}>
        <Route index element={<Explore />} />
        <Route
          path="community/place/:placeId"
          element={<LazyBoundary message="Loading…"><Discover /></LazyBoundary>}
        />
        <Route path="community" element={<LazyBoundary message="Loading…"><Discover /></LazyBoundary>} />
        <Route
          path="community/create"
          element={
            <ProtectedRoute>
              <LazyBoundary message="Loading…"><CommunityCreate /></LazyBoundary>
            </ProtectedRoute>
          }
        />
        <Route path="discover/place/:placeId" element={<LegacyDiscoverPlaceRedirect />} />
        <Route
          path="discover"
          element={<LazyBoundary message="Loading…"><PlaceDiscover /></LazyBoundary>}
        />
        <Route path="dining" element={<Navigate to="/discover" replace />} />
        <Route path="hotels" element={<Navigate to="/discover" replace />} />
        <Route
          path="map"
          element={
            <ProtectedRoute>
              <Suspense fallback={<BusinessGateLoader message="Loading map…" />}>
                <MapPage />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route path="spots" element={<Navigate to="/discover" replace />} />
        <Route
          path="activities"
          element={<LazyBoundary message="Loading…"><ActivitiesHub /></LazyBoundary>}
        />
        <Route path="experiences" element={<Navigate to="/activities" replace />} />
        <Route path="events" element={<Navigate to="/activities?tab=events" replace />} />
        <Route
          path="plan/ai"
          element={
            <ProtectedRoute>
              <LazyBoundary message="Loading…"><AiPlanner /></LazyBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="plan"
          element={
            <ProtectedRoute>
              <LazyBoundary message="Loading…"><Plan /></LazyBoundary>
            </ProtectedRoute>
          }
        />
        <Route path="ways" element={<WaysLegacyRedirect />} />
        <Route
          path="place/:id"
          element={<LazyBoundary message="Loading…"><PlaceDetail /></LazyBoundary>}
        />
        <Route
          path="tour/:id"
          element={<LazyBoundary message="Loading…"><TourDetail /></LazyBoundary>}
        />
        <Route
          path="event/:id"
          element={<LazyBoundary message="Loading…"><EventDetail /></LazyBoundary>}
        />
        <Route
          path="things-to-do-in-tripoli-lebanon"
          element={<LazyBoundary message="Loading…"><ThingsToDoTripoli /></LazyBoundary>}
        />
        <Route
          path="tripoli-old-city-guide"
          element={<LazyBoundary message="Loading…"><OldCityGuide /></LazyBoundary>}
        />
        <Route path="tripoli-souks-guide" element={<LazyBoundary message="Loading…"><SouksGuide /></LazyBoundary>} />
        <Route path="best-sweets-in-tripoli" element={<LazyBoundary message="Loading…"><SweetsGuide /></LazyBoundary>} />
        <Route
          path="tripoli-travel-tips"
          element={<LazyBoundary message="Loading…"><TravelTipsTripoli /></LazyBoundary>}
        />
        <Route path="about-tripoli" element={<LazyBoundary message="Loading…"><AboutTripoli /></LazyBoundary>} />
        <Route path="partner-link-kit" element={<LazyBoundary message="Loading…"><BacklinkKit /></LazyBoundary>} />
        <Route
          path="trips/:tripId"
          element={
            <ProtectedRoute>
              <LazyBoundary message="Loading…"><TripDetail /></LazyBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="trips"
          element={
            <ProtectedRoute>
              <LazyBoundary message="Loading…"><Trips /></LazyBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="favourites"
          element={
            <ProtectedRoute>
              <LazyBoundary message="Loading…"><Favourites /></LazyBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="messages"
          element={
            <ProtectedRoute>
              <LazyBoundary message="Loading…"><Messages /></LazyBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="messages/:placeId"
          element={
            <ProtectedRoute>
              <LazyBoundary message="Loading…"><Messages /></LazyBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="profile"
          element={
            <ProtectedRoute>
              <LazyBoundary message="Loading…">
                <Profile />
              </LazyBoundary>
            </ProtectedRoute>
          }
        />
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
        <ToastProvider>
          <AuthProvider>
            <FavouritesProvider>
              <AppRoutes />
            </FavouritesProvider>
          </AuthProvider>
        </ToastProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}
