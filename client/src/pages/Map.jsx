import { useState, useEffect, useRef, useCallback, useMemo, useDeferredValue } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api, { getPlaceImageUrl } from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import Icon from '../components/Icon';
import { filterPlacesByQuery } from '../utils/searchFilter';
import { asyncPool } from '../utils/asyncPool';
import './Map.css';
import './Explore.css';

const TRIPOLI_CENTER = { lat: 34.4363, lng: 35.8363 };
const DEFAULT_ZOOM = 14;
const PLACES_REGION = 'Tripoli, Lebanon';
const GOOGLE_PLACES_CONCURRENCY = 3;
const GOOGLE_PLACES_DELAY_MS = 200;
const MAP_TYPES = Object.freeze([
  { id: 'roadmap', label: 'Map', icon: 'map' },
  { id: 'satellite', label: 'Satellite', icon: 'satellite_alt' },
  { id: 'terrain', label: 'Terrain', icon: 'terrain' },
]);

const TRAVEL_MODES = Object.freeze([
  { id: 'DRIVING', icon: 'directions_car', labelKey: 'travelModeCar' },
  { id: 'TRANSIT', icon: 'directions_transit', labelKey: 'travelModeTransit' },
  { id: 'WALKING', icon: 'directions_walk', labelKey: 'travelModeWalk' },
  { id: 'BICYCLING', icon: 'directions_bike', labelKey: 'travelModeBicycle' },
]);

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

