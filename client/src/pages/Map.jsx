import { useState, useEffect, useRef, useCallback, useMemo, useDeferredValue } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import api, { getPlaceImageUrl } from '../api/client';
import { getDeliveryImgProps } from '../utils/responsiveImages.js';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import Icon from '../components/Icon';
import DeliveryImg from '../components/DeliveryImg';
import GlobalSearchBar from '../components/GlobalSearchBar';
import { filterPlacesByQuery } from '../utils/searchFilter';
import { filterGeneralDirectoryPlaces } from '../utils/placeGuideExclusions';
import { asyncPool } from '../utils/asyncPool';
import { loadGoogleMapsScript } from '../utils/mapGoogleLoader';
import { placeIdsFromDay, getDateForDayIndex } from '../utils/tripPlannerHelpers';
import './Map.css';
import './Explore.css';

// Same reference as Flutter `lib/map/tripoli_geo.dart` + `map_constants.dart` (VisitTripoliApp)
const TRIPOLI_CENTER = { lat: 34.43692, lng: 35.83846 };
const DEFAULT_ZOOM = 14;
const DETAIL_MAP_ZOOM = 15;
const MAP_FIT_PADDING = 64;
const PLACES_REGION = 'Tripoli, Lebanon';
const GOOGLE_PLACES_CONCURRENCY = 3;
const GOOGLE_PLACES_DELAY_MS = 200;
/** Car & walking only (matches product request; avoids transit/bike in web nav). */
const TRAVEL_MODES = Object.freeze([
  { id: 'DRIVING', icon: 'car', labelKey: 'travelModeCar' },
  { id: 'WALKING', icon: 'walking', labelKey: 'travelModeWalk' },
]);

const LIVE_ROUTE_MIN_INTERVAL_MS = 12000;
const LIVE_ROUTE_MIN_MOVE_M = 20;

function formatMapDistanceM(meters) {
  if (!Number.isFinite(meters)) return '';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function haversineMeters(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return 0;
  const R = 6371000;
  const phi1 = (Number(a.lat) * Math.PI) / 180;
  const phi2 = (Number(b.lat) * Math.PI) / 180;
  const deltaPhi = ((Number(b.lat) - Number(a.lat)) * Math.PI) / 180;
  const deltaLambda = ((Number(b.lng) - Number(a.lng)) * Math.PI) / 180;
  const x =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(Math.max(0, 1 - x)));
}

function isLikelySafari() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /safari/i.test(ua) && !/(chrome|chromium|crios|android|edg|opr|opera|fxios|firefox)/i.test(ua);
}

function isIosDevice() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/i.test(ua);
}

/** Redesign turn-by-turn icons: simpler, more visual. */
function getTurnIcon(instrHtml) {
  const t = stripHtml(instrHtml || '').toLowerCase();
  if (t.includes('roundabout')) return 'roundabout_right';
  if (t.includes('u-turn')) return 'u_turn_left';
  if (t.includes('left')) return 'turn_left';
  if (t.includes('right')) return 'turn_right';
  if (t.includes('slight left')) return 'turn_slight_left';
  if (t.includes('slight right')) return 'turn_slight_right';
  if (t.includes('keep left')) return 'navigation';
  if (t.includes('keep right')) return 'navigation';
  if (t.includes('exit')) return 'exit_to_app';
  if (t.includes('at the next')) return 'straight';
  if (t.includes('destination')) return 'place';
  return 'navigation';
}

function getCurrentPositionAsync(options) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(Object.assign(new Error('Geolocation unsupported'), { code: 0 }));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

async function getCurrentPositionWithSafariFallback() {
  const primary = { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 };
  try {
    return await getCurrentPositionAsync(primary);
  } catch (err) {
    // Safari can fail first attempt with strict options even when location access is available.
    if (!isLikelySafari()) throw err;
    const fallback = { enableHighAccuracy: false, timeout: 20000, maximumAge: 120000 };
    return getCurrentPositionAsync(fallback);
  }
}

function getFirstWatchPosition(options = {}, timeoutMs = 25000) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(Object.assign(new Error('Geolocation unsupported'), { code: 0 }));
      return;
    }
    let settled = false;
    let watchId = null;
    const finish = (cb, value) => {
      if (settled) return;
      settled = true;
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      cb(value);
    };
    const timer = window.setTimeout(() => {
      const timeoutError = Object.assign(new Error('Geolocation watch timed out'), { code: 3 });
      finish(reject, timeoutError);
    }, timeoutMs);
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        window.clearTimeout(timer);
        finish(resolve, pos);
      },
      (err) => {
        window.clearTimeout(timer);
        finish(reject, err);
      },
      options
    );
  });
}

function formatGeoErrorDebug(err) {
  if (!err) return '';
  const code = err?.code != null ? String(err.code) : '';
  const msg = err?.message ? String(err.message).trim() : '';
  if (code && msg) return `code ${code}: ${msg}`;
  if (code) return `code ${code}`;
  if (msg) return msg;
  return '';
}

function isPermissionDeniedError(err) {
  const code = err?.code;
  const msg = String(err?.message || '').toLowerCase();
  return code === 1 || msg.includes('denied') || msg.includes('permission');
}

function stripHtml(html) {
  if (!html || typeof html !== 'string') return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || div.innerText || '').trim();
}

