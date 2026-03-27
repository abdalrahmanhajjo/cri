import { Route, Navigate, useLocation } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import BusinessGateLoader from '../pages/business/BusinessGateLoader';
import Profile from '../pages/Profile';
import Trips from '../pages/Trips';
import TripDetail from '../pages/TripDetail';
import Favourites from '../pages/Favourites';
import Messages from '../pages/Messages';
import Plan from '../pages/Plan';
import AiPlanner from '../pages/AiPlanner';

const MapPage = lazy(() => import('../pages/Map'));

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <BusinessGateLoader message="Loading…" />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname + location.search + (location.hash || '') }} replace />;
  return children;
}

export const UserRoutes = (
  <Route path="/" element={<Layout />}>
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
    <Route path="plan/ai" element={<ProtectedRoute><AiPlanner /></ProtectedRoute>} />
    <Route path="plan" element={<ProtectedRoute><Plan /></ProtectedRoute>} />
    <Route path="trips/:tripId" element={<ProtectedRoute><TripDetail /></ProtectedRoute>} />
    <Route path="trips" element={<ProtectedRoute><Trips /></ProtectedRoute>} />
    <Route path="favourites" element={<ProtectedRoute><Favourites /></ProtectedRoute>} />
    <Route path="messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
    <Route path="messages/:placeId" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
    <Route path="profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
  </Route>
);
