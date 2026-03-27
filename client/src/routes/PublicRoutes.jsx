import { Route, Navigate } from 'react-router-dom';
import Layout from '../components/Layout';
import Explore from '../pages/Explore';
import Discover from '../pages/Discover';
import PlaceDiscover from '../pages/PlaceDiscover';
import PlaceDetail from '../pages/PlaceDetail';
import TourDetail from '../pages/TourDetail';
import EventDetail from '../pages/EventDetail';
import ActivitiesHub from '../pages/ActivitiesHub';
import BacklinkKit from '../pages/BacklinkKit';
import {
  ThingsToDoTripoli,
  OldCityGuide,
  SouksGuide,
  SweetsGuide,
  TravelTipsTripoli,
  AboutTripoli,
} from '../pages/SeoLanding';

/** Old /discover/place/:id links -> /community/place/:id */
const LegacyDiscoverPlaceRedirect = () => {
  const { placeId } = window.location.pathname.split('/').pop();
  return <Navigate to={`/community/place/${placeId}`} replace />;
};

export const PublicRoutes = (
  <Route path="/" element={<Layout />}>
    <Route index element={<Explore />} />
    <Route path="community/place/:placeId" element={<Discover />} />
    <Route path="community" element={<Discover />} />
    <Route path="discover" element={<PlaceDiscover />} />
    <Route path="spots" element={<Navigate to="/discover" replace />} />
    <Route path="activities" element={<ActivitiesHub />} />
    <Route path="experiences" element={<Navigate to="/activities" replace />} />
    <Route path="events" element={<Navigate to="/activities?tab=events" replace />} />
    <Route path="place/:id" element={<PlaceDetail />} />
    <Route path="tour/:id" element={<TourDetail />} />
    <Route path="event/:id" element={<EventDetail />} />
    <Route path="things-to-do-in-tripoli-lebanon" element={<ThingsToDoTripoli />} />
    <Route path="tripoli-old-city-guide" element={<OldCityGuide />} />
    <Route path="tripoli-souks-guide" element={<SouksGuide />} />
    <Route path="best-sweets-in-tripoli" element={<SweetsGuide />} />
    <Route path="tripoli-travel-tips" element={<TravelTipsTripoli />} />
    <Route path="about-tripoli" element={<AboutTripoli />} />
    <Route path="partner-link-kit" element={<BacklinkKit />} />
  </Route>
);
