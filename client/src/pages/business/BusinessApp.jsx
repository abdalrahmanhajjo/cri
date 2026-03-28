import { Routes, Route } from 'react-router-dom';
import BusinessLayout from './BusinessLayout';
import BusinessDashboard from './BusinessDashboard';
import BusinessPlaceFeed from './BusinessPlaceFeed';
import BusinessPlaceEdit from './BusinessPlaceEdit';

export default function BusinessApp() {
  return (
    <Routes>
      <Route element={<BusinessLayout />}>
        <Route index element={<BusinessDashboard />} />
        <Route path="places" element={<BusinessPlaceFeed />} />
        <Route path="places/:placeId" element={<BusinessPlaceEdit />} />
      </Route>
    </Routes>
  );
}
