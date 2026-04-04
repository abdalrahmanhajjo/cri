import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { loadGoogleMapsScript } from '../utils/mapGoogleLoader';
import { MAP_PATH, PLAN_TRIP_AREA_NAV, PLAN_TRIP_AREA_I18N_KEYS } from '../config/planTripAreas';
import { getTripoliAreaKeyForCoordinates, TRIPOLI_AREA_MARKER_COLORS } from '../utils/tripoliAreaBounds';
import Icon from './Icon';
import './FindYourWayMap.css';

const TRIPOLI_CENTER = { lat: 34.43692, lng: 35.83846 };
const DEFAULT_ZOOM = 13;
const NEARBY_LIMIT = 6;

function haversineMeters(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return Infinity;
  const R = 6371000;
  const φ1 = (Number(a.lat) * Math.PI) / 180;
  const φ2 = (Number(b.lat) * Math.PI) / 180;
  const Δφ = ((Number(b.lat) - Number(a.lat)) * Math.PI) / 180;
  const Δλ = ((Number(b.lng) - Number(a.lng)) * Math.PI) / 180;
  const x = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(Math.max(0, 1 - x)));
}

function formatWalkDistance(meters) {
  if (!Number.isFinite(meters)) return '';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function placeCoords(p) {
  const lat = p.latitude != null ? Number(p.latitude) : p.coordinates?.lat != null ? Number(p.coordinates.lat) : null;
  const lng = p.longitude != null ? Number(p.longitude) : p.coordinates?.lng != null ? Number(p.coordinates.lng) : null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

const DARK_MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#0b1520' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0b1520' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ea3b8' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#08111c' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#16212d' }] },
];

/**
 * Home “Find your way” — Google Map with quarter-coloured pins and a nearby-places strip (distance-sorted).
 */
export default function FindYourWayMap({ places = [], t }) {
  const { theme } = useTheme();
  const safeT = (ns, key) => (t && typeof t === 'function' ? t(ns, key) : key);
  const apiKey = typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_MAPS_API_KEY;

  const rootRef = useRef(null);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const [visible, setVisible] = useState(false);
  const [mapError, setMapError] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const [areaFilter, setAreaFilter] = useState(null);
  const [selected, setSelected] = useState(null);

  const withGeo = useMemo(() => {
    const list = Array.isArray(places) ? places : [];
    return list
      .map((p) => {
        const c = placeCoords(p);
        if (!c) return null;
        const areaKey = getTripoliAreaKeyForCoordinates(c.lat, c.lng);
        return { ...p, _lat: c.lat, _lng: c.lng, _areaKey: areaKey };
      })
      .filter(Boolean);
  }, [places]);

  const visibleMarkers = useMemo(() => {
    if (!areaFilter) return withGeo;
    return withGeo.filter((p) => p._areaKey === areaFilter);
  }, [withGeo, areaFilter]);

  useEffect(() => {
    setSelected((prev) => {
      if (!prev) return null;
      return visibleMarkers.some((p) => p.id === prev.id) ? prev : null;
    });
  }, [visibleMarkers]);

  const nearbyForSelected = useMemo(() => {
    if (!selected) return [];
    const center = { lat: selected._lat, lng: selected._lng };
    return withGeo
      .filter((p) => p.id !== selected.id)
      .map((p) => ({ p, d: haversineMeters(center, { lat: p._lat, lng: p._lng }) }))
      .filter((x) => Number.isFinite(x.d) && x.d < 8000)
      .sort((a, b) => a.d - b.d)
      .slice(0, NEARBY_LIMIT);
  }, [selected, withGeo]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return undefined;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setVisible(true);
      },
      { rootMargin: '120px', threshold: 0.05 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const fitBounds = useCallback((map, maps, markerList) => {
    if (!map || !maps || !markerList.length) return;
    if (markerList.length === 1) {
      map.panTo({ lat: markerList[0]._lat, lng: markerList[0]._lng });
      map.setZoom(15);
      return;
    }
    const bounds = new maps.LatLngBounds();
    markerList.forEach((p) => bounds.extend({ lat: p._lat, lng: p._lng }));
    map.fitBounds(bounds, { top: 48, right: 48, bottom: 48, left: 48 });
  }, []);

  useEffect(() => {
    if (!visible || !apiKey || !mapRef.current) return undefined;

    let cancelled = false;
    setMapError(null);

    loadGoogleMapsScript(apiKey, (err) => {
      if (!cancelled) setMapError(err.message);
    })
      .then((maps) => {
        if (cancelled || !mapRef.current) return;
        if (typeof window !== 'undefined') window.gm_authFailure = null;

        let map = mapInstanceRef.current;
        if (!map) {
          map = new maps.Map(mapRef.current, {
            center: TRIPOLI_CENTER,
            zoom: DEFAULT_ZOOM,
            mapTypeId: 'roadmap',
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            zoomControl: true,
            scaleControl: false,
            gestureHandling: 'greedy',
            backgroundColor: theme === 'dark' ? '#071116' : '#e8eaed',
            styles: theme === 'dark' ? DARK_MAP_STYLES : [],
          });
          mapInstanceRef.current = map;
        } else {
          map.setOptions({
            styles: theme === 'dark' ? DARK_MAP_STYLES : [],
            backgroundColor: theme === 'dark' ? '#071116' : '#e8eaed',
          });
        }
        setMapReady(true);
        setTimeout(() => maps.event.trigger(map, 'resize'), 0);
      })
      .catch((err) => {
        if (!cancelled) setMapError(err.message || 'Failed to load map');
      });

    return () => {
      cancelled = true;
      if (typeof window !== 'undefined') window.gm_authFailure = null;
    };
  }, [visible, apiKey, theme]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const maps = window.google?.maps;
    if (!map || !maps || !mapReady) return;

    markersRef.current.forEach((m) => m?.setMap?.(null));
    markersRef.current = [];

    if (visibleMarkers.length === 0) {
      map.setCenter(TRIPOLI_CENTER);
      map.setZoom(DEFAULT_ZOOM);
      setTimeout(() => maps.event.trigger(map, 'resize'), 50);
      return;
    }

    visibleMarkers.forEach((p) => {
      const color = TRIPOLI_AREA_MARKER_COLORS[p._areaKey] || TRIPOLI_AREA_MARKER_COLORS.other;
      const marker = new maps.Marker({
        position: { lat: p._lat, lng: p._lng },
        map,
        title: p.name || String(p.id),
        icon: {
          path: maps.SymbolPath.CIRCLE,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
          scale: 10,
        },
      });
      marker.addListener('click', () => {
        setSelected(p);
        map.panTo({ lat: p._lat, lng: p._lng });
        if (map.getZoom() < 15) map.setZoom(15);
      });
      markersRef.current.push(marker);
    });

    fitBounds(map, maps, visibleMarkers);
    setTimeout(() => maps.event.trigger(map, 'resize'), 50);
  }, [visibleMarkers, mapReady, fitBounds]);

  useEffect(() => {
    return () => {
      markersRef.current.forEach((m) => m?.setMap?.(null));
      markersRef.current = [];
      mapInstanceRef.current = null;
    };
  }, []);

  const areaChips = PLAN_TRIP_AREA_NAV.map((nav) => {
    const keys = PLAN_TRIP_AREA_I18N_KEYS[nav.key];
    return { key: nav.key, label: keys ? safeT('home', keys.name) : nav.key };
  });

  if (!apiKey) {
    return (
      <div className="fym fym--fallback" ref={rootRef}>
        <p className="fym-fallback-text">{safeT('home', 'findYourWayMapNeedKey')}</p>
        <Link to={MAP_PATH} className="fym-fullmap-link">
          {safeT('home', 'findYourWayMapOpenFull')}
          <Icon name="arrow_forward" size={18} aria-hidden />
        </Link>
      </div>
    );
  }

  if (withGeo.length === 0) {
    return (
      <div className="fym fym--fallback" ref={rootRef}>
        <p className="fym-fallback-text">{safeT('home', 'findYourWayMapNoCoords')}</p>
        <Link to={MAP_PATH} className="fym-fullmap-link">
          {safeT('home', 'findYourWayMapOpenFull')}
          <Icon name="arrow_forward" size={18} aria-hidden />
        </Link>
      </div>
    );
  }

  return (
    <div className="fym" ref={rootRef}>
      <div className="fym-toolbar" role="toolbar" aria-label={safeT('home', 'findYourWayMapAreaFilterAria')}>
        <button
          type="button"
          className={`fym-chip ${areaFilter == null ? 'fym-chip--active' : ''}`}
          onClick={() => setAreaFilter(null)}
        >
          {safeT('home', 'findYourWayMapFilterAll')}
        </button>
        {areaChips.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={`fym-chip ${areaFilter === key ? 'fym-chip--active' : ''}`}
            onClick={() => setAreaFilter(key)}
            style={{ '--fym-chip-dot': TRIPOLI_AREA_MARKER_COLORS[key] || TRIPOLI_AREA_MARKER_COLORS.other }}
          >
            <span className="fym-chip-dot" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      <div className="fym-map-wrap">
        <div ref={mapRef} className="fym-map-canvas" role="application" aria-label={safeT('home', 'findYourWayMapAria')} />
        {mapError && (
          <div className="fym-error" role="alert">
            {mapError}
          </div>
        )}
        {!mapReady && !mapError && visible && (
          <div className="fym-loading">{safeT('home', 'findYourWayMapLoading')}</div>
        )}
      </div>

      <div className="fym-footer">
        <Link to={MAP_PATH} className="fym-fullmap-link">
          {safeT('home', 'findYourWayMapOpenFull')}
          <Icon name="map" size={18} aria-hidden />
        </Link>
      </div>

      {selected && (
        <div className="fym-panel">
          <div className="fym-panel-head">
            <div>
              <h4 className="fym-panel-title">{selected.name || safeT('home', 'viewDetails')}</h4>
              {selected.categoryName || selected.category ? (
                <p className="fym-panel-meta">{selected.categoryName || selected.category}</p>
              ) : null}
            </div>
            <button type="button" className="fym-panel-close" onClick={() => setSelected(null)} aria-label={safeT('discover', 'close')}>
              <Icon name="close" size={22} />
            </button>
          </div>
          <div className="fym-panel-actions">
            <Link to={`/place/${selected.id}`} className="fym-panel-btn fym-panel-btn--primary">
              {safeT('home', 'viewDetails')}
              <Icon name="arrow_forward" size={16} aria-hidden />
            </Link>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${selected._lat},${selected._lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="fym-panel-btn fym-panel-btn--ghost"
            >
              {safeT('home', 'mapDirections')}
              <Icon name="directions_walk" size={18} aria-hidden />
            </a>
          </div>
          {nearbyForSelected.length > 0 && (
            <div className="fym-nearby">
              <p className="fym-nearby-title">{safeT('home', 'findYourWayMapNearby')}</p>
              <p className="fym-nearby-sub">{safeT('home', 'findYourWayMapNearbySub')}</p>
              <ul className="fym-nearby-list">
                {nearbyForSelected.map(({ p, d }) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="fym-nearby-row"
                      onClick={() => {
                        setSelected(p);
                        const map = mapInstanceRef.current;
                        const maps = window.google?.maps;
                        if (map && maps) {
                          map.panTo({ lat: p._lat, lng: p._lng });
                          map.setZoom(15);
                        }
                      }}
                    >
                      <span className="fym-nearby-name">{p.name}</span>
                      <span className="fym-nearby-dist">{formatWalkDistance(d)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
