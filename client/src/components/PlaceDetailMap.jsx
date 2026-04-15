import { useCallback, useEffect, useRef, useState } from 'react';
import { loadGoogleMapsScript } from '../utils/mapGoogleLoader';

/** Same defaults as `pages/Map.jsx` */
const TRIPOLI_CENTER = { lat: 34.43692, lng: 35.83846 };
const DEFAULT_ZOOM = 14;
const DETAIL_MAP_ZOOM = 15;

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

function staggerResize(maps, map, delaysMs = [0, 80, 240, 520]) {
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

/**
 * Single-place preview using the same Maps JS loader and base styling as the full Map page.
 */
export default function PlaceDetailMap({ lat, lng, title, t }) {
  const safeT = useCallback((ns, key) => (t && typeof t === 'function' ? t(ns, key) : key), [t]);
  const apiKey = typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_MAPS_API_KEY;

  const mapElRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const resizeObsRef = useRef(null);
  const [mapError, setMapError] = useState(null);

  useEffect(() => {
    if (!apiKey || !mapElRef.current) return;
    const pos = { lat: Number(lat), lng: Number(lng) };
    if (!Number.isFinite(pos.lat) || !Number.isFinite(pos.lng)) return;

    let cancelled = false;
    setMapError(null);

    loadGoogleMapsScript(apiKey, (err) => {
      if (!cancelled) setMapError(err.message);
    })
      .then((maps) => {
        if (cancelled || !mapElRef.current) return;
        if (typeof window !== 'undefined') window.gm_authFailure = null;

        const mount = () => {
          if (cancelled || !mapElRef.current) return;
          let map = mapInstanceRef.current;
          if (!map) {
            map = new maps.Map(mapElRef.current, {
              center: TRIPOLI_CENTER,
              zoom: DEFAULT_ZOOM,
              minZoom: 2,
              maxZoom: 21,
              mapTypeId: 'satellite',
              mapTypeControl: false,
              streetViewControl: true,
              fullscreenControl: true,
              zoomControl: true,
              scaleControl: false,
              backgroundColor: '#e8eaed',
              styles: [],
              gestureHandling: 'greedy',
            });
            mapInstanceRef.current = map;
            if (!resizeObsRef.current && mapElRef.current) {
              resizeObsRef.current = new ResizeObserver(() => {
                const m = mapInstanceRef.current;
                const M = window.google?.maps;
                if (m && M) M.event.trigger(m, 'resize');
              });
              resizeObsRef.current.observe(mapElRef.current);
            }
          }

          if (markerRef.current) {
            try {
              markerRef.current.setPosition(pos);
            } catch {
              markerRef.current = new maps.Marker({
                position: pos,
                map,
                title: title || '',
              });
            }
          } else {
            markerRef.current = new maps.Marker({
              position: pos,
              map,
              title: title || '',
            });
          }

          map.panTo(pos);
          map.setZoom(DETAIL_MAP_ZOOM);
          staggerResize(maps, map);
          maps.event.addListenerOnce(map, 'idle', () => staggerResize(maps, map, [0, 120, 400]));
        };

        runWhenMapContainerReady(mapElRef.current, mount);
      })
      .catch((err) => {
        if (!cancelled) setMapError(err.message || safeT('home', 'mapLoadErrorTitle'));
      });

    return () => {
      cancelled = true;
      if (typeof window !== 'undefined') window.gm_authFailure = null;
      if (resizeObsRef.current) {
        try {
          resizeObsRef.current.disconnect();
        } catch {
          /* ignore */
        }
        resizeObsRef.current = null;
      }
      if (markerRef.current) {
        try {
          markerRef.current.setMap(null);
        } catch {
          /* ignore */
        }
        markerRef.current = null;
      }
      mapInstanceRef.current = null;
    };
  }, [apiKey, lat, lng, title, safeT]);

  if (mapError) {
    return (
      <div className="place-detail-map-error-card" role="alert">
        <p className="place-detail-map-error-title">{safeT('home', 'mapLoadErrorTitle')}</p>
        <p className="place-detail-map-error-msg">{mapError}</p>
      </div>
    );
  }

  return <div ref={mapElRef} className="place-detail-map-canvas" aria-hidden />;
}
