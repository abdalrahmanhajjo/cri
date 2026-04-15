import { Routes, Route, Navigate } from 'react-router-dom';
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
import AdminOffers from './AdminOffers';
import AdminEmailBroadcast from './AdminEmailBroadcast';
import AdminSponsoredPlaces from './AdminSponsoredPlaces';

export default function AdminApp() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<AdminDashboard />} />
        <Route path="places" element={<AdminPlaces />} />
        <Route path="categories" element={<AdminCategories />} />
        <Route path="dining" element={<Navigate to="/admin" replace />} />
        <Route path="hotels" element={<Navigate to="/admin" replace />} />
        <Route path="experiences" element={<AdminExperiences />} />
        <Route path="events" element={<AdminEvents />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="email-broadcast" element={<AdminEmailBroadcast />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="user-trips" element={<AdminUserTrips />} />
        <Route path="feed" element={<AdminFeed />} />
        <Route path="interests" element={<AdminInterests />} />
        <Route path="place-owners" element={<AdminPlaceOwners />} />
        <Route path="offers" element={<AdminOffers />} />
        <Route path="sponsored-places" element={<AdminSponsoredPlaces />} />
      </Route>
    </Routes>
  );
}