function getDateForDayLabel(startDate, dayIndex) {
  if (!startDate || typeof startDate !== 'string') return '';
  const d = new Date(String(startDate).slice(0, 10) + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + dayIndex);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function getRouteSummary(directionsResult) {
  const route = directionsResult?.routes?.[0];
  if (!route?.legs?.length) return null;
  let totalDuration = 0;
  let totalDistance = 0;
  let viaText = '';
  const steps = [];
  for (const leg of route.legs) {
    if (leg.duration?.value) totalDuration += leg.duration.value;
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
function placePhotoUrl(photoReference, apiKey, maxWidth = 400) {
  if (!photoReference || !apiKey) return '';
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${encodeURIComponent(photoReference)}&key=${encodeURIComponent(apiKey)}`;
}

function loadGoogleMapsScript(apiKey, onAuthError) {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('No window'));
      return;
    }
    if (window.google?.maps) {
      resolve(window.google.maps);
      return;
    }
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    const hasOurKey = apiKey && existing && existing.src && existing.src.includes(encodeURIComponent(apiKey));
    if (existing && hasOurKey) {
      const check = () => (window.google?.maps ? resolve(window.google.maps) : setTimeout(check, 50));
      check();
      return;
    }
    if (onAuthError && typeof window !== 'undefined') {
      window.gm_authFailure = () => {
        window.gm_authFailure = null;
        onAuthError(new Error('Google Maps rejected the API key. Enable Maps JavaScript API, enable billing, and check key restrictions.'));
      };
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google?.maps || reject(new Error('Maps not loaded')));
    script.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(script);
  });
}

function escapeHtml(s) {
  if (s == null) return '';
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

export default function MapPage() {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const langParam = lang === 'ar' ? 'ar' : lang === 'fr' ? 'fr' : 'en';
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mapError, setMapError] = useState(null);
  const [googlePlaceData, setGooglePlaceData] = useState({});
  const [fetchingPlaces, setFetchingPlaces] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mapTypeId, setMapTypeId] = useState('roadmap');
  const [listOpen, setListOpen] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [tripFilterName, setTripFilterName] = useState(null);
  const [tripPlaceIds, setTripPlaceIds] = useState(null);
  const [tripDays, setTripDays] = useState(null);
  const [tripStartDate, setTripStartDate] = useState('');
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [directionsError, setDirectionsError] = useState(null);
  const [travelMode, setTravelMode] = useState('DRIVING');
  const [directionsResult, setDirectionsResult] = useState(null);
  const [routeDetailsOpen, setRouteDetailsOpen] = useState(false);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const markersByPlaceIdRef = useRef(new Map());
  const infoWindowRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const apiKey = typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_MAPS_API_KEY;

  const placesList = Array.isArray(places) ? places : [];

  useEffect(() => {
    const state = location.state;
    const tripIds = state?.tripPlaceIds;
    const days = state?.tripDays;
    setGooglePlaceData({});
    setTripPlaceIds(null);
    setTripDays(null);
    setTripStartDate(state?.tripStartDate || '');
    setSelectedDayIndex(0);
    if (Array.isArray(tripIds) && tripIds.length > 0) {
      setLoading(true);
      setTripFilterName(state.tripName || 'Trip');
      setTripPlaceIds(tripIds);
      setTripDays(Array.isArray(days) && days.length > 0 ? days : [{ placeIds: tripIds }]);
      Promise.all(tripIds.map((id) => api.places.get(id).catch(() => null)))
        .then((results) => setPlaces(results.filter(Boolean)))
        .catch(() => setPlaces([]))
        .finally(() => setLoading(false));
    } else {
      setLoading(true);
      setTripFilterName(null);
      api.places
        .list({ lang: langParam })
        .then((r) => setPlaces(r.popular || r.locations || []))
        .catch(() => setPlaces([]))
        .finally(() => setLoading(false));
    }
  }, [langParam, location.state]);

  const withNativeCoords = useMemo(
    () => placesList.filter((p) => p.latitude != null && p.longitude != null),
    [placesList]
  );
  const needGoogleData = useMemo(
    () => placesList.filter((p) => p.name || p.location),
    [placesList]
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

  /** Current day's place IDs (for multi-day trips, one day at a time). */
  const currentDayPlaceIds = useMemo(() => {
    const days = Array.isArray(tripDays) && tripDays.length > 0 ? tripDays : (tripPlaceIds ? [{ placeIds: tripPlaceIds }] : []);
    const dayIndex = Math.max(0, Math.min(selectedDayIndex, days.length - 1));
    const day = days[dayIndex];
    return Array.isArray(day?.placeIds) ? day.placeIds : [];
  }, [tripDays, tripPlaceIds, selectedDayIndex]);

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
    const byId = new Map(placesList.map((p) => [String(p.id), p]));
    const withG = new Map(withCoords.map((p) => [String(p.id), p]));
    return currentDayPlaceIds.map((id) => withG.get(String(id)) || byId.get(String(id))).filter(Boolean);
  }, [currentDayPlaceIds, placesList, withCoords]);

  const deferredSearchQuery = useDeferredValue(searchQuery);
  const filteredPlaces = useMemo(
    () => filterPlacesByQuery(withCoords, deferredSearchQuery),
    [withCoords, deferredSearchQuery]
  );

  const selectedPlace = useMemo(
    () => (selectedPlaceId ? filteredPlaces.find((p) => p.id === selectedPlaceId) ?? null : null),
    [selectedPlaceId, filteredPlaces]
  );

  const routeSummary = useMemo(() => getRouteSummary(directionsResult), [directionsResult]);

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

  const focusMapOnPlace = useCallback((place, maps, map, infoWindow) => {
    if (!place || !map) return;
    const pos = { lat: Number(place.latitude), lng: Number(place.longitude) };
    map.panTo(pos);
    map.setZoom(16);
    const markerEntry = markersByPlaceIdRef.current.get(place.id);
    if (markerEntry?.marker && infoWindow) {
      const content = buildInfoContent(place, apiKey);
      infoWindow.setContent(content);
      infoWindow.open(map, markerEntry.marker);
    }
  }, [apiKey]);

  useEffect(() => {
    const onMapLinkClick = (e) => {
      const link = e.target.closest?.('.map-info-link');
      if (!link) return;
      const id = link.getAttribute('data-place-id');
      if (id) {
        e.preventDefault();
        navigate(`/place/${id}`);
      }
    };
    document.addEventListener('click', onMapLinkClick, true);
    return () => document.removeEventListener('click', onMapLinkClick, true);
  }, [navigate]);

  useEffect(() => {
    if (!apiKey || !mapRef.current) return;

    let cancelled = false;
    setMapError(null);

    const addMarkers = (map, maps, infoWindow) => {
      markersRef.current.forEach((m) => m?.marker?.setMap?.(null));
      markersRef.current = [];
      markersByPlaceIdRef.current.clear();
      const list = withCoords || [];
      const bounds = new maps.LatLngBounds();
      list.forEach((p) => {
        const pos = { lat: Number(p.latitude), lng: Number(p.longitude) };
        bounds.extend(pos);
        const marker = new maps.Marker({
          position: pos,
          map,
          title: p.name || p.id,
        });
        const placeId = p.id;
        marker.addListener('click', () => {
          setSelectedPlaceId(placeId);
          setListOpen(false);
          infoWindow.setContent(buildInfoContent(p, apiKey));
          infoWindow.open(map, marker);
        });
        const entry = { marker, placeId };
        markersRef.current.push(entry);
        markersByPlaceIdRef.current.set(placeId, entry);
      });
      if (markersRef.current.length > 1) {
        map.fitBounds(bounds, { top: 80, right: 24, bottom: 24, left: 24 });
      } else if (markersRef.current.length === 1) {
        map.panTo(markersRef.current[0].marker.getPosition());
        map.setZoom(16);
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
          mapTypeControl: false,
          streetViewControl: true,
          fullscreenControl: false,
          zoomControl: false,
          scaleControl: false,
          styles: [],
        });
        mapInstanceRef.current = map;
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
  }, [apiKey, withCoords]);

  useEffect(() => {
    return () => {
      markersRef.current.forEach((m) => m?.marker?.setMap?.(null));
      markersRef.current = [];
      if (directionsRendererRef.current) {
        directionsRendererRef.current.setMap(null);
        directionsRendererRef.current.setDirections(null);
        directionsRendererRef.current = null;
      }
      mapInstanceRef.current = null;
      infoWindowRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.setMapTypeId(mapTypeId);
  }, [mapTypeId]);

  /* Live reload: resize map when layout changes (panel open/close) or window resize */
  const triggerMapResize = useCallback(() => {
    const map = mapInstanceRef.current;
    const maps = window.google?.maps;
    if (!map || !maps) return;
    setTimeout(() => {
      maps.event.trigger(map, 'resize');
      const leftPadding = tripFilterName ? 400 : (listOpen ? 360 : 24);
      if (markersRef.current.length > 1) {
        const bounds = new maps.LatLngBounds();
        markersRef.current.forEach((m) => bounds.extend(m.marker.getPosition()));
        map.fitBounds(bounds, { top: 80, right: 24, bottom: 24, left: leftPadding });
      } else if (markersRef.current.length === 1) {
        map.panTo(markersRef.current[0].marker.getPosition());
        map.setZoom(16);
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

  /* Draw route between trip places when in trip mode and 2+ places have coords. */
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
        } catch (_) {}
      }
    };

    if (!tripFilterName || placesInTripOrder.length < 2) {
      clearRoute();
      return;
    }

    let cancelled = false;
    setDirectionsError(null);

    const origin = placesInTripOrder[0];
    const destination = placesInTripOrder[placesInTripOrder.length - 1];
    const middle = placesInTripOrder.slice(1, -1);
    const waypoints = middle.slice(0, 25).map((p) => ({
      location: { lat: Number(p.latitude), lng: Number(p.longitude) },
      stopover: true,
    }));

    const mode = maps.TravelMode[travelMode] || maps.TravelMode.DRIVING;
    const isDriving = mode === maps.TravelMode.DRIVING;

    // Best-route algorithm: optimize waypoint order (TSP), traffic-aware driving, region bias for Tripoli/Lebanon
    const request = {
      origin: { lat: Number(origin.latitude), lng: Number(origin.longitude) },
      destination: { lat: Number(destination.latitude), lng: Number(destination.longitude) },
      waypoints: waypoints.length > 0 ? waypoints : undefined,
      optimizeWaypoints: waypoints.length > 1,
      travelMode: mode,
      region: 'LB',
      drivingOptions: isDriving ? { departureTime: new Date() } : undefined,
    };

    const directionsService = new maps.DirectionsService();
    directionsService.route(request, (result, status) => {
      if (cancelled) return;
      const currentMap = mapInstanceRef.current;
      if (!currentMap) return;
      if (status !== maps.DirectionsStatus.OK) {
        setDirectionsError(status);
        setDirectionsResult(null);
        clearRoute();
        return;
      }
      setDirectionsResult(result);
      const renderer = directionsRendererRef.current;
      if (renderer) {
        try {
          renderer.setMap(null);
          renderer.setDirections(null);
        } catch (_) {}
      }
      const newRenderer = new maps.DirectionsRenderer({
        suppressMarkers: false,
        preserveViewport: false,
        polylineOptions: {
          strokeColor: '#4285F4',
          strokeWeight: 6,
          strokeOpacity: 1,
        },
      });
      directionsRendererRef.current = newRenderer;
      newRenderer.setMap(currentMap);
      newRenderer.setDirections(result);
      setTimeout(() => { maps.event.trigger(currentMap, 'resize'); }, 0);
    });

    return () => {
      cancelled = true;
      clearRoute();
    };
  }, [tripFilterName, placesInTripOrder, travelMode]);

  useEffect(() => {
    if (!selectedPlace || !mapInstanceRef.current || !infoWindowRef.current) return;
    const maps = window.google?.maps;
    if (!maps) return;
    focusMapOnPlace(selectedPlace, maps, mapInstanceRef.current, infoWindowRef.current);
  }, [selectedPlaceId, selectedPlace, focusMapOnPlace]);

  const handleMyLocation = useCallback(() => {
    if (!navigator.geolocation || !mapInstanceRef.current) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (mapInstanceRef.current) {
          mapInstanceRef.current.panTo(loc);
          mapInstanceRef.current.setZoom(15);
        }
        setUserLocation(loc);
      },
      () => setMapError('Location unavailable')
    );
  }, []);

  const handlePlaceSelect = useCallback((place) => {
    setSelectedPlaceId(place.id);
    setListOpen(false);
    const map = mapInstanceRef.current;
    const infoWindow = infoWindowRef.current;
    const maps = window.google?.maps;
    if (map && infoWindow && maps) focusMapOnPlace(place, maps, map, infoWindow);
  }, [focusMapOnPlace]);

  const handleZoomToFit = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map || markersRef.current.length === 0) return;
    const bounds = new window.google.maps.LatLngBounds();
    markersRef.current.forEach((m) => bounds.extend(m.marker.getPosition()));
    const leftPadding = tripFilterName ? 400 : (listOpen ? 360 : 24);
    map.fitBounds(bounds, { top: 80, right: 24, bottom: 24, left: leftPadding });
  }, [listOpen, tripFilterName]);

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

  const handleShowAllPlaces = useCallback(() => {
    navigate('/map', { replace: true });
  }, [navigate]);

  return (
    <div className="vd map-page map-page--google" role="main" aria-label={t('home', 'mapPageTitle')}>
      <div className="map-full-bleed">
        <div ref={mapRef} className="map-canvas" />
        {tripFilterName && (
          <div className="map-trip-banner" role="status">
            <span className="map-trip-banner-label">
              <Icon name="route" size={20} /> {t('home', 'viewingTrip')}: {tripFilterName}
              {placesInTripOrder.length >= 2 && !directionsError && (
                <span className="map-trip-banner-route"> · {t('home', 'routeShown') || 'Route shown'}</span>
              )}
              {directionsError && (
                <span className="map-trip-banner-route map-trip-banner-route--error"> · {t('home', 'routeUnavailable') || 'Route unavailable'}</span>
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
              <h3 className="map-error-title">Map could not load</h3>
              <p className="map-error-message">{mapError}</p>
              <p className="map-error-steps-title">Fix it in Google Cloud Console:</p>
              <ol className="map-error-steps">
                <li>Enable <strong>Maps JavaScript API</strong> (APIs &amp; Services → Library → search &quot;Maps JavaScript API&quot;).</li>
                <li>Enable <strong>billing</strong> on your project (billing is required even for free tier).</li>
                <li>Under API key <strong>restrictions</strong>, add your site to HTTP referrers, e.g. <code>http://localhost:5173/*</code> or <code>http://localhost:*</code>.</li>
              </ol>
              <p className="map-error-console">Check the browser console (F12) for the exact error.</p>
              <button type="button" className="map-error-dismiss" onClick={() => setMapError(null)}>Dismiss</button>
            </div>
          </div>
        )}
        {(loading || fetchingPlaces) && (
          <div className="map-loading-overlay">
            <div className="map-loading-spinner" />
            <span>{loading ? t('home', 'loading') : 'Loading places from Google Maps…'}</span>
          </div>
        )}

        {/* Floating search bar */}
        <div className="map-search-bar">
          <Icon name="search" size={22} className="map-search-icon" />
          <input
            type="search"
            className="map-search-input"
            placeholder={t('home', 'search') || 'Search places...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search places"
          />
          {searchQuery && (
            <button type="button" className="map-search-clear" onClick={() => setSearchQuery('')} aria-label="Clear search">
              <Icon name="close" size={18} />
            </button>
          )}
        </div>

        {/* List toggle */}
        <button
          type="button"
          className="map-fab map-fab--list"
          onClick={() => setListOpen((o) => !o)}
          aria-label={listOpen ? 'Close list' : 'Open places list'}
          aria-expanded={listOpen}
        >
          <Icon name={listOpen ? 'close' : 'list'} size={24} />
        </button>

        {/* Map type selector */}
        <div className="map-type-pill">
          {MAP_TYPES.map((type) => (
            <button
              key={type.id}
              type="button"
              className={`map-type-btn ${mapTypeId === type.id ? 'map-type-btn--active' : ''}`}
              onClick={() => setMapTypeId(type.id)}
              aria-pressed={mapTypeId === type.id}
            >
              <Icon name={type.icon} size={18} />
              <span>{type.label}</span>
            </button>
          ))}
        </div>

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
        {filteredPlaces.length > 1 && (
          <button type="button" className="map-fab map-fab--fit" onClick={handleZoomToFit} aria-label="Fit all places">
            <Icon name="fit_screen" size={22} />
          </button>
        )}

        {/* Zoom controls (Google style) */}
        <div className="map-zoom-controls">
          <button type="button" className="map-zoom-btn" onClick={() => mapInstanceRef.current?.setZoom((mapInstanceRef.current.getZoom() || 14) + 1)} aria-label="Zoom in">
            <Icon name="add" size={24} />
          </button>
          <button type="button" className="map-zoom-btn" onClick={() => mapInstanceRef.current?.setZoom((mapInstanceRef.current.getZoom() || 14) - 1)} aria-label="Zoom out">
            <Icon name="remove" size={24} />
          </button>
        </div>

        {/* Trip route panel (right sidebar) – when viewing a trip */}
        {tripFilterName && (placesInTripOrder.length >= 1 || (tripDays?.length > 0)) && (
          <div className="map-trip-route-panel gm-directions-panel" role="complementary" aria-label={t('home', 'viewingTrip')}>
            <div className="map-trip-route-panel-inner">
              <div className="map-trip-route-panel-handle" aria-hidden="true" />
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

              {/* Route summary: time to drive + distance + roads to pass */}
              {routeSummary && (
                <div className="map-trip-route-summary gm-summary-card">
                  <p className="gm-summary-time-label">
                    <Icon name="schedule" size={20} />
                    <span>{t('home', 'timeToDrive')}</span>
                  </p>
                  <p className="map-trip-route-time-dist gm-summary-primary">
                    {routeSummary.durationText} <span className="gm-summary-sep">·</span> {routeSummary.distanceText}
                  </p>
                  <p className="map-trip-route-leave-now">{t('home', 'leaveNow')}</p>
                  {routeSummary.steps?.length > 0 && (
                    <div className="gm-roads-to-pass">
                      <p className="gm-roads-to-pass-title">
                        <Icon name="route" size={18} />
                        <span>{t('home', 'roadsToPass')}</span>
                      </p>
                      <ol className="gm-roads-to-pass-list">
                        {routeSummary.steps.map((step, i) => (
                          <li key={i} className="gm-roads-to-pass-item">{step}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              )}

              {/* Transport mode selector (Google Maps: icon row with time) */}
              <div className="map-trip-route-modes">
                {TRAVEL_MODES.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    className={`map-trip-route-mode-btn ${travelMode === mode.id ? 'map-trip-route-mode-btn--active' : ''}`}
                    onClick={() => setTravelMode(mode.id)}
                    aria-pressed={travelMode === mode.id}
                    title={t('home', mode.labelKey)}
                  >
                    <Icon name={mode.icon} size={24} />
                    <span className="map-trip-route-mode-label">{t('home', mode.labelKey)}</span>
                    {travelMode === mode.id && routeSummary?.durationText && (
                      <span className="map-trip-route-mode-duration">{routeSummary.durationText}</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Waypoints (From / To list like Google Maps) */}
              <div className="map-trip-route-waypoints">
                {currentDayPlacesForList.map((p, index) => {
                  const g = p._google;
                  const name = g?.name || p.name || p.id;
                  const address = g?.formatted_address || p.location || '';
                  const isLast = index === currentDayPlacesForList.length - 1;
                  const isFirst = index === 0;
                  return (
                    <div key={p.id} className={`map-trip-route-waypoint ${isFirst ? 'gm-waypoint-start' : ''} ${isLast ? 'gm-waypoint-end' : ''}`}>
                      <span className="map-trip-route-waypoint-dot" aria-hidden="true">
                        {isFirst ? <Icon name="trip_origin" size={20} /> : isLast ? <Icon name="place" size={20} /> : <span className="gm-dot-mid" />}
                      </span>
                      <div className="map-trip-route-waypoint-content">
                        <span className="map-trip-route-waypoint-name">{name}</span>
                        {address && <span className="map-trip-route-waypoint-address">{address}</span>}
                      </div>
                      <button type="button" className="map-trip-route-waypoint-menu" aria-label="Options">
                        <Icon name="more_vert" size={20} />
                      </button>
                    </div>
                  );
                })}
                <button type="button" className="map-trip-route-add-dest" onClick={() => navigate('/plan')}>
                  <Icon name="add" size={20} />
                  <span>{t('home', 'addDestination')}</span>
                </button>
              </div>

              {/* Step-by-step (Details) */}
              {routeSummary && (
                <div className="map-trip-route-details-wrap">
                  <button type="button" className="map-trip-route-link gm-details-toggle" onClick={() => setRouteDetailsOpen((o) => !o)}>
                    {t('home', 'details')}
                    <Icon name={routeDetailsOpen ? 'expand_less' : 'expand_more'} size={20} />
                  </button>
                  {routeDetailsOpen && directionsResult?.routes?.[0]?.legs && (
                    <div className="map-trip-route-details">
                      {directionsResult.routes[0].legs.flatMap((leg, legIndex) =>
                        (leg.steps || []).map((step, stepIndex) => (
                          <p key={`${legIndex}-${stepIndex}`} className="map-trip-route-step">
                            {stripHtml(step.instructions)}
                          </p>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Options (Share, Send to phone) */}
              <div className="map-trip-route-options">
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

        {/* Places list drawer */}
        <div className={`map-drawer ${listOpen ? 'map-drawer--open' : ''}`}>
          <div className="map-drawer-header">
            <h2 className="map-drawer-title">{t('home', 'mapPageTitle')}</h2>
            <p className="map-drawer-sub">{filteredPlaces.length} places</p>
            <button type="button" className="map-drawer-close" onClick={() => setListOpen(false)} aria-label="Close">
              <Icon name="close" size={24} />
            </button>
          </div>
          <div className="map-drawer-list">
            {filteredPlaces.length === 0 ? (
              <p className="map-drawer-empty">{searchQuery ? 'No places match your search.' : 'No places with location.'}</p>
            ) : (
              filteredPlaces.map((p) => {
                const g = p._google;
                const name = g?.name || p.name || p.id;
                const loc = g?.formatted_address || p.location;
                const rating = g?.rating ?? p.rating;
                const reviews = g?.user_ratings_total ?? null;
                const openNow = g?.opening_hours && typeof g.opening_hours.open_now === 'boolean'
                  ? g.opening_hours.open_now
                  : null;
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`map-drawer-item ${selectedPlaceId === p.id ? 'map-drawer-item--selected' : ''}`}
                    onClick={() => handlePlaceSelect(p)}
                  >
                    <span className="map-drawer-item-name">{name}</span>
                    {loc && <span className="map-drawer-item-loc">{loc}</span>}
                    <div className="map-drawer-item-meta-row">
                      {rating != null && (
                        <span className="map-drawer-item-rating">
                          <Icon name="star" size={14} /> {Number(rating).toFixed(1)}
                          {reviews != null && ` (${reviews})`}
                        </span>
                      )}
                      {openNow !== null && (
                        <span className={`map-drawer-item-open ${openNow ? 'map-drawer-item-open--yes' : 'map-drawer-item-open--no'}`}>
                          {openNow ? 'Open now' : 'Closed'}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
        <div className={`map-drawer-backdrop ${listOpen ? 'map-drawer-backdrop--visible' : ''}`} onClick={() => setListOpen(false)} aria-hidden="true" />
      </div>
    </div>
  );
}

function buildInfoContent(p, apiKey = '') {
  const placeId = p.id;
  const g = p._google || null;
  const name = g?.name || p.name || p.id;
  const address = g?.formatted_address || p.location || '';
  const rating = g?.rating ?? p.rating;
  const reviews = g?.user_ratings_total ?? null;
  const openNow = g?.opening_hours && typeof g.opening_hours.open_now === 'boolean'
    ? g.opening_hours.open_now
    : null;
  const website = g?.website || null;
  const gmUrl = g?.url || null;
  const rawImg =
    (g?.photo_reference && placePhotoUrl(g.photo_reference, apiKey)) ||
    p.image ||
    (Array.isArray(p.images) && p.images[0]) ||
    '';
  const img = rawImg ? (getPlaceImageUrl(rawImg) || rawImg) : '';
  return `
    <div class="gm-info-content" style="padding:0;min-width:220px;max-width:280px;font-size:14px;">
      ${img ? `<img src="${escapeHtml(img)}" alt="" style="width:100%;height:100px;object-fit:cover;border-radius:8px 8px 0 0;margin:-8px -8px 8px -8px;" />` : ''}
      <strong style="display:block;margin-bottom:4px;font-size:15px;">${escapeHtml(name)}</strong>
      ${address ? `<p style="margin:0 0 6px 0;color:#5f6368;font-size:13px;">${escapeHtml(address)}</p>` : ''}
      ${rating != null ? `<p style="margin:0 0 4px 0;font-size:13px;">★ ${Number(rating).toFixed(1)}${reviews != null ? ` (${reviews} reviews)` : ''}</p>` : ''}
      ${openNow !== null ? `<p style="margin:0 0 8px 0;font-size:12px;color:${openNow ? '#137333' : '#c5221f'};">${openNow ? 'Open now' : 'Closed'}</p>` : ''}
      <a href="/place/${encodeURIComponent(placeId)}" class="map-info-link" data-place-id="${escapeHtml(String(placeId))}" style="display:inline-block;margin-right:8px;color:#1a73e8;font-weight:600;text-decoration:none;">View details →</a>
      ${gmUrl ? `<a href="${escapeHtml(gmUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;font-size:12px;color:#5f6368;text-decoration:none;">Open in Google Maps</a>` : ''}
    </div>
  `;
}
