import { useEffect, useRef, useState } from 'react';

const TRIPOLI = { lat: 34.4367, lng: 35.8497 };

function useBodyScrollLock(locked) {
  useEffect(() => {
    if (!locked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [locked]);
}

function loadGoogleMapsScript(apiKey) {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('No window'));
    const ensurePlaces = (maps) => {
      if (maps?.places) return Promise.resolve(maps);
      if (typeof maps?.importLibrary === 'function') {
        return maps.importLibrary('places').then(() => maps).catch(() => maps);
      }
      return Promise.resolve(maps);
    };
    const doResolve = (maps) => {
      ensurePlaces(maps || window.google?.maps).then(() => resolve(window.google.maps));
    };
    if (window.google?.maps) {
      doResolve(window.google.maps);
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&v=weekly`;
    script.async = true;
    script.onload = () => doResolve(window.google?.maps);
    script.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(script);
  });
}

export default function MapPicker({ lat, lng, onSelect, onClose }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const searchInputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const apiKey = import.meta.env?.VITE_GOOGLE_MAPS_API_KEY;

  useBodyScrollLock(true);

  const initialLat = lat ? parseFloat(lat) : TRIPOLI.lat;
  const initialLng = lng ? parseFloat(lng) : TRIPOLI.lng;

  useEffect(() => {
    if (!apiKey) {
      setError('Google Maps API key not configured');
      setLoading(false);
      return;
    }
    let cancelled = false;
    loadGoogleMapsScript(apiKey)
      .then((maps) => {
        if (cancelled || !mapRef.current) return;
        const map = new maps.Map(mapRef.current, {
          center: { lat: initialLat, lng: initialLng },
          zoom: 15,
          mapTypeControl: true,
          streetViewControl: false,
        });
        const marker = new maps.Marker({
          position: { lat: initialLat, lng: initialLng },
          map,
          draggable: true,
        });
        map.addListener('click', (e) => {
          const pos = e.latLng;
          marker.setPosition(pos);
        });
        marker.addListener('dragend', () => {});
        mapInstanceRef.current = map;
        markerRef.current = marker;
        setLoading(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.message || 'Failed to load map');
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [apiKey, initialLat, initialLng]);

  useEffect(() => {
    if (!apiKey || loading || !searchInputRef.current || !window.google?.maps?.places) return;
    if (autocompleteRef.current) return;
    const Autocomplete = window.google.maps.places.Autocomplete;
    const autocomplete = new Autocomplete(searchInputRef.current, {
      fields: ['geometry', 'formatted_address'],
    });
    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      const loc = place?.geometry?.location;
      if (loc && mapInstanceRef.current && markerRef.current) {
        mapInstanceRef.current.panTo(loc);
        mapInstanceRef.current.setZoom(16);
        markerRef.current.setPosition(loc);
        setSearch(place.formatted_address || '');
      }
    });
    autocompleteRef.current = autocomplete;
    return () => {
      if (autocompleteRef.current) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
        autocompleteRef.current = null;
      }
    };
  }, [apiKey, loading]);

  const handleSearch = () => {
    if (!search.trim() || !window.google?.maps || !mapInstanceRef.current) return;
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: search.trim() }, (results, status) => {
      if (status === 'OK' && results?.[0]) {
        const loc = results[0].geometry.location;
        mapInstanceRef.current?.panTo(loc);
        mapInstanceRef.current?.setZoom(16);
        markerRef.current?.setPosition(loc);
      }
    });
  };

  const handleUse = () => {
    const marker = markerRef.current;
    if (!marker) return;
    const pos = marker.getPosition();
    if (pos) onSelect(pos.lat(), pos.lng());
    onClose();
  };

  return (
    <div className="admin-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal admin-modal--wide" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <h2>Pick location on map</h2>
          <button type="button" className="admin-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="admin-modal-body" style={{ padding: '1rem', minHeight: 380, position: 'relative' }}>
          {error && <div className="admin-error">{error}</div>}
          {apiKey ? (
            <div className="admin-form-group" style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.85rem', marginBottom: '0.35rem', display: 'block' }}>Search address</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearch(); } }}
                  placeholder="Search any place in the world"
                  style={{ flex: 1, padding: '0.6rem 1rem' }}
                  autoComplete="off"
                />
                <button type="button" className="admin-btn admin-btn--secondary" onClick={handleSearch}>Search</button>
              </div>
            </div>
          ) : null}
          <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
            <div ref={mapRef} style={{ width: '100%', height: 360, background: '#f3f4f6' }} />
            {loading && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.9)', zIndex: 1 }}>Loading map…</div>
            )}
          </div>
          <p className="admin-form-hint" style={{ marginTop: '0.5rem', marginBottom: 0 }}>Click on the map or drag the marker to set the location.</p>
          <details className="admin-form-hint" style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
            <summary style={{ cursor: 'pointer', color: '#6b7280' }}>Map not loading? Fix API key</summary>
            <p style={{ marginTop: '0.35rem', color: '#6b7280' }}>
              Google Cloud Console → APIs &amp; Services: enable <strong>Maps JavaScript API</strong>, <strong>Geocoding API</strong>, <strong>Places API</strong>. Enable billing. Add <code>http://localhost:*/*</code> to your API key&apos;s HTTP referrer restrictions.
            </p>
          </details>
        </div>
        <div className="admin-modal-footer">
          <button type="button" className="admin-btn admin-btn--secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="admin-btn admin-btn--primary" onClick={handleUse}>Use this location</button>
        </div>
      </div>
    </div>
  );
}
