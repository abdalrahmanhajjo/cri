import { Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getToken, getStoredUser } from '../api';
import BusinessGateLoader from '../pages/business/BusinessGateLoader';
import AdminLayout from '../pages/admin/AdminLayout';
import AdminDashboard from '../pages/admin/AdminDashboard';
import AdminPlaces from '../pages/admin/AdminPlaces';
import AdminCategories from '../pages/admin/AdminCategories';
import AdminExperiences from '../pages/admin/AdminExperiences';
import AdminEvents from '../pages/admin/AdminEvents';
import AdminSettings from '../pages/admin/AdminSettings';
import AdminUsers from '../pages/admin/AdminUsers';
import AdminUserTrips from '../pages/admin/AdminUserTrips';
import AdminFeed from '../pages/admin/AdminFeed';
import AdminInterests from '../pages/admin/AdminInterests';
import AdminPlaceOwners from '../pages/admin/AdminPlaceOwners';

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
