import { Routes, Route } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import AdminDashboard from './AdminDashboard';
import AdminPlaces from './AdminPlaces';
import AdminCategories from './AdminCategories';
import AdminExperiences from './AdminExperiences';
import AdminEvents from './AdminEvents';
import AdminSettings from './AdminSettings';
import AdminUsers from './AdminUsers';
import AdminUserTrips from './AdminUserTrips';
import AdminFeed from './AdminFeed';
import AdminInterests from './AdminInterests';
import AdminPlaceOwners from './AdminPlaceOwners';

export default function AdminApp() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
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
    </Routes>
  );
}
