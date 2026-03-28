import { useEffect, useState, lazy } from 'react';
import { Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import BusinessGateLoader from '../pages/business/BusinessGateLoader';

const BusinessLayout = lazy(() => import('../pages/business/BusinessLayout'));
const BusinessDashboard = lazy(() => import('../pages/business/BusinessDashboard'));
const BusinessPlaceFeed = lazy(() => import('../pages/business/BusinessPlaceFeed'));
const BusinessPlaceEdit = lazy(() => import('../pages/business/BusinessPlaceEdit'));

function BusinessRoute({ children }) {
  const { user, loading, logout } = useAuth();
  const location = useLocation();
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

  if (loading) return <BusinessGateLoader />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname + location.search + (location.hash || '') }} replace />;
  if (apiAccess === false) return <Navigate to="/" replace />;
  if (apiAccess === null && !profileSuggestsBusiness) return <BusinessGateLoader />;
  return children;
}

function BusinessRouteWithKey({ children }) {
  const { user } = useAuth();
  return <BusinessRoute key={String(user?.id ?? 'anon')}>{children}</BusinessRoute>;
}

export const BusinessRoutes = (
  <Route path="/business" element={<BusinessRouteWithKey><BusinessLayout /></BusinessRouteWithKey>}>
    <Route index element={<BusinessDashboard />} />
    <Route path="places" element={<BusinessPlaceFeed />} />
    <Route path="places/:placeId" element={<BusinessPlaceEdit />} />
  </Route>
);