function formatRouteDuration(seconds) {
  if (seconds == null || !Number.isFinite(seconds)) return '';
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

function formatRouteDistance(meters) {
  if (meters == null || !Number.isFinite(meters)) return '';
  const km = meters / 1000;
  return km >= 1 ? `${Number(km.toFixed(1))} km` : `${Math.round(meters)} m`;
}

function buildChromeAppUrl(url) {
  if (!url || typeof url !== 'string') return '';
  if (url.startsWith('https://')) return `googlechromes://${url.slice('https://'.length)}`;
  if (url.startsWith('http://')) return `googlechrome://${url.slice('http://'.length)}`;
  return '';
}

function buildChromeMapHandoffUrl({
  baseUrl,
  handoffCode,
  tripIds,
  tripName,
  travelMode,
  autoStart = true,
}) {
  const url = new URL(baseUrl);
  if (handoffCode) url.searchParams.set('handoff', handoffCode);
  if (Array.isArray(tripIds) && tripIds.length > 0) {
    url.searchParams.set('tripIds', tripIds.map(String).join(','));
    if (tripName) url.searchParams.set('tripName', tripName);
    if (travelMode === 'WALKING' || travelMode === 'DRIVING') {
      url.searchParams.set('mode', travelMode);
    }
  }
  if (autoStart) url.searchParams.set('autostart', '1');
  return url.toString();
}

function getDateForDayLabel(startDate, dayIndex) {
  const ymd = getDateForDayIndex(startDate, dayIndex);
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * When driving with traffic, Directions may return several routes. Google Maps picks the
 * best current-traffic option; put that route first so the polyline + legs match that choice.
 */
function reorderRoutesByFastestTraffic(directionsResult, isDriving) {
  const routes = directionsResult?.routes;
  if (!isDriving || !routes || routes.length <= 1) return directionsResult;

  const routeTrafficSeconds = (route) => {
    let total = 0;
    for (const leg of route.legs || []) {
      const v = leg.duration_in_traffic?.value ?? leg.duration?.value;
      if (v != null && Number.isFinite(v)) total += v;
    }
    return total;
  };

  let bestIdx = 0;
  let bestSecs = routeTrafficSeconds(routes[0]);
  for (let i = 1; i < routes.length; i++) {
    const secs = routeTrafficSeconds(routes[i]);
    if (secs > 0 && (bestSecs <= 0 || secs < bestSecs)) {
      bestSecs = secs;
      bestIdx = i;
    }
  }
  if (bestIdx === 0) return directionsResult;

  const best = routes[bestIdx];
  const rest = routes.filter((_, i) => i !== bestIdx);
  return { ...directionsResult, routes: [best, ...rest] };
}

function getRouteSummary(directionsResult) {
  const route = directionsResult?.routes?.[0];
  if (!route?.legs?.length) return null;
  let totalDuration = 0;
  let totalDistance = 0;
  let viaText = '';
  const steps = [];
  for (const leg of route.legs) {
    const durVal =
      leg.duration_in_traffic?.value != null ? leg.duration_in_traffic.value : leg.duration?.value;
    if (durVal) totalDuration += durVal;
    if (leg.distance?.value) totalDistance += leg.distance.value;
    if (leg.steps?.length) {
      for (const step of leg.steps) {
        if (step?.instructions) {
          const text = stripHtml(step.instructions);
          if (text) steps.push(text);
        }
        if (!viaText && step?.instructions) viaText = stripHtml(step.instructions);
      }
    }
  }
  return {
    duration: totalDuration,
    distance: totalDistance,
    durationText: formatRouteDuration(totalDuration),
    distanceText: formatRouteDistance(totalDistance),
    via: viaText,
    steps,
  };
}

/** Find place by name – returns place_id and basic info from Google Places */
function findPlaceFromText(query, apiKey) {
  const input = encodeURIComponent(query.trim() || PLACES_REGION);
  const fields = 'place_id,name,formatted_address,geometry';
  return fetch(
    `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${input}&inputtype=textquery&fields=${fields}&key=${encodeURIComponent(apiKey)}`
  )
    .then((r) => r.json())
    .then((data) => {
      const c = data.candidates?.[0];
      if (!c?.place_id) return null;
      const loc = c.geometry?.location;
      return {
        place_id: c.place_id,
        name: c.name ?? null,
        formatted_address: c.formatted_address ?? null,
        lat: loc?.lat ?? null,
        lng: loc?.lng ?? null,
      };
    })
    .catch(() => null);
}

/** Get full place details from Google (rating, photo, hours, contacts, etc.) */
function getPlaceDetails(placeId, apiKey) {
  const fields = 'name,formatted_address,geometry,rating,user_ratings_total,photos,opening_hours,website,formatted_phone_number,url';
  return fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=${fields}&key=${encodeURIComponent(apiKey)}`
  )
    .then((r) => r.json())
    .then((data) => {
      const r = data.result;
      if (!r) return null;
      const loc = r.geometry?.location;
      const photo = r.photos?.[0];
      return {
        name: r.name ?? null,
        formatted_address: r.formatted_address ?? null,
        lat: loc?.lat ?? null,
        lng: loc?.lng ?? null,
        rating: r.rating ?? null,
        user_ratings_total: r.user_ratings_total ?? null,
        photo_reference: photo?.photo_reference ?? null,
        opening_hours: r.opening_hours || null,
        website: r.website || null,
        formatted_phone_number: r.formatted_phone_number || null,
        url: r.url || null,
      };
    })
    .catch(() => null);
}

/** Build Google Place Photo URL */
function placePhotoUrl(photoReference, apiKey, maxWidth = 320) {
  if (!photoReference || !apiKey) return '';
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${encodeURIComponent(photoReference)}&key=${encodeURIComponent(apiKey)}`;
}

function escapeHtml(s) {
  if (s == null) return '';
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

export default function MapPage() {
  const { lang, t } = useLanguage();
  const { applySession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const langParam = lang === 'ar' ? 'ar' : lang === 'fr' ? 'fr' : 'en';
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  /** Google Maps script / API load failures only — never geolocation (see myLocationNotice). */
  const [mapError, setMapError] = useState(null);
  /** My location FAB: permission or timeout — shown as a small toast, not the map load modal. */
  const [myLocationNotice, setMyLocationNotice] = useState(null);
  const [googlePlaceData, setGooglePlaceData] = useState({});
  const [fetchingPlaces, setFetchingPlaces] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [listOpen, setListOpen] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [tripFilterName, setTripFilterName] = useState(null);
  const [tripPlaceIds, setTripPlaceIds] = useState(null);
  const [tripDays, setTripDays] = useState(null);
  const [tripStartDate, setTripStartDate] = useState('');
  /** Parity with app deep link `tripDayLabel` (e.g. "Day 2 Â· Feb 3, 2025"). */
  const [tripDayLabel, setTripDayLabel] = useState(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [directionsError, setDirectionsError] = useState(null);
  const [travelMode, setTravelMode] = useState('DRIVING');
  const [directionsResult, setDirectionsResult] = useState(null);
  const [routeDetailsOpen, setRouteDetailsOpen] = useState(false);
  const [liveNavigation, setLiveNavigation] = useState(false);
  const [liveNavDirectionsExpanded, setLiveNavDirectionsExpanded] = useState(false);
  const [routePanelCollapsed, setRoutePanelCollapsed] = useState(false);
  const [routeRefreshTick, setRouteRefreshTick] = useState(0);
  const [liveNavError, setLiveNavError] = useState(null);
  const [liveNavErrorDebug, setLiveNavErrorDebug] = useState('');
  /** True while waiting for the browser geolocation prompt / first fix. */
  const [liveNavRequestingPermission, setLiveNavRequestingPermission] = useState(false);
  const [liveNavFollowing, setLiveNavFollowing] = useState(false);
  const [addingTripStop, setAddingTripStop] = useState(false);
  const [catalogPlaces, setCatalogPlaces] = useState([]);
  const [catalogFetched, setCatalogFetched] = useState(false);
  /** Places list: `off` = default order; `me` = by distance from user; `place` = from selected pin. */
  const [nearbyMode, setNearbyMode] = useState('off');
  /** Fixed anchor for nearby-by-place sorting to avoid selection-driven reorder loops. */
  const [nearbyAnchorPlaceId, setNearbyAnchorPlaceId] = useState(null);
  const [nearbyLocating, setNearbyLocating] = useState(false);
  /** One-place-at-a-time carousel index in the drawer (ordered by nearby / center). */
  const [swipeDeckIndex, setSwipeDeckIndex] = useState(0);
  const [showMapOnboarding, setShowMapOnboarding] = useState(false);
  /** From navigate state (e.g. event detail pin without a venue place id). */
  const [mapFocusFromNav, setMapFocusFromNav] = useState(null);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const mapFocusMarkerRef = useRef(null);
  const markersByPlaceIdRef = useRef(new Map());
  const infoWindowRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const userLocationRef = useRef(null);
  const userMarkerRef = useRef(null);
  const lastLiveRouteTriggerRef = useRef(0);
  const prevWatchPositionRef = useRef(null);
  const apiKey = typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_MAPS_API_KEY;

  const infoWindowStrings = useMemo(
    () => ({
      viewDetails: `${t('home', 'viewDetails')} ${lang === 'ar' ? '←' : '→'}`,
      directions: `${t('home', 'mapDirections')} →`,
    }),
    [t, lang]
  );

  useEffect(() => {
    userLocationRef.current = userLocation;
  }, [userLocation]);

  useEffect(() => {
    try {
      const seen = window.localStorage.getItem('mapOnboardingSeen');
      if (!seen) setShowMapOnboarding(true);
    } catch {
      setShowMapOnboarding(true);
    }
  }, []);

  /* Live nav: start in map-only mode; full sheet opens only when user asks. */
  useEffect(() => {
    setLiveNavDirectionsExpanded(false);
  }, [liveNavigation]);

  useEffect(() => {
    setRoutePanelCollapsed(false);
  }, [tripFilterName, selectedDayIndex, liveNavigation]);

  useEffect(() => {
    if (!listOpen || typeof window === 'undefined') return;
    if (window.matchMedia?.('(max-width: 959px)').matches) {
      infoWindowRef.current?.close?.();
    }
  }, [listOpen]);

  useEffect(() => {
    setTravelMode((m) => (m === 'TRANSIT' || m === 'BICYCLING' ? 'DRIVING' : m));
  }, []);

  useEffect(() => {
    const mode = searchParams.get('mode');
    if (mode === 'WALKING' || mode === 'DRIVING') {
      setTravelMode(mode);
    }
  }, [searchParams.toString()]);

  useEffect(() => {
    const handoff = (searchParams.get('handoff') || '').trim();
    if (!handoff) return;
    let cancelled = false;
    api.auth
      .consumeChromeHandoff(handoff)
      .then((payload) => {
        if (!cancelled && payload?.token && payload?.user) {
          applySession(payload);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (cancelled) return;
        const next = new URLSearchParams(searchParams);
        next.delete('handoff');
        navigate(
          {
            pathname: location.pathname,
            search: next.toString() ? `?${next.toString()}` : '',
          },
          { replace: true, state: location.state }
        );
      });
    return () => {
      cancelled = true;
    };
  }, [searchParams.toString(), applySession, navigate, location.pathname, location.state]);

  useEffect(() => {
    const state = location.state;
    const tripIds = state?.tripPlaceIds;
    const tripIdsFromQuery = (searchParams.get('tripIds') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const days = state?.tripDays;
    const mf = state?.mapFocus;
    const qParam = (searchParams.get('q') || '').trim();
    setLiveNavigation(false);
    setLiveNavError(null);
    setLiveNavErrorDebug('');
    setLiveNavRequestingPermission(false);
    setAddingTripStop(false);
    setGooglePlaceData({});
    setTripPlaceIds(null);
    setTripDays(null);
    setTripStartDate(state?.tripStartDate || '');
    setTripDayLabel(state?.tripDayLabel || null);
    setSelectedDayIndex(0);
    if (Array.isArray(tripIds) && tripIds.length > 0) {
      setMapFocusFromNav(null);
      setSearchQuery('');
      setLoading(true);
      setTripFilterName(state.tripName || 'Trip');
      setTripPlaceIds(tripIds);
      const normalizedDays =
        Array.isArray(days) && days.length > 0
          ? days.map((d) => ({ ...d, placeIds: placeIdsFromDay(d) }))
          : [{ placeIds: tripIds }];
      setTripDays(normalizedDays);
      Promise.all(tripIds.map((id) => api.places.get(id).catch(() => null)))
        .then((results) => setPlaces(results.filter(Boolean)))
        .catch(() => setPlaces([]))
        .finally(() => setLoading(false));
    } else if (tripIdsFromQuery.length > 0) {
      setMapFocusFromNav(null);
      setSearchQuery('');
      setLoading(true);
      setTripFilterName(searchParams.get('tripName') || 'Trip');
      setTripPlaceIds(tripIdsFromQuery);
      setTripDays([{ placeIds: tripIdsFromQuery }]);
      Promise.all(tripIdsFromQuery.map((id) => api.places.get(id).catch(() => null)))
        .then((results) => setPlaces(results.filter(Boolean)))
        .catch(() => setPlaces([]))
        .finally(() => setLoading(false));
    } else {
      if (
        mf &&
        mf.lat != null &&
        mf.lng != null &&
        Number.isFinite(Number(mf.lat)) &&
        Number.isFinite(Number(mf.lng))
      ) {
        setMapFocusFromNav({
          lat: Number(mf.lat),
          lng: Number(mf.lng),
          label: typeof mf.label === 'string' ? mf.label : '',
          zoom: mf.zoom != null && Number.isFinite(Number(mf.zoom)) ? Number(mf.zoom) : undefined,
        });
      } else {
        setMapFocusFromNav(null);
      }
      setSearchQuery(qParam);
      setLoading(true);
      setTripFilterName(null);
      setTripDayLabel(null);
      Promise.all([
        api.places.list({ lang: langParam }),
        api.categories.list({ lang: langParam }).catch(() => ({ categories: [] })),
      ])
        .then(([rPlaces, rCat]) => {
          const raw = rPlaces.popular || rPlaces.locations || [];
          const cats = Array.isArray(rCat?.categories) ? rCat.categories : [];
          setPlaces(filterGeneralDirectoryPlaces(Array.isArray(raw) ? raw : [], cats));
        })
        .catch(() => setPlaces([]))
        .finally(() => setLoading(false));
    }
  }, [langParam, location.state, searchParams.toString()]);

  useEffect(() => {
    if (!addingTripStop || catalogFetched) return undefined;
    let cancelled = false;
    api.places
      .list({ lang: langParam })
      .then((r) => {
        if (!cancelled) {
          const list = r.popular || r.locations || [];
          setCatalogPlaces(Array.isArray(list) ? list : []);
          setCatalogFetched(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCatalogPlaces([]);
          setCatalogFetched(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [addingTripStop, catalogFetched, langParam]);

  const placesList = Array.isArray(places) ? places : [];
  const mergedPlacesList = useMemo(() => {
    if (!addingTripStop || catalogPlaces.length === 0) return placesList;
    const m = new Map(placesList.map((p) => [String(p.id), p]));
    for (const p of catalogPlaces) {
      if (p && p.id != null && !m.has(String(p.id))) m.set(String(p.id), p);
    }
    return Array.from(m.values());
  }, [placesList, catalogPlaces, addingTripStop]);

  const withNativeCoords = useMemo(
    () => mergedPlacesList.filter((p) => p.latitude != null && p.longitude != null),
    [mergedPlacesList]
  );
  const needGoogleData = useMemo(
    () => mergedPlacesList.filter((p) => p.name || p.location),
    [mergedPlacesList]
  );
  const needGoogleDataIds = useMemo(
    () => needGoogleData.map((p) => p.id).sort().join(','),
    [needGoogleData]
  );

  useEffect(() => {
    if (!apiKey || needGoogleData.length === 0) return;
    let cancelled = false;
    setFetchingPlaces(true);
    const delay = (ms) => new Promise((r) => setTimeout(r, ms));
    const tasks = needGoogleData.map((p) => async () => {
      if (cancelled) return null;
      const query = [p.name, p.location].filter(Boolean).join(', ') || PLACES_REGION;
      const searchStr = `${query}, ${PLACES_REGION}`;
      const found = await findPlaceFromText(searchStr, apiKey);
      if (cancelled) return null;
      if (!found?.place_id) return null;
      await delay(GOOGLE_PLACES_DELAY_MS);
      if (cancelled) return null;
      const details = await getPlaceDetails(found.place_id, apiKey);
      if (cancelled) return null;
      if (details && details.lat != null && details.lng != null) {
        return { id: p.id, data: { lat: details.lat, lng: details.lng, name: details.name, formatted_address: details.formatted_address, rating: details.rating, user_ratings_total: details.user_ratings_total, photo_reference: details.photo_reference, opening_hours: details.opening_hours, website: details.website, formatted_phone_number: details.formatted_phone_number, url: details.url } };
      }
      if (found.lat != null && found.lng != null) {
        return { id: p.id, data: { lat: found.lat, lng: found.lng, name: found.name, formatted_address: found.formatted_address, rating: null, user_ratings_total: null, photo_reference: null, opening_hours: null, website: null, formatted_phone_number: null, url: null } };
      }
      return null;
    });
    asyncPool(GOOGLE_PLACES_CONCURRENCY, tasks)
      .then((results) => {
        if (cancelled) return;
        const next = {};
        results.forEach((r) => {
          if (r && r.id && r.data) next[r.id] = r.data;
        });
        setGooglePlaceData((prev) => ({ ...prev, ...next }));
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setFetchingPlaces(false); });
    return () => { cancelled = true; };
  }, [apiKey, needGoogleDataIds]);

  const withCoords = useMemo(() => {
    const list = [];
    const seen = new Set();
    for (const p of withNativeCoords) {
      const g = googlePlaceData[p.id];
      list.push({
        ...p,
        latitude: g?.lat ?? p.latitude,
        longitude: g?.lng ?? p.longitude,
        _google: g || null,
      });
      seen.add(p.id);
    }
    for (const p of needGoogleData) {
      if (seen.has(p.id)) continue;
      const g = googlePlaceData[p.id];
      if (g?.lat == null || g?.lng == null) continue;
      list.push({
        ...p,
        latitude: g.lat,
        longitude: g.lng,
        _google: g,
      });
    }
    return list;
  }, [withNativeCoords, needGoogleData, googlePlaceData]);

  /** Current day's place IDs (supports API `{ slots }` or `{ placeIds }` — VisitTripoliApp TripDay). */
  const currentDayPlaceIds = useMemo(() => {
    const days =
      Array.isArray(tripDays) && tripDays.length > 0
        ? tripDays
        : tripPlaceIds
          ? [{ placeIds: tripPlaceIds }]
          : [];
    const dayIndex = Math.max(0, Math.min(selectedDayIndex, days.length - 1));
    const day = days[dayIndex];
    return placeIdsFromDay(day);
  }, [tripDays, tripPlaceIds, selectedDayIndex]);

  /** Marker / list order: trip waypoint order (app: numbered markers follow filterIds order). */
  const mapDisplayPlaces = useMemo(() => {
    if (tripFilterName && currentDayPlaceIds.length > 0) {
      const byId = new Map(withCoords.map((p) => [String(p.id), p]));
      return currentDayPlaceIds.map((id) => byId.get(String(id))).filter(Boolean);
    }
    return withCoords;
  }, [tripFilterName, currentDayPlaceIds, withCoords]);

  /** Trip places in the order they appear for the selected day (for routing – only with coords). */
  const placesInTripOrder = useMemo(() => {
    if (currentDayPlaceIds.length === 0 || !withCoords.length) return [];
    const byId = new Map(withCoords.map((p) => [String(p.id), p]));
    const ordered = [];
    for (let i = 0; i < currentDayPlaceIds.length; i++) {
      const p = byId.get(String(currentDayPlaceIds[i]));
      if (p && p.latitude != null && p.longitude != null) ordered.push(p);
    }
    return ordered;
  }, [withCoords, currentDayPlaceIds]);

  /** Current day places for the waypoints list (includes places still loading). */
  const currentDayPlacesForList = useMemo(() => {
    if (currentDayPlaceIds.length === 0) return [];
    const byId = new Map(mergedPlacesList.map((p) => [String(p.id), p]));
    const withG = new Map(withCoords.map((p) => [String(p.id), p]));
    return currentDayPlaceIds.map((id) => withG.get(String(id)) || byId.get(String(id))).filter(Boolean);
  }, [currentDayPlaceIds, mergedPlacesList, withCoords]);

  const deferredSearchQuery = useDeferredValue(searchQuery);

  /** Browse mode: markers match the search bar (same algorithm as Discover); empty match → show all. */
  const mapBrowseMarkers = useMemo(() => {
    if (tripFilterName && currentDayPlaceIds.length > 0) return mapDisplayPlaces;
    const qq = deferredSearchQuery.trim();
    if (!qq) return mapDisplayPlaces;
    const narrow = filterPlacesByQuery(mapDisplayPlaces, qq);
    return narrow;
  }, [tripFilterName, currentDayPlaceIds.length, mapDisplayPlaces, deferredSearchQuery]);

  const catalogPickerPlaces = useMemo(() => {
    if (!addingTripStop) return [];
    return filterPlacesByQuery(catalogPlaces, deferredSearchQuery);
  }, [addingTripStop, catalogPlaces, deferredSearchQuery]);

  const markersForMapList = useMemo(() => {
    if (!addingTripStop) return mapBrowseMarkers;
    const tripOrdered = mapDisplayPlaces;
    const idSet = new Set(tripOrdered.map((p) => String(p.id)));
    const extras = catalogPickerPlaces.filter((p) => !idSet.has(String(p.id)));
    return [...tripOrdered, ...extras];
  }, [addingTripStop, mapBrowseMarkers, mapDisplayPlaces, catalogPickerPlaces]);

  const markersVisibleOnMap = useMemo(() => {
    if (!listOpen || addingTripStop || selectedPlaceId == null) return markersForMapList;
    const selectedOnly = markersForMapList.filter((p) => String(p.id) === String(selectedPlaceId));
    return selectedOnly.length > 0 ? selectedOnly : markersForMapList;
  }, [listOpen, addingTripStop, selectedPlaceId, markersForMapList]);

  const drawerPlaces = useMemo(() => {
    const base = addingTripStop ? catalogPlaces : mapDisplayPlaces;
    const narrow = filterPlacesByQuery(base, deferredSearchQuery);
    if (addingTripStop) return narrow;
    const qq = deferredSearchQuery.trim();
    if (!qq) return base;
    return narrow.length > 0 ? narrow : base;
  }, [addingTripStop, catalogPlaces, mapDisplayPlaces, deferredSearchQuery]);

  const coordsById = useMemo(() => new Map(withCoords.map((p) => [String(p.id), p])), [withCoords]);

  const drawerPlacesWithCoords = useMemo(() => {
    return drawerPlaces
      .map((p) => coordsById.get(String(p.id)) || p)
      .filter(
        (p) =>
          p.latitude != null &&
          p.longitude != null &&
          Number.isFinite(Number(p.latitude)) &&
          Number.isFinite(Number(p.longitude))
      );
  }, [drawerPlaces, coordsById]);

  const nearbyAnchoredList = useMemo(() => {
    if (nearbyMode === 'off') return null;
    let anchor = null;
    if (nearbyMode === 'me') {
      if (!userLocation) return null;
      anchor = userLocation;
    } else if (nearbyMode === 'place') {
      const sp = coordsById.get(String(nearbyAnchorPlaceId));
      if (!sp || sp.latitude == null || sp.longitude == null) return null;
      anchor = { lat: Number(sp.latitude), lng: Number(sp.longitude) };
    } else if (nearbyMode === 'trip') {
      if (placesInTripOrder.length === 0) return null;
      // In trip mode, distance is calculated to the *nearest* stop in the trip
      anchor = placesInTripOrder.map(s => ({ lat: Number(s.latitude), lng: Number(s.longitude) }));
    }
    if (!anchor) return null;
    const rows = drawerPlacesWithCoords.map((p) => {
      const pCoords = { lat: Number(p.latitude), lng: Number(p.longitude) };
      let distM;
      if (Array.isArray(anchor)) {
        distM = Math.min(...anchor.map(s => haversineMeters(s, pCoords)));
      } else {
        distM = haversineMeters(anchor, pCoords);
      }
      return { ...p, _distanceM: distM };
    });
    rows.sort((a, b) => a._distanceM - b._distanceM);
    return rows;
  }, [nearbyMode, userLocation, nearbyAnchorPlaceId, drawerPlacesWithCoords, coordsById]);

  const listForDrawer = useMemo(() => {
    if (addingTripStop || nearbyMode === 'off') return drawerPlaces;
    if (nearbyMode === 'me' && nearbyLocating) return [];
    return nearbyAnchoredList != null ? nearbyAnchoredList : [];
  }, [addingTripStop, nearbyMode, nearbyLocating, nearbyAnchoredList, drawerPlaces]);

  /** Drawer swipe deck: same order as nearby list when sorted; otherwise by distance from you or Tripoli center. */
  const swipeDeckPlaces = useMemo(() => {
    if (addingTripStop) return [];
    const merge = (p) => ({ ...p, ...(coordsById.get(String(p.id)) || {}) });
    if (nearbyMode !== 'off') {
      return listForDrawer.map((p) => merge(p));
    }
    const anchor = userLocation
      ? { lat: userLocation.lat, lng: userLocation.lng }
      : { lat: TRIPOLI_CENTER.lat, lng: TRIPOLI_CENTER.lng };
    const rows = drawerPlaces.map((p) => {
      const m = merge(p);
      const lat = m.latitude;
      const lng = m.longitude;
      if (
        lat == null ||
        lng == null ||
        !Number.isFinite(Number(lat)) ||
        !Number.isFinite(Number(lng))
      ) {
        return { ...m, _distanceM: Number.POSITIVE_INFINITY };
      }
      const d = haversineMeters(anchor, { lat: Number(lat), lng: Number(lng) });
      return { ...m, _distanceM: d };
    });
    rows.sort((a, b) => {
      const da = a._distanceM;
      const db = b._distanceM;
      if (!Number.isFinite(da) && !Number.isFinite(db)) return 0;
      if (!Number.isFinite(da)) return 1;
      if (!Number.isFinite(db)) return -1;
      return da - db;
    });
    return rows;
  }, [addingTripStop, nearbyMode, listForDrawer, drawerPlaces, coordsById, userLocation]);

  useEffect(() => {
    if (nearbyMode !== 'place') return;
    if (!nearbyAnchorPlaceId) {
      setNearbyMode('off');
      return;
    }
    const sp = coordsById.get(String(nearbyAnchorPlaceId));
    if (!sp || sp.latitude == null || sp.longitude == null) setNearbyMode('off');
  }, [nearbyMode, nearbyAnchorPlaceId, coordsById]);

  const nearbyFromSelectionReady = useMemo(() => {
    if (!selectedPlaceId) return false;
    const sp = coordsById.get(String(selectedPlaceId));
    return (
      sp != null &&
      sp.latitude != null &&
      sp.longitude != null &&
      Number.isFinite(Number(sp.latitude)) &&
      Number.isFinite(Number(sp.longitude))
    );
  }, [selectedPlaceId, coordsById]);

  const selectedPlace = useMemo(
    () =>
      selectedPlaceId
        ? drawerPlaces.find((p) => p.id === selectedPlaceId) ??
          markersForMapList.find((p) => p.id === selectedPlaceId) ??
          null
        : null,
    [selectedPlaceId, drawerPlaces, markersForMapList]
  );

  const routeSummary = useMemo(() => getRouteSummary(directionsResult), [directionsResult]);

  const commitAddStop = useCallback(
    (rawId) => {
      const id = String(rawId);
      const st = location.state;
      if (!Array.isArray(st?.tripPlaceIds) || st.tripPlaceIds.length === 0) {
        navigate('/map', {
          replace: true,
          state: {
            ...(st && typeof st === 'object' ? st : {}),
            tripPlaceIds: [id],
            tripDays: [{ placeIds: [id] }],
            tripName: st?.tripName || t('home', 'mapDefaultTripName'),
          },
        });
        setAddingTripStop(false);
        setSearchQuery('');
        return;
      }
      const maxDay = Math.max(0, (Array.isArray(st.tripDays) ? st.tripDays.length : 1) - 1);
      const dayIdx = Math.max(0, Math.min(selectedDayIndex, maxDay));
      const baseDays =
        Array.isArray(st.tripDays) && st.tripDays.length > 0
          ? st.tripDays.map((d) => ({ ...d, placeIds: [...placeIdsFromDay(d)] }))
          : [{ placeIds: st.tripPlaceIds.map(String) }];
      const nextDays = baseDays.map((d, i) => {
        if (i !== dayIdx) return d;
        const cur = [...(d.placeIds || []).map(String)];
        if (cur.includes(id)) return d;
        return { ...d, placeIds: [...cur, id] };
      });
      const allIds = Array.from(new Set([...st.tripPlaceIds.map(String), id]));
      navigate('/map', {
        replace: true,
        state: {
          ...st,
          tripPlaceIds: allIds,
          tripDays: nextDays,
        },
      });
      setAddingTripStop(false);
      setSearchQuery('');
    },
    [location.state, navigate, selectedDayIndex, t]
  );

  const handleCopyRouteLink = useCallback(() => {
    const url = window.location.href;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
  }, []);

  const handleSendToPhone = useCallback(() => {
    const url = window.location.href;
    const title = tripFilterName ? `${t('home', 'viewingTrip')}: ${tripFilterName}` : t('home', 'mapPageTitle');
    if (navigator.share) {
      navigator.share({ title, url }).catch(() => {});
    } else if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
  }, [tripFilterName, t]);

  const handleOpenInChrome = useCallback(async () => {
    if (typeof window === 'undefined') return;
    try {
      const handoff = await api.auth.createChromeHandoff();
      const handoffCode = handoff?.code ? String(handoff.code) : '';
      if (!handoffCode) {
        setLiveNavError('unavailable');
        setLiveNavErrorDebug(t('home', 'liveNavChromeHandoffFailed'));
        return;
      }
    const targetUrl = buildChromeMapHandoffUrl({
      baseUrl: window.location.href,
      handoffCode,
      tripIds: currentDayPlaceIds,
      tripName: tripFilterName || '',
      travelMode,
      autoStart: true,
    });
    const chromeUrl = buildChromeAppUrl(targetUrl);
      if (!chromeUrl) {
        setLiveNavError('unavailable');
        setLiveNavErrorDebug(t('home', 'liveNavChromeHandoffFailed'));
        return;
      }
      window.location.assign(chromeUrl);
    } catch {
      setLiveNavError('unavailable');
      setLiveNavErrorDebug(t('home', 'liveNavChromeHandoffFailed'));
    }
  }, [currentDayPlaceIds, tripFilterName, travelMode, t]);

  const canRedirectToChrome = useMemo(() => isLikelySafari() && isIosDevice(), []);
  const startButtonOpensChrome = canRedirectToChrome && liveNavError === 'denied';

  const focusMapOnPlace = useCallback((place, maps, map, infoWindow) => {
    if (!place || !map) return;
    const pos = { lat: Number(place.latitude), lng: Number(place.longitude) };
    map.panTo(pos);
    map.setZoom(DETAIL_MAP_ZOOM);
    const markerEntry = markersByPlaceIdRef.current.get(place.id);
    if (markerEntry?.marker && infoWindow) {
      const content = buildInfoContent(place, apiKey, infoWindowStrings, false);
      infoWindow.setContent(content);
      infoWindow.open(map, markerEntry.marker);
    }
  }, [apiKey, infoWindowStrings]);

  const handlePlaceSelect = useCallback(
    (place, opts = {}) => {
      const { keepListOpen = false } = opts;
      if (addingTripStop) {
        commitAddStop(place.id);
        return;
      }
      setSelectedPlaceId(place.id);
      if (!keepListOpen) setListOpen(false);
      const map = mapInstanceRef.current;
      const infoWindow = infoWindowRef.current;
      const maps = window.google?.maps;
      if (map && infoWindow && maps) focusMapOnPlace(place, maps, map, infoWindow);
    },
    [addingTripStop, commitAddStop, focusMapOnPlace]
  );

  // NOTE: Auto-sync between selected place, swipe index, and map focus can create
  // feedback loops in some browser/render timing paths. Keep this flow explicit via
  // user actions (card arrows / map marker clicks) to avoid maximum update depth errors.
  useEffect(() => {
    if (!listOpen || addingTripStop || swipeDeckPlaces.length === 0) return;
    const p = swipeDeckPlaces[swipeDeckIndex];
    if (!p) return;
    setSelectedPlaceId((curr) => (String(curr) === String(p.id) ? curr : p.id));
  }, [listOpen, addingTripStop, swipeDeckIndex, swipeDeckPlaces]);

  const handleMapSearchPick = useCallback(
    (p) => {
      const full =
        markersForMapList.find((x) => String(x.id) === String(p.id)) ||
        mergedPlacesList.find((x) => String(x.id) === String(p.id)) ||
        p;
      handlePlaceSelect(full);
    },
    [markersForMapList, mergedPlacesList, handlePlaceSelect]
  );

  useEffect(() => {
    const onInfoWindowAction = (e) => {
      const detailLink = e.target.closest?.('.map-info-link');
      if (detailLink) {
        const id = detailLink.getAttribute('data-place-id');
        if (id) {
          e.preventDefault();
          navigate(`/place/${id}`);
        }
        return;
      }
      const dirEl = e.target.closest?.('.map-info-directions');
      if (dirEl) {
        e.preventDefault();
        const id = dirEl.getAttribute('data-place-id');
        if (!id) return;
        let tripName = 'Trip';
        const enc = dirEl.getAttribute('data-trip-name');
        if (enc) {
          try {
            tripName = decodeURIComponent(enc) || tripName;
          } catch {
            /* ignore */
          }
        }
        navigate('/map', {
          state: {
            tripPlaceIds: [id],
            tripDays: [{ placeIds: [String(id)] }],
            tripName,
          },
        });
      }
    };
    document.addEventListener('click', onInfoWindowAction, true);
    return () => document.removeEventListener('click', onInfoWindowAction, true);
  }, [navigate]);

  useEffect(() => {
    if (!apiKey || !mapRef.current) return;

    let cancelled = false;
    setMapError((prev) => (prev === null ? prev : null));

    const addMarkers = (map, maps, infoWindow) => {
      markersRef.current.forEach((m) => m?.marker?.setMap?.(null));
      markersRef.current = [];
      markersByPlaceIdRef.current.clear();
      const list = markersVisibleOnMap || [];
      const tripRank = new Map((mapDisplayPlaces || []).map((p, i) => [p.id, String(i + 1)]));
      const showTripNumbers = Boolean(tripFilterName && mapDisplayPlaces.length > 0);
      const bounds = new maps.LatLngBounds();
      const fitPad = {
        top: tripFilterName ? MAP_FIT_PADDING + 8 : MAP_FIT_PADDING + 16,
        right: MAP_FIT_PADDING,
        bottom: MAP_FIT_PADDING,
        left: tripFilterName ? 400 : MAP_FIT_PADDING,
      };
      list.forEach((p) => {
        const pos = { lat: Number(p.latitude), lng: Number(p.longitude) };
        bounds.extend(pos);
        const labelText = showTripNumbers ? tripRank.get(p.id) : null;
        const marker = new maps.Marker({
          position: pos,
          map,
          title: p.name || p.id,
          ...(labelText
            ? {
                label: {
                  text: labelText,
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 'bold',
                },
              }
            : {}),
        });
        const placeId = p.id;
        marker.addListener('click', () => {
          if (addingTripStop) {
            commitAddStop(placeId);
            infoWindow.close();
            return;
          }
          setSelectedPlaceId(placeId);
          setListOpen(false);
          infoWindow.setContent(buildInfoContent(p, apiKey, infoWindowStrings, false));
          infoWindow.open(map, marker);
        });
        const entry = { marker, placeId };
        markersRef.current.push(entry);
        markersByPlaceIdRef.current.set(placeId, entry);
      });
      if (markersRef.current.length > 1) {
        map.fitBounds(bounds, fitPad);
      } else if (markersRef.current.length === 1) {
        map.panTo(markersRef.current[0].marker.getPosition());
        map.setZoom(DETAIL_MAP_ZOOM);
      }
    };

    if (mapInstanceRef.current && infoWindowRef.current) {
      addMarkers(mapInstanceRef.current, window.google.maps, infoWindowRef.current);
      return;
    }

    loadGoogleMapsScript(apiKey, (err) => { if (!cancelled) setMapError(err.message); })
      .then((maps) => {
        if (cancelled || !mapRef.current) return;
        if (typeof window !== 'undefined') window.gm_authFailure = null;
        const map = new maps.Map(mapRef.current, {
          center: TRIPOLI_CENTER,
          zoom: DEFAULT_ZOOM,
          minZoom: 2,
          maxZoom: 21,
          mapTypeId: 'satellite',
          mapTypeControl: false,
          streetViewControl: true,
          fullscreenControl: false,
          zoomControl: false,
          scaleControl: false,
          backgroundColor: '#e8eaed',
          styles: [],
        });
        mapInstanceRef.current = map;
        map.addListener('dragstart', () => {
          setLiveNavFollowing(false);
        });
        const infoWindow = new maps.InfoWindow();
        infoWindowRef.current = infoWindow;
        addMarkers(map, maps, infoWindow);
        setTimeout(() => { maps.event.trigger(map, 'resize'); }, 0);
      })
      .catch((err) => {
        if (!cancelled) setMapError(err.message || 'Failed to load map');
      });

    return () => {
      cancelled = true;
      if (typeof window !== 'undefined') window.gm_authFailure = null;
      markersRef.current.forEach((m) => m?.marker?.setMap?.(null));
      markersRef.current = [];
      markersByPlaceIdRef.current.clear();
    };
  }, [apiKey, markersVisibleOnMap, mapDisplayPlaces, tripFilterName, infoWindowStrings, addingTripStop, commitAddStop]);

  /* Deep link / event pin: center map on coordinates that are not a directory place. */
  useEffect(() => {
    if (mapFocusMarkerRef.current) {
      try {
        mapFocusMarkerRef.current.setMap(null);
      } catch (_e) {
        /* ignore */
      }
      mapFocusMarkerRef.current = null;
    }
    const map = mapInstanceRef.current;
    const maps = window.google?.maps;
    if (!map || !maps || !mapFocusFromNav) return undefined;
    const pos = { lat: mapFocusFromNav.lat, lng: mapFocusFromNav.lng };
    const marker = new maps.Marker({
      position: pos,
      map,
      title: mapFocusFromNav.label || '',
      zIndex: 9999,
    });
    mapFocusMarkerRef.current = marker;
    map.panTo(pos);
    map.setZoom(mapFocusFromNav.zoom != null ? mapFocusFromNav.zoom : DETAIL_MAP_ZOOM);
    return () => {
      try {
        marker.setMap(null);
      } catch (_e) {
        /* ignore */
      }
      if (mapFocusMarkerRef.current === marker) mapFocusMarkerRef.current = null;
    };
  }, [mapFocusFromNav, markersVisibleOnMap]);

  useEffect(() => {
    return () => {
      markersRef.current.forEach((m) => m?.marker?.setMap?.(null));
      markersRef.current = [];
      if (mapFocusMarkerRef.current) {
        try {
          mapFocusMarkerRef.current.setMap(null);
        } catch (_e) {
          /* ignore */
        }
        mapFocusMarkerRef.current = null;
      }
      if (directionsRendererRef.current) {
        directionsRendererRef.current.setMap(null);
        directionsRendererRef.current.setDirections(null);
        directionsRendererRef.current = null;
      }
      mapInstanceRef.current = null;
      infoWindowRef.current = null;
    };
  }, []);

  /* Live reload: resize map when layout changes (panel open/close) or window resize */
  const triggerMapResize = useCallback(() => {
    const map = mapInstanceRef.current;
    const maps = window.google?.maps;
    if (!map || !maps) return;
    setTimeout(() => {
      maps.event.trigger(map, 'resize');
      const leftPadding = tripFilterName ? 400 : MAP_FIT_PADDING;
      const bottomPadding = listOpen && !tripFilterName ? 320 : MAP_FIT_PADDING;
      if (markersRef.current.length > 1) {
        const bounds = new maps.LatLngBounds();
        markersRef.current.forEach((m) => bounds.extend(m.marker.getPosition()));
        map.fitBounds(bounds, {
          top: tripFilterName ? MAP_FIT_PADDING + 8 : MAP_FIT_PADDING + 16,
          right: MAP_FIT_PADDING,
          bottom: bottomPadding,
          left: leftPadding,
        });
      } else if (markersRef.current.length === 1) {
        map.panTo(markersRef.current[0].marker.getPosition());
        map.setZoom(DETAIL_MAP_ZOOM);
      }
    }, 150);
  }, [tripFilterName, listOpen]);

  useEffect(() => {
    triggerMapResize();
  }, [tripFilterName, listOpen, triggerMapResize]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !window.google?.maps) return;
    const onWindowResize = () => window.google.maps.event.trigger(map, 'resize');
    window.addEventListener('resize', onWindowResize);
    return () => window.removeEventListener('resize', onWindowResize);
  }, []);

  useEffect(() => {
    const el = mapRef.current;
    if (!el || !window.google?.maps) return;
    const ro = new ResizeObserver(() => {
      const map = mapInstanceRef.current;
      if (map) window.google.maps.event.trigger(map, 'resize');
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* Trip route: static (first→last) or live (GPS→…→last with ordered waypoints). Car & walk only. */
  useEffect(() => {
    const map = mapInstanceRef.current;
    const maps = window.google?.maps;
    if (!map || !maps) return;

    const clearRoute = () => {
      setDirectionsError(null);
      setDirectionsResult(null);
      const renderer = directionsRendererRef.current;
      if (renderer) {
        try {
          renderer.setMap(null);
          renderer.setDirections(null);
        } catch (_err) {
          /* ignore */
        }
      }
      directionsRendererRef.current = null;
    };

    if (!tripFilterName || placesInTripOrder.length < 1) {
      clearRoute();
      return;
    }

    const ordered = placesInTripOrder;
    const lastStop = ordered[ordered.length - 1];
    const firstStop = ordered[0];
    let origin;
    let destination;
    let waypoints;

    if (liveNavigation) {
      const ul = userLocationRef.current;
      if (!ul || ul.lat == null || ul.lng == null) {
        return () => {};
      }
      origin = { lat: Number(ul.lat), lng: Number(ul.lng) };
      destination = { lat: Number(lastStop.latitude), lng: Number(lastStop.longitude) };
      if (ordered.length >= 2) {
        waypoints = ordered
          .slice(0, -1)
          .map((p) => ({
            location: { lat: Number(p.latitude), lng: Number(p.longitude) },
            stopover: true,
          }))
          .slice(0, 25);
      } else {
        waypoints = [];
      }
    } else if (ordered.length >= 2) {
      origin = { lat: Number(firstStop.latitude), lng: Number(firstStop.longitude) };
      destination = { lat: Number(lastStop.latitude), lng: Number(lastStop.longitude) };
      const middle = ordered.slice(1, -1);
      waypoints = middle.slice(0, 25).map((p) => ({
        location: { lat: Number(p.latitude), lng: Number(p.longitude) },
        stopover: true,
      }));
    } else {
      clearRoute();
      return;
    }

    let cancelled = false;
    setDirectionsError(null);

    const modeKey = travelMode === 'WALKING' ? 'WALKING' : 'DRIVING';
    const mode = maps.TravelMode[modeKey] || maps.TravelMode.DRIVING;
    const isDriving = mode === maps.TravelMode.DRIVING;

    const request = {
      origin,
      destination,
      waypoints: waypoints.length > 0 ? waypoints : undefined,
      optimizeWaypoints: false,
      travelMode: mode,
      region: 'LB',
      unitSystem: maps.UnitSystem.METRIC,
      /** Driving: ask for traffic-aware times (`duration_in_traffic`) and fastest corridor among alternates. */
      provideRouteAlternatives: isDriving,
      drivingOptions: isDriving
        ? {
            departureTime: new Date(),
            trafficModel: maps.TrafficModel.BEST_GUESS,
          }
        : undefined,
    };

    const directionsService = new maps.DirectionsService();
    directionsService.route(request, (result, status) => {
      if (cancelled) return;
      const currentMap = mapInstanceRef.current;
      if (!currentMap) return;
      if (status !== maps.DirectionsStatus.OK) {
        setDirectionsError(status);
        setDirectionsResult(null);
        const renderer = directionsRendererRef.current;
        if (renderer) {
          try {
            renderer.setMap(null);
            renderer.setDirections(null);
          } catch (_err) {
            /* ignore */
          }
        }
        directionsRendererRef.current = null;
        return;
      }
      const withBestRoute = reorderRoutesByFastestTraffic(result, isDriving);
      setDirectionsResult(withBestRoute);
      const renderer = directionsRendererRef.current;
      if (renderer) {
        try {
          renderer.setMap(null);
          renderer.setDirections(null);
        } catch (_err) {
          /* ignore */
        }
      }
      const newRenderer = new maps.DirectionsRenderer({
        suppressMarkers: false,
        preserveViewport: !!liveNavigation,
        polylineOptions: {
          strokeColor: '#4285F4',
          strokeWeight: liveNavigation ? 7 : 6,
          strokeOpacity: 1,
        },
      });
      directionsRendererRef.current = newRenderer;
      newRenderer.setMap(currentMap);
      newRenderer.setDirections(withBestRoute);
      setTimeout(() => { maps.event.trigger(currentMap, 'resize'); }, 0);
    });

    return () => {
      cancelled = true;
    };
  }, [tripFilterName, placesInTripOrder, travelMode, liveNavigation, routeRefreshTick]);

  useEffect(() => {
    if (!selectedPlace || !mapInstanceRef.current || !infoWindowRef.current) return;
    const maps = window.google?.maps;
    if (!maps) return;
    focusMapOnPlace(selectedPlace, maps, mapInstanceRef.current, infoWindowRef.current);
  }, [selectedPlaceId, selectedPlace, focusMapOnPlace]);

  const handleNearbyModeAll = useCallback(() => {
    setNearbyMode('off');
    setNearbyAnchorPlaceId(null);
    setNearbyLocating(false);
  }, []);

  const handleNearbyModeMe = useCallback(() => {
    setNearbyMode('me');
    setNearbyAnchorPlaceId(null);
    if (userLocation) {
      userLocationRef.current = userLocation;
      return;
    }
    setNearbyLocating(true);
    if (!navigator.geolocation) {
      setNearbyLocating(false);
      setNearbyMode('off');
      setMyLocationNotice('unsupported');
      return;
    }
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setNearbyLocating(false);
      setNearbyMode('off');
      setMyLocationNotice('unavailable');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        userLocationRef.current = loc;
        setUserLocation(loc);
        setNearbyLocating(false);
        setMyLocationNotice(null);
      },
      (err) => {
        setNearbyLocating(false);
        setNearbyMode('off');
        const code = err?.code;
        if (code === 1) setMyLocationNotice('denied');
        else setMyLocationNotice('unavailable');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  }, [userLocation]);

  const handleNearbyModePlace = useCallback(() => {
    const sp = coordsById.get(String(selectedPlaceId));
    if (!sp || sp.latitude == null || sp.longitude == null) return;
    setNearbyAnchorPlaceId(selectedPlaceId);
    setNearbyMode('place');
  }, [selectedPlaceId, coordsById]);

  const handleNearbyModeTrip = useCallback(() => {
    setNearbyMode('trip');
    setListOpen(true);
    setSwipeDeckIndex(0);
  }, []);

  const handleMyLocation = useCallback(() => {
    setMyLocationNotice(null);
    if (!mapInstanceRef.current) return;
    if (!navigator.geolocation) {
      setMyLocationNotice('unsupported');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        userLocationRef.current = loc;
        if (mapInstanceRef.current) {
          mapInstanceRef.current.panTo(loc);
          mapInstanceRef.current.setZoom(DETAIL_MAP_ZOOM);
        }
        setUserLocation(loc);
        setMyLocationNotice(null);
      },
      (err) => {
        const code = err?.code;
        if (code === 1) setMyLocationNotice('denied');
        else setMyLocationNotice('unavailable');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, []);

  const startLiveNavigation = useCallback(() => {
    setLiveNavError(null);
    setLiveNavErrorDebug('');
    if (!navigator.geolocation) {
      setLiveNavError('noGeolocation');
      return;
    }
    // iOS Safari only shows geolocation permission in a secure context (https).
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setLiveNavRequestingPermission(false);
      setLiveNavError('insecureContext');
      return;
    }
    const applyLiveNavLocation = (pos) => {
      setLiveNavRequestingPermission(false);
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      userLocationRef.current = loc;
      setUserLocation(loc);
      lastLiveRouteTriggerRef.current = Date.now();
      prevWatchPositionRef.current = loc;
      setLiveNavigation(true);
      setLiveNavFollowing(true);
      setRouteRefreshTick((t) => t + 1);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.panTo(loc);
      }
    };
    setLiveNavRequestingPermission(true);
    getCurrentPositionWithSafariFallback()
      .catch((firstErr) => {
        // Safari often succeeds with watchPosition even when initial getCurrentPosition fails.
        return getFirstWatchPosition(
          { enableHighAccuracy: false, maximumAge: 180000, timeout: 25000 },
          25000
        ).catch(() => {
          throw firstErr;
        });
      })
      .then((pos) => {
        applyLiveNavLocation(pos);
      })
      .catch((err) => {
        setLiveNavRequestingPermission(false);
        const denied = isPermissionDeniedError(err);
        setLiveNavErrorDebug(formatGeoErrorDebug(err));
        if (denied) {
          if (canRedirectToChrome) {
            // No extra manual steps: jump to the same trip + live nav in Chrome.
            void handleOpenInChrome();
          }
          setLiveNavError('denied');
        } else {
          setLiveNavError('unavailable');
        }
      });
  }, [canRedirectToChrome, handleOpenInChrome]);

  useEffect(() => {
    const shouldAutoStart = searchParams.get('autostart') === '1';
    if (!shouldAutoStart) return;
    if (liveNavigation || liveNavRequestingPermission) return;
    if (!tripFilterName || placesInTripOrder.length < 1) return;
    startLiveNavigation();
    const next = new URLSearchParams(searchParams);
    next.delete('autostart');
    navigate(
      {
        pathname: location.pathname,
        search: next.toString() ? `?${next.toString()}` : '',
      },
      { replace: true, state: location.state }
    );
  }, [
    searchParams.toString(),
    liveNavigation,
    liveNavRequestingPermission,
    tripFilterName,
    placesInTripOrder.length,
    startLiveNavigation,
    navigate,
    location.pathname,
    location.state,
  ]);

  const handleDirections = useCallback(
    (place) => {
      if (!place) return;
      const pid = String(place.id);
      const name = place._google?.name || place.name || pid;
      navigate('/map', {
        state: {
          tripPlaceIds: [pid],
          tripDays: [{ placeIds: [pid] }],
          tripName: name,
        },
      });
      setListOpen(false);
    },
    [navigate]
  );

  const stopLiveNavigation = useCallback(() => {
    setLiveNavigation(false);
    setLiveNavFollowing(false);
    setLiveNavDirectionsExpanded(false);
    setLiveNavError(null);
    setLiveNavErrorDebug('');
    setLiveNavRequestingPermission(false);
    prevWatchPositionRef.current = null;
    setRouteRefreshTick((t) => t + 1);
  }, []);

  useEffect(() => {
    if (!liveNavigation || typeof navigator === 'undefined' || !navigator.geolocation) return undefined;
    const onPosition = (pos) => {
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      userLocationRef.current = loc;
      setUserLocation(loc);
      if (liveNavFollowing && mapInstanceRef.current) {
        mapInstanceRef.current.panTo(loc);
      }
      const now = Date.now();
      const prev = prevWatchPositionRef.current;
      const moved = prev ? haversineMeters(prev, loc) : LIVE_ROUTE_MIN_MOVE_M;
      prevWatchPositionRef.current = loc;
      if (now - lastLiveRouteTriggerRef.current >= LIVE_ROUTE_MIN_INTERVAL_MS || moved >= LIVE_ROUTE_MIN_MOVE_M) {
        lastLiveRouteTriggerRef.current = now;
        setRouteRefreshTick((t) => t + 1);
      }
    };
    const watchId = navigator.geolocation.watchPosition(
      onPosition,
      (err) => {
        setLiveNavErrorDebug(formatGeoErrorDebug(err));
        if (isPermissionDeniedError(err)) setLiveNavError('denied');
        else if (err?.code != null) setLiveNavError('unavailable');
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 25000,
      }
    );
    const intervalId = setInterval(() => {
      setRouteRefreshTick((t) => t + 1);
    }, 45000);
    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearInterval(intervalId);
    };
  }, [liveNavigation, liveNavFollowing]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const maps = window.google?.maps;
    if (!map || !maps) return;
    if (liveNavigation && userLocation) {
      if (!userMarkerRef.current) {
        userMarkerRef.current = new maps.Marker({
          position: userLocation,
          map,
          zIndex: 10000,
          title: 'You',
          icon: {
            path: maps.SymbolPath.CIRCLE,
            fillColor: '#1a73e8',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 3,
            scale: 11,
          },
        });
      } else {
        userMarkerRef.current.setPosition(userLocation);
        userMarkerRef.current.setMap(map);
      }
    } else if (userMarkerRef.current) {
      userMarkerRef.current.setMap(null);
      userMarkerRef.current = null;
    }
  }, [liveNavigation, userLocation]);

  const handleZoomToFit = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map || markersRef.current.length === 0) return;
    const bounds = new window.google.maps.LatLngBounds();
    markersRef.current.forEach((m) => bounds.extend(m.marker.getPosition()));
    const leftPadding = tripFilterName ? 400 : MAP_FIT_PADDING;
    const bottomPadding = listOpen && !tripFilterName ? 320 : MAP_FIT_PADDING;
    map.fitBounds(bounds, {
      top: tripFilterName ? MAP_FIT_PADDING + 8 : MAP_FIT_PADDING + 16,
      right: MAP_FIT_PADDING,
      bottom: bottomPadding,
      left: leftPadding,
    });
  }, [listOpen, tripFilterName]);

  const handleShowAllPlaces = useCallback(() => {
    navigate('/map', { replace: true });
  }, [navigate]);

  const dismissMapOnboarding = useCallback(() => {
    setShowMapOnboarding(false);
    try {
      window.localStorage.setItem('mapOnboardingSeen', '1');
    } catch {
      /* ignore storage issues */
    }
  }, []);

  if (!apiKey) {
    return (
      <div className="vd map-page" role="main">
        <div className="map-full-bleed">
          <div className="map-no-key">
            <p><strong>Google Map</strong></p>
            <p>Add <code>VITE_GOOGLE_MAPS_API_KEY</code> to <code>client/.env</code> and enable Maps JavaScript API.</p>
          </div>
        </div>
      </div>
    );
  }

  const nextTurnText = routeSummary?.steps?.[0] || routeSummary?.via || '';
  const hasTripRoutePanel = Boolean(
    tripFilterName && (placesInTripOrder.length >= 1 || (tripDays?.length > 0))
  );
  const showTripRoutePanel = hasTripRoutePanel && (!liveNavigation || liveNavDirectionsExpanded);

  return (
    <div
      className={`vd map-page map-page--google${liveNavigation ? ' map-page--live-nav' : ''}${
        liveNavigation && !liveNavDirectionsExpanded ? ' map-page--live-nav-collapsed' : ''
      }${routePanelCollapsed ? ' map-page--route-panel-collapsed' : ''}${listOpen ? ' map-page--list-open' : ''}${
        tripFilterName ? ' map-page--trip-route' : ''
      }`}
      role="main"
      aria-label={t('home', 'mapPageTitle')}
    >
      <div className="map-full-bleed">
        <div ref={mapRef} className="map-canvas" />
        {liveNavigation && (
          <button type="button" className="map-live-nav-exit" onClick={stopLiveNavigation}>
            <Icon name="close" size={22} /> {t('home', 'liveNavStop')}
          </button>
        )}
        {liveNavigation && !liveNavFollowing && (
          <button
            type="button"
            className="map-live-nav-recenter"
            onClick={() => {
              setLiveNavFollowing(true);
              const ul = userLocationRef.current;
              if (ul && mapInstanceRef.current) {
                mapInstanceRef.current.panTo(ul);
              }
            }}
          >
            <Icon name="my_location" size={20} /> {t('home', 'recenterMap') || 'Recenter'}
          </button>
        )}
        {tripFilterName && (
          <div
            className={`map-trip-banner${liveNavigation ? ' map-trip-banner--hidden' : ''}`}
            role="status"
          >
            <span className="map-trip-banner-label">
              <Icon name="route" size={20} />{' '}
              {tripDayLabel || `${t('home', 'viewingTrip')}: ${tripFilterName}`}
              {placesInTripOrder.length >= 2 && !directionsError && (
                <span className="map-trip-banner-route"> Â· {t('home', 'routeShown') || 'Route shown'}</span>
              )}
              {directionsError && (
                <span className="map-trip-banner-route map-trip-banner-route--error"> Â· {t('home', 'routeUnavailable') || 'Route unavailable'}</span>
              )}
            </span>
            <button type="button" className="map-trip-banner-btn" onClick={handleShowAllPlaces}>
              {t('home', 'showAllPlaces')}
            </button>
          </div>
        )}
        {mapError && (
          <div className="map-error-card" role="alert">
            <div className="map-error-card-inner">
              <h3 className="map-error-title">{t('home', 'mapLoadErrorTitle')}</h3>
              <p className="map-error-message">{mapError}</p>
              <p className="map-error-steps-title">{t('home', 'mapLoadErrorFixTitle')}</p>
              <ol className="map-error-steps">
                <li>{t('home', 'mapLoadErrorStepApi')}</li>
                <li>{t('home', 'mapLoadErrorStepBilling')}</li>
                <li>{t('home', 'mapLoadErrorStepReferrers')}</li>
              </ol>
              <p className="map-error-console">{t('home', 'mapLoadErrorConsoleHint')}</p>
              <p className="map-error-https-hint">{t('home', 'mapLoadErrorHttpsHint')}</p>
              <button type="button" className="map-error-dismiss" onClick={() => setMapError(null)}>
                {t('home', 'mapLoadErrorDismiss')}
              </button>
            </div>
          </div>
        )}
        {myLocationNotice && (
          <div className="map-geo-toast" role="status">
            <p className="map-geo-toast-text">
              {myLocationNotice === 'denied'
                ? t('home', 'mapMyLocationDenied')
                : myLocationNotice === 'unsupported'
                  ? t('home', 'mapMyLocationUnsupported')
                  : t('home', 'mapMyLocationUnavailable')}
            </p>
            <button type="button" className="map-geo-toast-dismiss" onClick={() => setMyLocationNotice(null)}>
              {t('home', 'mapGeoToastDismiss')}
            </button>
          </div>
        )}
        {(loading || fetchingPlaces) && (
          <div className="map-loading-overlay">
            <div className="map-loading-spinner" />
            <span>{loading ? t('home', 'loading') : 'Loading places from Google Maps…'}</span>
          </div>
        )}

        {showMapOnboarding && (
          <div className="map-onboarding-hint" role="status" aria-live="polite">
            <p className="map-onboarding-title">{t('home', 'mapPageTitle')}</p>
            <p className="map-onboarding-text">
              Tap <strong>List</strong> to browse places, tap a pin or card to focus one place, and use
              <strong> Near me</strong> to sort by distance from your current location.
            </p>
            <button type="button" className="map-onboarding-dismiss" onClick={dismissMapOnboarding}>
              Got it
            </button>
          </div>
        )}

        {/* Floating search — hidden in trip/tour mode (VisitTripoliApp map_screen). */}
        {(!tripFilterName || addingTripStop) && (
          <div
            className={`map-search-wrap${addingTripStop ? ' map-search-wrap--add-stop' : ''}`}
          >
            <GlobalSearchBar
              className="global-search-bar--full map-page-global-search"
              idPrefix="map-search"
              queryValue={searchQuery}
              onQueryChange={setSearchQuery}
              onSelectPlace={handleMapSearchPick}
            />
          </div>
        )}

        {/* List toggle — hidden during live navigation */}
        <button
          type="button"
          className={`map-fab map-fab--list${liveNavigation ? ' map-fab--hidden' : ''}`}
          onClick={() => setListOpen((o) => !o)}
          aria-label={listOpen ? 'Close list' : 'Open places list'}
          aria-expanded={listOpen}
        >
          <Icon name={listOpen ? 'close' : 'list'} size={24} />
        </button>

        {/* My location */}
        <button
          type="button"
          className="map-fab map-fab--location"
          onClick={handleMyLocation}
          aria-label="My location"
        >
          <Icon name="my_location" size={24} />
        </button>

        {/* Zoom to fit */}
        {markersVisibleOnMap.length > 1 && (
          <button type="button" className="map-fab map-fab--fit" onClick={handleZoomToFit} aria-label="Fit all places">
            <Icon name="fit_screen" size={22} />
          </button>
        )}

        {/* Zoom controls (Google style) */}
        <div className="map-zoom-controls">
          <button type="button" className="map-zoom-btn" onClick={() => mapInstanceRef.current?.setZoom((mapInstanceRef.current.getZoom() || DEFAULT_ZOOM) + 1)} aria-label="Zoom in">
            <Icon name="add" size={24} />
          </button>
          <button type="button" className="map-zoom-btn" onClick={() => mapInstanceRef.current?.setZoom((mapInstanceRef.current.getZoom() || DEFAULT_ZOOM) - 1)} aria-label="Zoom out">
            <Icon name="remove" size={24} />
          </button>
        </div>

        {/* Live navigation: slim peek bar so the map stays visible; tap for full directions */}
        {hasTripRoutePanel &&
          liveNavigation &&
          !liveNavDirectionsExpanded &&
          (
            <button
              type="button"
              className="map-live-nav-peek"
              onClick={() => setLiveNavDirectionsExpanded(true)}
              aria-label={t('home', 'liveNavPeekExpand')}
            >
              <span className="map-live-nav-peek-handle" aria-hidden="true" />
              {liveNavError ? (
                <div className="map-live-nav-peek-inner map-live-nav-peek-inner--alert" role="alert">
                  <p className="map-live-nav-peek-alert-text">
                    {liveNavError === 'denied'
                      ? t('home', 'liveNavDenied')
                      : liveNavError === 'unavailable'
                        ? t('home', 'liveNavLocationFailed')
                        : liveNavError === 'insecureContext'
                          ? t('home', 'liveNavInsecureContext')
                          : t('home', 'liveNavNoGeo')}
                  </p>
                  <span className="map-live-nav-peek-hint">{t('home', 'liveNavPeekExpand')}</span>
                  <Icon name="keyboard_arrow_up" size={26} className="map-live-nav-peek-chevron" />
                </div>
              ) : (
                <div className="map-live-nav-peek-inner">
                  <div className="map-live-nav-peek-row">
                    {routeSummary ? (
                      <span className="map-live-nav-peek-eta">
                        <strong>{routeSummary.durationText}</strong>
                        <span className="map-live-nav-peek-sep"> Â· </span>
                        <span>{routeSummary.distanceText}</span>
                      </span>
                    ) : (
                      <span className="map-live-nav-peek-eta map-live-nav-peek-eta--muted">{t('home', 'liveNavPeekUpdating')}</span>
                    )}
                    <Icon name="keyboard_arrow_up" size={26} className="map-live-nav-peek-chevron" />
                  </div>
                  {nextTurnText ? (
                    <p className="map-live-nav-peek-turn">{nextTurnText}</p>
                  ) : null}
                </div>
              )}
            </button>
          )}

        {/* Trip route panel (right sidebar) – when viewing a trip; hidden during live nav until user expands */}
        {hasTripRoutePanel && !liveNavigation && routePanelCollapsed && (
          <button
            type="button"
            className="map-route-mobile-show-panel"
            onClick={() => setRoutePanelCollapsed(false)}
            aria-label={t('home', 'liveNavPeekExpand')}
          >
            <Icon name="keyboard_arrow_up" size={22} />
            <span>{t('home', 'liveNavPeekExpand')}</span>
          </button>
        )}

        {showTripRoutePanel && (
          <div
            className={`map-trip-route-panel gm-directions-panel${routePanelCollapsed ? ' map-trip-route-panel--mobile-hidden' : ''}`}
            role="complementary"
            aria-label={t('home', 'viewingTrip')}
          >
            <div className="map-trip-route-panel-inner">
              <div className="map-trip-route-panel-handle" aria-hidden="true" />
              {!liveNavigation && (
                <button
                  type="button"
                  className="map-route-mobile-hide-panel"
                  onClick={() => setRoutePanelCollapsed(true)}
                  aria-label={t('home', 'liveNavCollapseToMap')}
                >
                  <Icon name="keyboard_arrow_down" size={22} />
                  <span>{t('home', 'liveNavCollapseToMap')}</span>
                </button>
              )}
              {liveNavigation && (
                <button
                  type="button"
                  className="map-live-nav-collapse-bar"
                  onClick={() => setLiveNavDirectionsExpanded(false)}
                  aria-label={t('home', 'liveNavCollapseToMap')}
                >
                  <Icon name="keyboard_arrow_down" size={22} />
                  <span>{t('home', 'liveNavCollapseToMap')}</span>
                </button>
              )}
              {/* Day selector – one route per day */}
              {Array.isArray(tripDays) && tripDays.length > 1 && (
                <div className="map-trip-route-days">
                  {tripDays.map((day, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`map-trip-route-day-btn ${selectedDayIndex === i ? 'map-trip-route-day-btn--active' : ''}`}
                      onClick={() => setSelectedDayIndex(i)}
                      aria-pressed={selectedDayIndex === i}
                    >
                      <span className="map-trip-route-day-num">{t('home', 'dayLabel')} {i + 1}</span>
                      {tripStartDate && (
                        <span className="map-trip-route-day-date">{getDateForDayLabel(tripStartDate, i)}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* NEW PREMIUM DIRECTIONS PANEL */}
              <div className="map-route-modern-container">
                <div className="map-route-drag-handle" />
                
                {/* 1. High-Contrast Summary Header */}
                {routeSummary && (
                  <div className="map-route-header-v2">
                    <div className="map-route-header-main">
                      <div className="map-route-eta-group">
                        <span className="map-route-eta-val">{routeSummary.durationText}</span>
                        <span className="map-route-eta-sub">{routeSummary.distanceText}</span>
                      </div>
                      <div className="map-route-mode-pill">
                        <Icon name={travelMode === 'WALKING' ? 'walking' : 'car'} size={18} />
                        <span>{t('home', travelMode === 'WALKING' ? 'travelModeWalk' : 'travelModeCar')}</span>
                      </div>
                    </div>
                    {liveNavigation && nextTurnText && (
                      <div className="map-route-next-turn-banner">
                        <div className="map-route-turn-icon">
                          <Icon name={getTurnIcon(nextTurnText)} size={28} />
                        </div>
                        <div className="map-route-turn-text">{nextTurnText}</div>
                      </div>
                    )}
                  </div>
                )}

                <div className="map-route-scroll-area">
                  {/* 2. Onboarding / Start Action */}
                  {placesInTripOrder.length >= 1 && !liveNavigation && (
                    <div className="map-route-action-area">
                      <button
                        type="button"
                        className="map-route-start-btn-v2"
                        onClick={startButtonOpensChrome ? handleOpenInChrome : startLiveNavigation}
                        disabled={liveNavRequestingPermission}
                      >
                        <Icon name={startButtonOpensChrome ? 'open_in_new' : 'navigation'} size={24} />
                        <strong>{startButtonOpensChrome ? t('home', 'liveNavOpenInChrome') : t('home', 'liveNavStart')}</strong>
                      </button>
                      <p className="map-route-hint-v2">{t('home', 'liveNavStartHint')}</p>
                    </div>
                  )}

                  {/* 3. Mode Toggle */}
                  <div className="map-route-modes-v2">
                    {TRAVEL_MODES.map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        className={`map-route-mode-tab ${travelMode === mode.id ? 'active' : ''}`}
                        onClick={() => setTravelMode(mode.id)}
                        aria-pressed={travelMode === mode.id}
                        title={t('home', mode.labelKey)}
                      >
                        <Icon name={mode.icon} size={20} />
                        <span>{t('home', mode.labelKey)}</span>
                      </button>
                    ))}
                  </div>

                  {/* Waypoints Section */}
                  <div className="map-route-section">
                    <h4 className="map-route-section-title">{t('home', 'viewingTrip')}</h4>
                    <div className="map-route-waypoints-v2">
                      {currentDayPlacesForList.map((p, index) => {
                        const isLast = index === currentDayPlacesForList.length - 1;
                        const isFirst = index === 0;
                        return (
                          <div key={p.id} className={`map-route-stop ${isFirst ? 'is-start' : ''} ${isLast ? 'is-end' : ''}`}>
                            <div className="map-route-stop-indicator">
                              <div className="map-route-stop-line" />
                              <div className="map-route-stop-point">
                                {isFirst ? <Icon name="trip_origin" size={16} /> : isLast ? <Icon name="location_on" size={16} /> : <div className="dot-inner" />}
                              </div>
                            </div>
                            <div className="map-route-stop-info">
                              <span className="map-route-stop-name">{p._google?.name || p.name || p.id}</span>
                              <span className="map-route-stop-loc">{p._google?.formatted_address || p.location || ''}</span>
                            </div>
                          </div>
                        );
                      })}
                      {addingTripStop ? (
                        <div className="map-route-add-destination-active">
                          <p>{t('home', 'mapAddStopHint')}</p>
                          <button
                            type="button"
                            onClick={() => {
                              setAddingTripStop(false);
                              setSearchQuery('');
                            }}
                          >
                            {t('home', 'mapAddStopDone')}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="map-route-add-destination-btn"
                          disabled={liveNavigation}
                          onClick={() => {
                            setAddingTripStop(true);
                            setListOpen(true);
                            setNearbyMode('off');
                            setSearchQuery('');
                            setSwipeDeckIndex(0);
                          }}
                        >
                          <Icon name="add" size={20} />
                          <span>{t('home', 'addDestination')}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Step-by-Step Section */}
                  {routeSummary && (
                    <div className="map-route-section map-route-section--steps">
                      <button
                        type="button"
                        className="map-route-expand-steps"
                        onClick={() => setRouteDetailsOpen(!routeDetailsOpen)}
                      >
                        <span>{t('home', 'details')}</span>
                        <Icon name={routeDetailsOpen ? 'expand_less' : 'expand_more'} size={20} />
                      </button>
                      
                      {routeDetailsOpen && directionsResult?.routes?.[0]?.legs && (
                        <div className="map-route-steps-list-v2">
                          {directionsResult.routes[0].legs.flatMap((leg, legIndex) =>
                            (leg.steps || []).map((step, stepIndex) => (
                              <div key={`${legIndex}-${stepIndex}`} className="map-route-step-v2">
                                <Icon name={getTurnIcon(step.instructions)} size={20} className="step-icon" />
                                <div className="step-content">
                                  <p className="step-instr">{stripHtml(step.instructions)}</p>
                                  {step.distance?.text && <span className="step-dist">{step.distance.text}</span>}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Options (Share, Send to phone) */}
              <div className={`map-trip-route-options${liveNavigation ? ' map-trip-route-options--compact' : ''}`}>
                <button type="button" className="map-trip-route-opt-btn" onClick={handleCopyRouteLink}>
                  <Icon name="link" size={20} />
                  <span>{t('home', 'copyLink')}</span>
                </button>
                <button type="button" className="map-trip-route-opt-btn" onClick={handleSendToPhone}>
                  <Icon name="smartphone" size={20} />
                  <span>{t('home', 'sendToPhone')}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Places list: unified sheet (filters + list) */}
        <div className={`map-drawer ${listOpen ? 'map-drawer--open' : ''}`}>
          <div className="map-drawer-sheet">
            {!addingTripStop && listOpen && (
              <div
                className="map-drawer-segmented"
                role="group"
                aria-label={t('home', 'mapNearbyGroupAria')}
              >
                <button
                  type="button"
                  className={`map-drawer-nearby-btn ${nearbyMode === 'off' ? 'map-drawer-nearby-btn--active' : ''}`}
                  onClick={handleNearbyModeAll}
                  aria-pressed={nearbyMode === 'off'}
                >
                  <Icon name="list" size={18} />
                  <span>{t('home', 'mapNearbyAll')}</span>
                </button>
                <button
                  type="button"
                  className={`map-drawer-nearby-btn ${nearbyMode === 'me' ? 'map-drawer-nearby-btn--active' : ''}`}
                  onClick={handleNearbyModeMe}
                  aria-pressed={nearbyMode === 'me'}
                >
                  <Icon name="my_location" size={18} />
                  <span>{t('home', 'mapNearbyNearMe')}</span>
                </button>
                <button
                  type="button"
                  className={`map-drawer-nearby-btn ${nearbyMode === 'place' ? 'map-drawer-nearby-btn--active' : ''}`}
                  onClick={handleNearbyModePlace}
                  disabled={!nearbyFromSelectionReady}
                  title={!nearbyFromSelectionReady ? t('home', 'mapNearbySelectForDisabledTitle') : undefined}
                  aria-pressed={nearbyMode === 'place'}
                >
                  <Icon name="place" size={18} />
                  <span>{t('home', 'mapNearbyNearSelection')}</span>
                </button>
                {tripFilterName && placesInTripOrder.length > 0 && (
                  <button
                    type="button"
                    className={`map-drawer-nearby-btn ${nearbyMode === 'trip' ? 'map-drawer-nearby-btn--active' : ''}`}
                    onClick={handleNearbyModeTrip}
                    aria-pressed={nearbyMode === 'trip'}
                  >
                    <Icon name="route" size={18} />
                    <span>{t('home', 'mapNearbyNearTrip')}</span>
                  </button>
                )}
              </div>
            )}
            <div className="map-drawer-header">
              <div className="map-drawer-title-row">
                <div className="map-drawer-title-wrap">
                  <h2 className="map-drawer-title">{t('home', 'mapPageTitle')}</h2>
                  <p className="map-drawer-sub">
                    {nearbyMode === 'off' && t('home', 'mapNearbyCount').replace('{n}', String(drawerPlaces.length))}
                    {nearbyMode === 'me' && nearbyLocating && t('home', 'mapNearbyGettingLocation')}
                    {nearbyMode === 'me' && !nearbyLocating &&
                      t('home', 'mapNearbyCount').replace('{n}', String(listForDrawer.length))}
                    {nearbyMode === 'place' &&
                      t('home', 'mapNearbyCount').replace('{n}', String(listForDrawer.length))}
                    {nearbyMode === 'trip' &&
                      t('home', 'mapNearbyCount').replace('{n}', String(listForDrawer.length))}
                  </p>
                </div>
                <button type="button" className="map-drawer-close" onClick={() => setListOpen(false)} aria-label="Close">
                  <Icon name="close" size={24} />
                </button>
              </div>

              {addingTripStop && (
                <div className="map-drawer-search-row">
                  <div className="map-drawer-search-input-wrap">
                    <Icon name="search" size={20} />
                    <input
                      type="text"
                      className="map-drawer-search-input"
                      placeholder={t('home', 'mapDrawerSearchPlaceholder')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      autoFocus
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        className="map-drawer-search-clear"
                        onClick={() => setSearchQuery('')}
                      >
                        <Icon name="close" size={18} />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {nearbyMode === 'me' && !nearbyLocating && (
                <p className="map-drawer-nearby-hint">{t('home', 'mapNearbySortedFromYou')}</p>
              )}
              {nearbyMode === 'place' && (
                <p className="map-drawer-nearby-hint">{t('home', 'mapNearbySortedFromPlace')}</p>
              )}
              {nearbyMode === 'trip' && (
                <p className="map-drawer-nearby-hint">{t('home', 'mapNearbySortedFromTrip')}</p>
              )}
            </div>
          <div className="map-drawer-list">
            {listForDrawer.length === 0 ? (
              <p className="map-drawer-empty">
                {nearbyMode === 'me' && nearbyLocating
                  ? t('home', 'mapNearbyGettingLocation')
                  : nearbyMode !== 'off'
                    ? t('home', 'mapNearbyNoCoordsInList')
                    : searchQuery
                      ? t('home', 'mapDrawerEmptySearch')
                      : t('home', 'mapDrawerEmptyNoLocations')}
              </p>
            ) : (
              <MapDrawerSwipeDeck
                places={listForDrawer}
                index={swipeDeckIndex}
                setIndex={setSwipeDeckIndex}
                apiKey={apiKey}
                t={t}
                nearbyMode={nearbyMode}
                onPlaceSelect={addingTripStop ? handlePlaceSelect : undefined}
                onDirections={handleDirections}
              />
            )}
          </div>
          </div>
        </div>
        <div className={`map-drawer-backdrop ${listOpen ? 'map-drawer-backdrop--visible' : ''}`} onClick={() => setListOpen(false)} aria-hidden="true" />
      </div>
    </div>
  );
}

const MAP_DRAWER_SWIPE_THRESHOLD_PX = 56;

function MapDrawerSwipeDeck({ places, index, setIndex, apiKey, t, nearbyMode, onPlaceSelect, onDirections }) {
  const [dragPx, setDragPx] = useState(0);
  const dragStartXRef = useRef(null);
  const capturingRef = useRef(false);

  const onDeckKeyDown = useCallback(
    (e) => {
      if (places.length <= 1) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setIndex((i) => Math.min(places.length - 1, i + 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setIndex((i) => Math.max(0, i - 1));
      }
    },
    [places.length, setIndex]
  );

  const finishSwipeFromEvent = useCallback(
    (e) => {
      if (!capturingRef.current || dragStartXRef.current == null) return;
      const start = dragStartXRef.current;
      const clientX = e?.clientX ?? start;
      const dx = clientX - start;
      capturingRef.current = false;
      dragStartXRef.current = null;
      setDragPx(0);
      if (dx <= -MAP_DRAWER_SWIPE_THRESHOLD_PX) {
        setIndex((i) => Math.min(places.length - 1, i + 1));
      } else if (dx >= MAP_DRAWER_SWIPE_THRESHOLD_PX) {
        setIndex((i) => Math.max(0, i - 1));
      }
    },
    [places.length, setIndex]
  );

  const onPointerDown = (e) => {
    if (places.length <= 1 || e.button !== 0) return;
    // Don't capture if the user clicked a link or button — let those handle their own events
    if (e.target.closest('a, button')) return;
    dragStartXRef.current = e.clientX;
    capturingRef.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_err) {
      /* ignore */
    }
  };

  const onPointerMove = (e) => {
    if (!capturingRef.current || dragStartXRef.current == null) return;
    setDragPx(e.clientX - dragStartXRef.current);
  };

  const onPointerUp = (e) => {
    try {
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch (_err) {
      /* ignore */
    }
    finishSwipeFromEvent(e);
  };

  const onPointerCancel = () => {
    capturingRef.current = false;
    dragStartXRef.current = null;
    setDragPx(0);
  };

  const current = places[index];
  if (!current) return null;

  return (
    <div
      className="map-drawer-swipe"
      tabIndex={0}
      role="region"
      aria-roledescription="carousel"
      aria-label={t('home', 'mapSwipeDeckAria')}
      onKeyDown={onDeckKeyDown}
    >
      <p className="map-drawer-swipe-hint">{t('home', 'mapSwipeDeckHint')}</p>
      <div className="map-drawer-swipe-main">
        <button
          type="button"
          className="map-drawer-swipe-arrow map-drawer-swipe-arrow--prev"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index <= 0}
          aria-label={t('home', 'mapSwipePrev')}
        >
          <Icon name="chevron_left" size={28} />
        </button>
        <div
          className="map-drawer-swipe-viewport"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        >
          <div
            className="map-drawer-swipe-track"
            style={{
              transform: `translateX(calc(-${index * 100}% + ${dragPx}px))`,
              transition:
                dragPx !== 0 ? 'none' : 'transform 0.38s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            {places.map((p, slideIndex) => {
              const g = p._google;
              const name = g?.name || p.name || p.id;
              const loc = g?.formatted_address || p.location;
              const dbRating = p.rating != null && Number.isFinite(Number(p.rating)) ? Number(p.rating) : null;
              const rating = dbRating ?? (g?.rating != null ? Number(g.rating) : null);
              const dbReviews = p.reviewCount != null && Number.isFinite(Number(p.reviewCount)) ? Number(p.reviewCount) : null;
              const reviews = dbReviews ?? g?.user_ratings_total ?? null;
              const openNow = g?.opening_hours && typeof g.opening_hours.open_now === 'boolean'
                ? g.opening_hours.open_now
                : null;
              const distTitle =
                nearbyMode === 'place'
                  ? t('home', 'mapNearbySortedFromPlace')
                  : t('home', 'mapNearbySortedFromYou');
              const showDist = p._distanceM != null && Number.isFinite(p._distanceM);
              const distLabel = showDist ? formatMapDistanceM(p._distanceM) : null;
              const rawImg =
                (g?.photo_reference && placePhotoUrl(g.photo_reference, apiKey)) ||
                p.image ||
                (Array.isArray(p.images) && p.images[0]) ||
                '';
              const imgUrl = rawImg ? getPlaceImageUrl(rawImg) || rawImg : null;
              const pid = String(p.id);
              return (
                <article key={pid} className="map-drawer-swipe-slide">
                  <div className="map-drawer-swipe-media">
                    {imgUrl ? (
                      <DeliveryImg
                        url={imgUrl}
                        preset="gridCard"
                        alt=""
                        loading={slideIndex === index ? 'eager' : 'lazy'}
                      />
                    ) : (
                      <span className="map-drawer-swipe-media-fallback" aria-hidden="true">
                        <Icon name="place" size={40} />
                      </span>
                    )}
                  </div>
                  <div className="map-drawer-swipe-body">
                    <div className="map-drawer-swipe-title-row">
                      <h3 className="map-drawer-swipe-name">{name}</h3>
                      {distLabel && (
                        <span className="map-drawer-swipe-distance" title={distTitle}>
                          {distLabel}
                        </span>
                      )}
                    </div>
                    {loc && <p className="map-drawer-swipe-loc">{loc}</p>}
                    <div className="map-drawer-swipe-meta">
                      {rating != null && (
                        <span className="map-drawer-swipe-rating">
                          <Icon name="star" size={14} /> {Number(rating).toFixed(1)}
                          {reviews != null && ` (${reviews})`}
                        </span>
                      )}
                      {openNow !== null && (
                        <span
                          className={`map-drawer-swipe-open ${openNow ? 'map-drawer-swipe-open--yes' : 'map-drawer-swipe-open--no'}`}
                        >
                          {openNow ? t('detail', 'openNow') : t('detail', 'closedNow')}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="map-drawer-swipe-directions"
                      onClick={() => onDirections(p)}
                    >
                      {t('home', 'mapDirections')} →
                    </button>
                    <Link to={`/place/${pid}`} className="map-drawer-swipe-details">
                      {t('home', 'viewDetails')} {lang === 'ar' ? '←' : '→'}
                    </Link>
                    {onPlaceSelect && (
                      <button
                        type="button"
                        className="map-drawer-swipe-select-btn"
                        onClick={() => onPlaceSelect(current)}
                      >
                        <Icon name="add" size={18} />
                        <span>{t('home', 'addToTrip')}</span>
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
        <button
          type="button"
          className="map-drawer-swipe-arrow map-drawer-swipe-arrow--next"
          onClick={() => setIndex((i) => Math.min(places.length - 1, i + 1))}
          disabled={index >= places.length - 1}
          aria-label={t('home', 'mapSwipeNext')}
        >
          <Icon name="chevron_right" size={28} />
        </button>
      </div>
      <p className="map-drawer-swipe-counter" aria-live="polite">
        {t('home', 'mapSwipeCounter')
          .replace('{current}', String(index + 1))
          .replace('{total}', String(places.length))}
      </p>
    </div>
  );
}

function buildInfoContent(p, apiKey = '', strings = {}, isDark = false) {
  const s = {
    viewDetails: strings.viewDetails ?? `${t('home', 'viewDetails')} ${lang === 'ar' ? '←' : '→'}`,
    directions: strings.directions ?? 'Directions →',
  };
  const placeId = p.id;
  const g = p._google || null;
  const name = g?.name || p.name || p.id;
  const address = g?.formatted_address || p.location || '';
  const dbRating = p.rating != null && Number.isFinite(Number(p.rating)) ? Number(p.rating) : null;
  const rating = dbRating ?? (g?.rating != null ? Number(g.rating) : null);
  const dbReviews = p.reviewCount != null && Number.isFinite(Number(p.reviewCount)) ? Number(p.reviewCount) : null;
  const reviews = dbReviews ?? g?.user_ratings_total ?? null;
  const openNow = g?.opening_hours && typeof g.opening_hours.open_now === 'boolean'
    ? g.opening_hours.open_now
    : null;
  const rawImg =
    (g?.photo_reference && placePhotoUrl(g.photo_reference, apiKey)) ||
    p.image ||
    (Array.isArray(p.images) && p.images[0]) ||
    '';
  const img = rawImg ? (getPlaceImageUrl(rawImg) || rawImg) : '';
  let imgHtml = '';
  if (img) {
    const { src, srcSet, sizes } = getDeliveryImgProps(img, 'similarStrip');
    const srcEsc = escapeHtml(src);
    const setEsc = srcSet ? escapeHtml(srcSet) : '';
    const szEsc = sizes ? escapeHtml(sizes) : '';
    imgHtml = `<img src="${srcEsc}"${setEsc ? ` srcset="${setEsc}"` : ''}${szEsc ? ` sizes="${szEsc}"` : ''} alt="" loading="lazy" decoding="async" width="280" height="100" class="gm-info-image" />`;
  }
  const dirLink =
    placeId != null && String(placeId) !== ''
      ? `<a href="#" class="map-info-directions" data-place-id="${escapeHtml(String(placeId))}" data-trip-name="${encodeURIComponent(name)}">${escapeHtml(s.directions)}</a>`
      : '';
  return `
    <div class="gm-info-content${isDark ? ' gm-info-content--dark' : ''}">
      ${imgHtml}
      <strong class="gm-info-title">${escapeHtml(name)}</strong>
      ${address ? `<p class="gm-info-address">${escapeHtml(address)}</p>` : ''}
      ${rating != null ? `<p class="gm-info-rating">★ ${Number(rating).toFixed(1)}${reviews != null ? ` (${reviews} reviews)` : ''}</p>` : ''}
      ${openNow !== null ? `<p class="gm-info-open ${openNow ? 'gm-info-open--yes' : 'gm-info-open--no'}">${openNow ? 'Open now' : 'Closed'}</p>` : ''}
      <div class="gm-info-actions">
        <a href="/place/${encodeURIComponent(placeId)}" class="map-info-link" data-place-id="${escapeHtml(String(placeId))}">${escapeHtml(s.viewDetails)}</a>
        ${dirLink}
      </div>
    </div>
  `;
}
