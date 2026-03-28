import { lazy } from 'react';
import { Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getToken, getStoredUser } from '../api';
import BusinessGateLoader from '../pages/business/BusinessGateLoader';

const AdminLayout = lazy(() => import('../pages/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('../pages/admin/AdminDashboard'));
const AdminPlaces = lazy(() => import('../pages/admin/AdminPlaces'));
const AdminCategories = lazy(() => import('../pages/admin/AdminCategories'));
const AdminExperiences = lazy(() => import('../pages/admin/AdminExperiences'));
const AdminEvents = lazy(() => import('../pages/admin/AdminEvents'));
const AdminSettings = lazy(() => import('../pages/admin/AdminSettings'));
const AdminUsers = lazy(() => import('../pages/admin/AdminUsers'));
const AdminUserTrips = lazy(() => import('../pages/admin/AdminUserTrips'));
const AdminFeed = lazy(() => import('../pages/admin/AdminFeed'));
const AdminInterests = lazy(() => import('../pages/admin/AdminInterests'));
const AdminPlaceOwners = lazy(() => import('../pages/admin/AdminPlaceOwners'));

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

export const AdminRoutes = (
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
);
