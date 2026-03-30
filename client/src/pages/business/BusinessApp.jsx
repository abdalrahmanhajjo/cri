import { Routes, Route } from 'react-router-dom';
import BusinessLayout from './BusinessLayout';
import BusinessDashboard from './BusinessDashboard';
import BusinessPlaceFeed from './BusinessPlaceFeed';
import BusinessPlaceEdit from './BusinessPlaceEdit';
import BusinessSponsorship from './BusinessSponsorship';
import BusinessSponsorshipSuccess from './BusinessSponsorshipSuccess';

export default function BusinessApp() {
  return (
    <Routes>
      <Route element={<BusinessLayout />}>
        <Route index element={<BusinessDashboard />} />
        <Route path="sponsorship" element={<BusinessSponsorship />} />
        <Route path="sponsorship/success" element={<BusinessSponsorshipSuccess />} />
        <Route path="places" element={<BusinessPlaceFeed />} />
        <Route path="places/:placeId" element={<BusinessPlaceEdit />} />
      </Route>
    </Routes>
  );
}
