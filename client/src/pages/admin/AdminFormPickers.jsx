import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, getImageUrl } from '../../api/client';
import { ACCEPT_IMAGES_WITH_HEIC, isLikelyImageFile } from '../../utils/imageUploadAccept';

/** Upload or paste URL — used for tour/event cover images in admin modals. */
export function AdminCoverImageField({
  inputId = 'admin-cover-image-upload',
  value,
  onChange,
  onError,
}) {
  const [uploading, setUploading] = useState(false);
  const previewSrc = value?.trim() ? getImageUrl(value.trim()) : '';

  const runUpload = async (files) => {
    if (!files?.length) return;
    const file = Array.from(files).find(isLikelyImageFile);
    if (!file) {
      onError?.('Choose an image file (JPEG, PNG, GIF, WebP, or HEIC).');
      return;
    }
    setUploading(true);
    onError?.(null);
    try {
      const url = await api.admin.upload(file);
      onChange(url);
    } catch (e) {
      onError?.(e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="admin-form-group">
      <label htmlFor={`${inputId}-url`}>Cover image</label>
      {previewSrc ? (
        <div className="admin-form-preview-wrap">
          <img src={previewSrc} alt="Cover preview" className="admin-form-preview" onError={(e) => { e.target.style.display = 'none'; }} />
        </div>
      ) : null}
      <div
        className="admin-image-upload-zone"
        onDragOver={(e) => {
          e.preventDefault();
          e.currentTarget.classList.add('admin-image-upload-zone--drag');
        }}
        onDragLeave={(e) => {
          e.currentTarget.classList.remove('admin-image-upload-zone--drag');
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.currentTarget.classList.remove('admin-image-upload-zone--drag');
          void runUpload(e.dataTransfer?.files);
        }}
      >
        <input
          id={inputId}
          type="file"
          accept={ACCEPT_IMAGES_WITH_HEIC}
          style={{ display: 'none' }}
          onChange={(e) => {
            void runUpload(e.target.files);
            e.target.value = '';
          }}
        />
        <label htmlFor={inputId} style={{ cursor: uploading ? 'wait' : 'pointer', margin: 0 }}>
          {uploading ? 'Uploading…' : 'Drop an image here or click to upload'}
        </label>
      </div>
      <p className="admin-form-hint" style={{ marginTop: '0.5rem', marginBottom: '0.35rem' }}>
        Or paste a URL (existing hosted image or upload path):
      </p>
      <input
        id={`${inputId}-url`}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://… or /uploads/…"
        autoComplete="off"
      />
    </div>
  );
}

function useDebounced(value, ms) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function useClickOutside(ref, onOutside, enabled) {
  useEffect(() => {
    if (!enabled) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onOutside();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [ref, onOutside, enabled]);
}

/** Comma-separated place IDs with search against /api/admin/places */
export function AdminPlaceIdsPicker({ value, onChange, onError }) {
  const ids = useMemo(
    () => (value || '').split(/[,;]/).map((s) => s.trim()).filter(Boolean),
    [value]
  );

  const setIds = useCallback(
    (nextIds) => {
      onChange(nextIds.length ? nextIds.join(', ') : '');
    },
    [onChange]
  );

  const addId = useCallback(
    (id) => {
      const t = id.trim();
      if (!t || ids.includes(t)) return;
      setIds([...ids, t]);
    },
    [ids, setIds]
  );

  const removeId = useCallback(
    (id) => {
      setIds(ids.filter((x) => x !== id));
    },
    [ids, setIds]
  );

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const debouncedQ = useDebounced(query, 280);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const wrapRef = useRef(null);

  useClickOutside(
    wrapRef,
    useCallback(() => setOpen(false), []),
    open
  );

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    const q = debouncedQ.trim();
    setLoading(true);
    api.admin.places
      .list({ q: q || undefined, limit: 40 })
      .then((r) => {
        if (!cancelled) setResults(Array.isArray(r.places) ? r.places : []);
      })
      .catch((e) => {
        if (!cancelled) {
          setResults([]);
          onError?.(e.message || 'Could not search places');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, debouncedQ]);

  return (
    <div className="admin-form-group">
      <label>Places on this route</label>
      <div ref={wrapRef} className="admin-place-search-wrap">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search by place name, id, or area…"
          autoComplete="off"
          aria-expanded={open}
          aria-controls="admin-place-multi-results"
        />
        {open && (
          <ul id="admin-place-multi-results" className="admin-place-search-results" role="listbox">
            {loading && <li className="admin-place-search-meta">Searching…</li>}
            {!loading && results.length === 0 && (
              <li className="admin-place-search-meta">No places match. Try another term.</li>
            )}
            {!loading &&
              results.map((p) => (
                <li key={p.id} role="option">
                  <button
                    type="button"
                    className="admin-place-search-item"
                    onClick={() => {
                      addId(p.id);
                      setQuery('');
                      setOpen(false);
                    }}
                  >
                    <span className="admin-place-search-name">{p.name || p.id}</span>
                    <span className="admin-place-search-id">{p.id}</span>
                  </button>
                </li>
              ))}
          </ul>
        )}
      </div>
      {ids.length > 0 ? (
        <ul className="admin-picked-places" aria-label="Selected places in order">
          {ids.map((id, i) => (
            <li key={`${id}-${i}`} className="admin-picked-place-chip">
              <span className="admin-picked-place-order">{i + 1}.</span>
              <code className="admin-picked-place-id">{id}</code>
              <button type="button" className="admin-picked-place-remove" onClick={() => removeId(id)} aria-label={`Remove ${id}`}>
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="admin-form-hint">No stops linked yet — search above or type IDs below.</p>
      )}
      <label className="admin-form-hint" style={{ display: 'block', marginTop: '0.75rem' }} htmlFor="admin-place-ids-raw">
        Or edit comma-separated IDs directly
      </label>
      <input
        id="admin-place-ids-raw"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="hallab_sweets, clock_tower"
        autoComplete="off"
      />
      <span className="admin-form-hint">Stop count follows this list when non-empty.</span>
    </div>
  );
}

/** Single linked place (e.g. event venue) with search */
export function AdminSinglePlacePicker({ value, onChange, onError }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const debouncedQ = useDebounced(query, 280);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const wrapRef = useRef(null);

  useClickOutside(
    wrapRef,
    useCallback(() => setOpen(false), []),
    open
  );

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    const q = debouncedQ.trim();
    setLoading(true);
    api.admin.places
      .list({ q: q || undefined, limit: 40 })
      .then((r) => {
        if (!cancelled) setResults(Array.isArray(r.places) ? r.places : []);
      })
      .catch((e) => {
        if (!cancelled) {
          setResults([]);
          onError?.(e.message || 'Could not search places');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, debouncedQ]);

  return (
    <div className="admin-form-group">
      <label>Linked place</label>
      <div ref={wrapRef} className="admin-place-search-wrap">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search by name, id, or area…"
          autoComplete="off"
        />
        {open && (
          <ul className="admin-place-search-results" role="listbox">
            {loading && <li className="admin-place-search-meta">Searching…</li>}
            {!loading && results.length === 0 && (
              <li className="admin-place-search-meta">No places match. Try another term.</li>
            )}
            {!loading &&
              results.map((p) => (
                <li key={p.id} role="option">
                  <button
                    type="button"
                    className="admin-place-search-item"
                    onClick={() => {
                      onChange(p.id);
                      setQuery('');
                      setOpen(false);
                    }}
                  >
                    <span className="admin-place-search-name">{p.name || p.id}</span>
                    <span className="admin-place-search-id">{p.id}</span>
                  </button>
                </li>
              ))}
          </ul>
        )}
      </div>
      <div className="admin-row-actions" style={{ marginTop: '0.5rem', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Place id (from search above or type manually)"
          autoComplete="off"
          style={{ flex: '1 1 12rem', minWidth: 0 }}
        />
        {value ? (
          <button type="button" className="admin-btn admin-btn--sm admin-btn--secondary" onClick={() => onChange('')}>
            Clear
          </button>
        ) : null}
      </div>
      <span className="admin-form-hint">Optional — ties the event to a place page</span>
    </div>
  );
}
