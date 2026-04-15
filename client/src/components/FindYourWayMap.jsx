import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getPlaceImageUrl } from '../api/client';
import { getDeliveryImgProps } from '../utils/responsiveImages.js';
import { loadGoogleMapsScript } from '../utils/mapGoogleLoader';
import { MAP_PATH, PLAN_TRIP_AREA_NAV, PLAN_TRIP_AREA_I18N_KEYS } from '../config/planTripAreas';
import { getTripoliAreaKeyForCoordinates } from '../utils/tripoliAreaBounds';
import Icon from './Icon';
import './FindYourWayMap.css';

/** West of downtown so the default view includes Tripoli + Mediterranean (not land-locked). */
const TRIPOLI_MAP_CENTER = { lat: 34.438, lng: 35.805 };
const TRIPOLI_DEFAULT_ZOOM = 12;
/** Offshore/west — included in fitBounds so the sea stays visible with markers. */
const TRIPOLI_SEA_ANCHOR = { lat: 34.415, lng: 35.765 };
const NEARBY_LIMIT = 6;

/** Wait until the map node has real layout size (mobile/WebKit often initializes too early). */
function runWhenMapContainerReady(mapEl, done, { maxFrames = 48 } = {}) {
  if (!mapEl || typeof requestAnimationFrame === 'undefined') {
    done();
    return;
  }
  let frames = 0;
  const tick = () => {
    const r = mapEl.getBoundingClientRect();
    if ((r.width >= 48 && r.height >= 48) || frames >= maxFrames) {
      done();
      return;
    }
    frames += 1;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function staggerMapResize(maps, map, delaysMs = [0, 80, 240, 520, 1100]) {
  delaysMs.forEach((ms) => {
    window.setTimeout(() => {
      try {
        maps?.event?.trigger?.(map, 'resize');
      } catch {
        /* ignore */
      }
    }, ms);
  });
}

const AREA_I18N = {
  mina: 'areaMina',
  old_city: 'areaOldCity',
  tell: 'areaTel',
};

/** Toolbar / legend dots — neutral so the map stays the default Google look */
const FYM_AREA_UI_DOT = '#64748b';

function haversineMeters(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return Infinity;
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

function formatWalkDistance(meters) {
  if (!Number.isFinite(meters)) return '';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function placeCoords(p) {
  const c = p?.coordinates && typeof p.coordinates === 'object' ? p.coordinates : null;
  const lat =
    p?.latitude != null
      ? Number(p.latitude)
      : c?.lat != null
        ? Number(c.lat)
        : c?.latitude != null
          ? Number(c.latitude)
          : null;
  const lng =
    p?.longitude != null
      ? Number(p.longitude)
      : c?.lng != null
        ? Number(c.lng)
        : c?.longitude != null
          ? Number(c.longitude)
          : null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function firstPlaceImage(p) {
  const raw = p.image || (Array.isArray(p.images) && p.images[0]) || null;
  return raw ? getPlaceImageUrl(raw) : null;
}

/**
 * Home “Find your way” — default Google roadmap, area filters, detail sheet, nearby list.
 */
export default function FindYourWayMap({ places = [], t }) {
  const safeT = (ns, key) => (t && typeof t === 'function' ? t(ns, key) : key);
  const apiKey = typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_MAPS_API_KEY;

  const rootRef = useRef(null);
  const mapRef = useRef(null);
  const mapWrapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const mapPaintedOnceRef = useRef(false);
  const [visible, setVisible] = useState(false);
  const [mapError, setMapError] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapPainted, setMapPainted] = useState(false);
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
      { rootMargin: '280px 0px', threshold: 0 }
    );
    obs.observe(el);
    // Mobile reliability fallback: force lazy section visible even if observer misses.
    const fallbackTimer = window.setTimeout(() => setVisible(true), 1400);
    return () => {
      obs.disconnect();
      window.clearTimeout(fallbackTimer);
    };
  }, []);

  const fitBounds = useCallback((map, maps, markerList) => {
    if (!map || !maps || !markerList.length) return;
    const bounds = new maps.LatLngBounds();
    bounds.extend(TRIPOLI_SEA_ANCHOR);
    markerList.forEach((p) => bounds.extend({ lat: p._lat, lng: p._lng }));
    map.fitBounds(bounds, { top: 56, right: 56, bottom: 72, left: 56 });
  }, []);

  const handleRecenter = useCallback(() => {
    const map = mapInstanceRef.current;
    const maps = window.google?.maps;
    if (map && maps) fitBounds(map, maps, visibleMarkers);
  }, [visibleMarkers, fitBounds]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!visible || !apiKey || !mapRef.current) return undefined;

    let cancelled = false;
    setMapError(null);
    mapPaintedOnceRef.current = false;
    setMapPainted(false);

    loadGoogleMapsScript(apiKey, (err) => {
      if (!cancelled) setMapError(err.message);
    })
      .then((maps) => {
        if (cancelled || !mapRef.current) return;
        if (typeof window !== 'undefined') window.gm_authFailure = null;

        const mountMap = async () => {
          if (cancelled || !mapRef.current) return;
          let map = mapInstanceRef.current;
          const baseOpts = {
            center: TRIPOLI_MAP_CENTER,
            zoom: TRIPOLI_DEFAULT_ZOOM,
            mapTypeId: 'roadmap',
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            zoomControl: true,
            zoomControlOptions: { position: maps.ControlPosition.RIGHT_BOTTOM },
            fullscreenControlOptions: { position: maps.ControlPosition.RIGHT_TOP },
            scaleControl: false,
            gestureHandling: 'greedy',
            tilt: 0,
          };
          if (!map) {
            let MapCtor = maps.Map;
            let renderingTypeOpt = {};
            try {
              const lib = await window.google.maps.importLibrary('maps');
              /* VECTOR (WebGL) stays sharp when zoomed; RASTER bitmap tiles look pixelated up close. */
              if (lib?.Map && lib.RenderingType?.VECTOR != null) {
                MapCtor = lib.Map;
                renderingTypeOpt = { renderingType: lib.RenderingType.VECTOR };
              }
            } catch {
              /* Classic maps namespace only */
            }
            map = new MapCtor(mapRef.current, { ...baseOpts, ...renderingTypeOpt });
            mapInstanceRef.current = map;
          } else {
            map.setOptions({ styles: [] });
          }
          setMapReady(true);
          staggerMapResize(maps, map);
          const markPainted = () => {
            if (cancelled || mapPaintedOnceRef.current) return;
            mapPaintedOnceRef.current = true;
            setMapPainted(true);
            staggerMapResize(maps, map, [0, 100, 320, 700]);
            try {
              map.panBy(1, 0);
              map.panBy(-1, 0);
            } catch {
              /* ignore */
            }
          };
          maps.event.addListenerOnce(map, 'idle', markPainted);
          maps.event.addListenerOnce(map, 'tilesloaded', markPainted);
        };

        runWhenMapContainerReady(mapRef.current, () => {
          void mountMap().catch((e) => {
            if (!cancelled) setMapError(e?.message || 'Map failed to start');
          });
        });
      })
      .catch((err) => {
        if (!cancelled) setMapError(err.message || 'Failed to load map');
      });

    const paintFallbackTimer = window.setTimeout(() => {
      if (cancelled || mapPaintedOnceRef.current) return;
      mapPaintedOnceRef.current = true;
      setMapPainted(true);
    }, 12000);

    return () => {
      cancelled = true;
      window.clearTimeout(paintFallbackTimer);
      if (typeof window !== 'undefined') window.gm_authFailure = null;
    };
  }, [visible, apiKey]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const maps = window.google?.maps;
    const wrap = mapWrapRef.current;
    if (!map || !maps || !mapReady || !wrap) return undefined;

    const onOrientation = () => staggerMapResize(maps, map, [0, 200, 450]);
    const onPageShow = () => staggerMapResize(maps, map, [0, 120, 400]);
    const onVis = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') staggerMapResize(maps, map);
    };

    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => staggerMapResize(maps, map, [0, 60]));
      ro.observe(wrap);
      if (mapRef.current) ro.observe(mapRef.current);
    }
    window.addEventListener('orientationchange', onOrientation);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('resize', onPageShow);
    document.addEventListener('visibilitychange', onVis);
    const vv = window.visualViewport;
    vv?.addEventListener?.('resize', onPageShow);

    return () => {
      ro?.disconnect();
      window.removeEventListener('orientationchange', onOrientation);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('resize', onPageShow);
      document.removeEventListener('visibilitychange', onVis);
      vv?.removeEventListener?.('resize', onPageShow);
    };
  }, [mapReady]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const maps = window.google?.maps;
    if (!map || !maps || !mapReady) return;

    markersRef.current.forEach(({ marker }) => marker?.setMap?.(null));
    markersRef.current = [];

    if (visibleMarkers.length === 0) {
      map.setCenter(TRIPOLI_MAP_CENTER);
      map.setZoom(TRIPOLI_DEFAULT_ZOOM);
      staggerMapResize(maps, map, [0, 80]);
      return;
    }

    visibleMarkers.forEach((p) => {
      const marker = new maps.Marker({
        position: { lat: p._lat, lng: p._lng },
        map,
        title: p.name || String(p.id),
      });
      marker.addListener('click', () => {
        setSelected(p);
        map.panTo({ lat: p._lat, lng: p._lng });
        if (map.getZoom() < 15) map.setZoom(15);
      });
      markersRef.current.push({ marker, placeId: p.id });
    });

    fitBounds(map, maps, visibleMarkers);
    staggerMapResize(maps, map, [0, 60, 200]);
  }, [visibleMarkers, mapReady, fitBounds]);

  useEffect(() => {
    const maps = window.google?.maps;
    if (!maps || !mapReady) return;
    markersRef.current.forEach(({ marker, placeId }) => {
      if (!marker) return;
      const isSel = selected && String(selected.id) === String(placeId);
      marker.setZIndex(isSel ? maps.Marker.MAX_ZINDEX + 1 : 0);
    });
  }, [selected, mapReady]);

  useEffect(() => {
    return () => {
      markersRef.current.forEach(({ marker }) => marker?.setMap?.(null));
      markersRef.current = [];
      mapInstanceRef.current = null;
    };
  }, []);

  const areaChips = PLAN_TRIP_AREA_NAV.map((nav) => {
    const keys = PLAN_TRIP_AREA_I18N_KEYS[nav.key];
    return { key: nav.key, label: keys ? safeT('home', keys.name) : nav.key };
  });

  const placesCountLabel = safeT('home', 'findYourWayMapPlacesOnMap').replace(/\{n\}/g, String(visibleMarkers.length));

  const selectedHero = selected ? firstPlaceImage(selected) : null;
  const selectedHeroProps = selectedHero ? getDeliveryImgProps(selectedHero, 'gridCard') : null;

  const areaBadgeLabel = (key) => {
    const i18nKey = AREA_I18N[key];
    return i18nKey ? safeT('home', i18nKey) : safeT('home', 'findYourWayMapOtherArea');
  };

  if (!apiKey) {
    return (
      <div className="fym fym--fallback" ref={rootRef}>
        <div className="fym-fallback-inner">
          <span className="fym-fallback-icon" aria-hidden>
            <Icon name="map" size={28} />
          </span>
          <p className="fym-fallback-text">{safeT('home', 'findYourWayMapNeedKey')}</p>
          <Link to={MAP_PATH} className="fym-cta-pill">
            {safeT('home', 'findYourWayMapOpenFull')}
            <Icon name="arrow_forward" size={18} aria-hidden />
          </Link>
        </div>
      </div>
    );
  }

  if (withGeo.length === 0) {
    return (
      <div className="fym fym--fallback" ref={rootRef}>
        <div className="fym-fallback-inner">
          <span className="fym-fallback-icon" aria-hidden>
            <Icon name="place" size={28} />
          </span>
          <p className="fym-fallback-text">{safeT('home', 'findYourWayMapNoCoords')}</p>
          <Link to={MAP_PATH} className="fym-cta-pill">
            {safeT('home', 'findYourWayMapOpenFull')}
            <Icon name="arrow_forward" size={18} aria-hidden />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fym" ref={rootRef}>
      <div className="fym-rail" aria-hidden="true" />

      <div className="fym-controls">
        <div className="fym-toolbar-scroll">
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
                style={{ '--fym-chip-dot': FYM_AREA_UI_DOT }}
              >
                <span className="fym-chip-dot" aria-hidden />
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="fym-meta">
          <span className="fym-meta-count">{placesCountLabel}</span>
          <button type="button" className="fym-recenter" onClick={handleRecenter} disabled={visibleMarkers.length === 0}>
            <Icon name="my_location" size={18} aria-hidden />
            {safeT('home', 'findYourWayMapRecenter')}
          </button>
        </div>
      </div>

      <div className="fym-map-stage">
        <div className="fym-map-wrap" ref={mapWrapRef}>
          <div ref={mapRef} className="fym-map-canvas" role="application" aria-label={safeT('home', 'findYourWayMapAria')} />
          <div className="fym-map-overlay fym-map-overlay--top">
            <div className="fym-live-badge">
              <span className="fym-live-dot" aria-hidden />
              <span>{safeT('home', 'findYourWayMapLiveBadge')}</span>
            </div>
            <Link to={MAP_PATH} className="fym-expand-map">
              {safeT('home', 'findYourWayMapExpand')}
              <Icon name="open_in_new" size={16} aria-hidden />
            </Link>
          </div>
          <div className="fym-map-overlay fym-map-overlay--bottom">
            <div className="fym-legend" role="group" aria-label={safeT('home', 'findYourWayMapLegend')}>
              <span className="fym-legend-kicker">{safeT('home', 'findYourWayMapLegend')}</span>
              <div className="fym-legend-items">
                {areaChips.map(({ key, label }) => (
                  <span key={key} className="fym-legend-item">
                    <span className="fym-legend-swatch" style={{ background: FYM_AREA_UI_DOT }} />
                    {label}
                  </span>
                ))}
                <span className="fym-legend-item fym-legend-item--muted">
                  <span className="fym-legend-swatch" style={{ background: FYM_AREA_UI_DOT }} />
                  {safeT('home', 'findYourWayMapOtherArea')}
                </span>
              </div>
            </div>
          </div>
          {mapError && (
            <div className="fym-error" role="alert">
              {mapError}
            </div>
          )}
          {!mapPainted && !mapError && visible && (
            <div className="fym-loading">
              <div className="fym-loading-shimmer" />
              <p className="fym-loading-text">{safeT('home', 'findYourWayMapLoading')}</p>
            </div>
          )}
        </div>
      </div>

      {selected && (
        <aside
          className="fym-panel"
          aria-live="polite"
          aria-label={selected.name || safeT('home', 'viewDetails')}
        >
          {selectedHeroProps ? (
            <div className="fym-panel-visual">
              <img
                alt=""
                className="fym-panel-img"
                loading="lazy"
                decoding="async"
                {...selectedHeroProps}
              />
              <div className="fym-panel-visual-scrim" aria-hidden />
            </div>
          ) : null}
          <div className="fym-panel-inner">
            <div className="fym-panel-head">
              <div className="fym-panel-head-copy">
                <span className="fym-area-badge">
                  {areaBadgeLabel(selected._areaKey)}
                </span>
                <h4 className="fym-panel-title">{selected.name || safeT('home', 'viewDetails')}</h4>
                {selected.categoryName || selected.category ? (
                  <p className="fym-panel-meta">{selected.categoryName || selected.category}</p>
                ) : null}
                {selected.rating != null && Number.isFinite(Number(selected.rating)) ? (
                  <p className="fym-panel-rating">
                    <Icon name="star" size={16} aria-hidden />
                    {Number(selected.rating).toFixed(1)}
                    {selected.reviewCount != null ? (
                      <span className="fym-panel-rating-count">({selected.reviewCount})</span>
                    ) : null}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                className="fym-panel-close"
                onClick={() => setSelected(null)}
                aria-label={safeT('discover', 'close')}
              >
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
                <Icon name="near_me" size={18} aria-hidden />
              </a>
            </div>
            {nearbyForSelected.length > 0 && (
              <div className="fym-nearby">
                <p className="fym-nearby-title">{safeT('home', 'findYourWayMapNearby')}</p>
                <p className="fym-nearby-sub">{safeT('home', 'findYourWayMapNearbySub')}</p>
                <ul className="fym-nearby-list">
                  {nearbyForSelected.map(({ p, d }) => {
                    const thumb = firstPlaceImage(p);
                    const thumbProps = thumb ? getDeliveryImgProps(thumb, 'thumb') : null;
                    return (
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
                          {thumbProps ? (
                            <span className="fym-nearby-thumb">
                              <img alt="" loading="lazy" decoding="async" {...thumbProps} />
                            </span>
                          ) : (
                            <span className="fym-nearby-thumb fym-nearby-thumb--ph" aria-hidden>
                              <Icon name="place" size={18} />
                            </span>
                          )}
                          <span className="fym-nearby-main">
                            <span className="fym-nearby-name">{p.name}</span>
                          </span>
                          <span className="fym-nearby-dist">{formatWalkDistance(d)}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
