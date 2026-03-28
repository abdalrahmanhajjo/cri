import { lazy } from 'react';
import { Route, Navigate } from 'react-router-dom';
import Layout from '../components/Layout';
import Explore from '../pages/Explore';

const Discover = lazy(() => import('../pages/Discover'));
const PlaceDiscover = lazy(() => import('../pages/PlaceDiscover'));
const PlaceDetail = lazy(() => import('../pages/PlaceDetail'));
const TourDetail = lazy(() => import('../pages/TourDetail'));
const EventDetail = lazy(() => import('../pages/EventDetail'));
const ActivitiesHub = lazy(() => import('../pages/ActivitiesHub'));
const BacklinkKit = lazy(() => import('../pages/BacklinkKit'));
const ThingsToDoTripoli = lazy(() =>
  import('../pages/SeoLanding').then((m) => ({ default: m.ThingsToDoTripoli }))
);
const OldCityGuide = lazy(() => import('../pages/SeoLanding').then((m) => ({ default: m.OldCityGuide })));
const SouksGuide = lazy(() => import('../pages/SeoLanding').then((m) => ({ default: m.SouksGuide })));
const SweetsGuide = lazy(() => import('../pages/SeoLanding').then((m) => ({ default: m.SweetsGuide })));
const TravelTipsTripoli = lazy(() =>
  import('../pages/SeoLanding').then((m) => ({ default: m.TravelTipsTripoli }))
);
const AboutTripoli = lazy(() => import('../pages/SeoLanding').then((m) => ({ default: m.AboutTripoli })));

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
