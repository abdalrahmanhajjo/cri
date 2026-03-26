import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useOutletContext } from 'react-router-dom';
import api, { getImageUrl, fixImageUrlExtension, getImageUrlAlternate } from '../../api/client';
import MapPicker from '../../components/MapPicker';
import './Business.css';

const DURATION_OPTIONS = ['', '15 mins', '30 mins', '45 mins', '1 hour', '1-2 hours', '2-3 hours', 'Half day', 'Full day'];
const PRICE_OPTIONS = ['', 'Free', '0', '5', '10', '15', '20', '25', '30', '$', '$$', '$$$'];
const BEST_TIME_OPTIONS = ['', 'Morning (9 AM - 12 PM)', 'Afternoon (12 PM - 5 PM)', 'Evening (5 PM - 9 PM)', 'All Day', 'Morning to Afternoon', 'Between Prayer Times', 'Lunch (11 AM - 2 PM)'];
const RATING_OPTIONS = ['', '0', '0.5', '1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5'];
const TRANS_LANGS = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية' },
  { code: 'fr', label: 'Français' },
];

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'location', label: 'Location' },
  { id: 'media', label: 'Photos' },
  { id: 'details', label: 'Details & hours' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'languages', label: 'Languages' },
];

const DOC_TITLE_BUSINESS = 'Business — Visit Tripoli';

function BizImage({ url }) {
  const primary = getImageUrl(fixImageUrlExtension(url));
  const altUrl = getImageUrlAlternate(primary) || url;
  const fallback = altUrl !== primary ? getImageUrl(altUrl) : null;
  const [useFallback, setUseFallback] = useState(false);
  const src = useFallback && fallback ? fallback : primary;
  return (
    <img
      src={src}
      alt=""
      onError={(e) => {
        if (fallback && !useFallback) setUseFallback(true);
        else {
          e.target.style.display = 'none';
        }
      }}
    />
  );
}

function emptyTrans() {
  return {
    name: '',
    description: '',
    location: '',
    category: '',
    duration: '',
    price: '',
    bestTime: '',
    tags: '',
  };
}

/** Defaults from the saved `places` row (database). */
function fallbackTransFromPlace(p) {
  if (!p) return emptyTrans();
  return {
    name: p.name || '',
    description: p.description || '',
    location: p.location || '',
    category: p.category || '',
    duration: p.duration || '',
    price: p.price != null && p.price !== '' ? String(p.price) : '',
    bestTime: p.bestTime || p.best_time || '',
    tags: Array.isArray(p.tags) ? p.tags.join(', ') : '',
  };
}

/** Prefer current listing editor state so Languages matches unsaved “main listing” until saved. */
function fallbackTransFromEditor(form, place) {
  if (form) {
    return {
      name: form.name || '',
      description: form.description || '',
      location: form.location || '',
      category: form.category || '',
      duration: form.duration || '',
      price: form.price != null && form.price !== '' ? String(form.price) : '',
      bestTime: form.bestTime || '',
      tags: form.tags || '',
    };
  }
  return fallbackTransFromPlace(place);
}

/**
 * Per-field fallback when `place_translations` is missing or a field is empty.
 * Matches: "Empty fields fall back to the main listing above."
 */
function mergeTranslationRow(row, form, place) {
  const f = fallbackTransFromEditor(form, place);
  const r = row || {};
  const pick = (field, rowVal) => {
    if (rowVal != null && String(rowVal).trim() !== '') return String(rowVal);
    return f[field] ?? '';
  };
  const rowTags =
    Array.isArray(r.tags) && r.tags.length ? r.tags.join(', ') : r.tags != null && String(r.tags).trim()
      ? String(r.tags)
      : '';
  return {
    name: pick('name', r.name),
    description: pick('description', r.description),
    location: pick('location', r.location),
    category: pick('category', r.category),
    duration: pick('duration', r.duration),
    price: pick('price', r.price != null ? r.price : ''),
    bestTime: pick('bestTime', r.bestTime),
    tags: rowTags.trim() ? rowTags : f.tags || '',
  };
}

export default function BusinessPlaceEdit() {
  const { placeId: rawId } = useParams();
  const placeId = rawId ? decodeURIComponent(rawId) : '';
  const outlet = useOutletContext();
  const refreshMe = outlet?.refreshMe;

  const [tab, setTab] = useState('overview');
  const [place, setPlace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(null);
  const [categories, setCategories] = useState([]);
  const [categoryCustom, setCategoryCustom] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const dirtyRef = useRef(false);
  const [dirty, setDirty] = useState(false);

  const [transLang, setTransLang] = useState('ar');
  const [transForm, setTransForm] = useState(emptyTrans);
  const [transSaving, setTransSaving] = useState(false);
  const [transLoaded, setTransLoaded] = useState(false);
  const [bizReviews, setBizReviews] = useState([]);
  const [bizReviewsLoading, setBizReviewsLoading] = useState(false);
  const [bizReviewsErr, setBizReviewsErr] = useState(null);

  const refreshBizReviews = useCallback(async () => {
    if (!placeId) return;
    const r = await api.business.places.reviews(placeId);
    setBizReviews(Array.isArray(r.reviews) ? r.reviews : []);
  }, [placeId]);

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
    setDirty(true);
  }, []);

  useEffect(() => {
    const h = (e) => {
      if (dirtyRef.current) e.preventDefault();
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, []);

  useEffect(() => {
    const name = (form?.name && String(form.name).trim()) || place?.name;
    if (!name || !placeId) {
      document.title = DOC_TITLE_BUSINESS;
      return;
    }
    document.title = `${name} · Edit — Visit Tripoli`;
    return () => {
      document.title = DOC_TITLE_BUSINESS;
    };
  }, [form?.name, place?.name, placeId]);

  const loadPlace = useCallback(() => {
    if (!placeId) return Promise.resolve();
    return api.business.places.get(placeId).then((p) => {
      setPlace(p);
      const catId = p.categoryId || p.category_id || '';
      setCategoryCustom(false);
      let hoursStr = '';
      if (p.hours != null) {
        try {
          hoursStr = typeof p.hours === 'string' ? p.hours : JSON.stringify(p.hours, null, 2);
        } catch {
          hoursStr = '';
        }
      }
      setForm({
        name: p.name || '',
        description: p.description || '',
        searchName: p.searchName || p.search_name || '',
        location: p.location || '',
        latitude: p.latitude ?? '',
        longitude: p.longitude ?? '',
        category: p.category || '',
        categoryId: catId,
        duration: p.duration || '',
        price: p.price ?? '',
        bestTime: p.bestTime || p.best_time || '',
        rating: p.rating ?? '',
        reviewCount: p.reviewCount ?? p.review_count ?? '',
        images: Array.isArray(p.images) ? p.images.join('\n') : '',
        tags: Array.isArray(p.tags) ? p.tags.join(', ') : '',
        hoursStr,
      });
      dirtyRef.current = false;
      setDirty(false);
    });
  }, [placeId]);

  useEffect(() => {
    api.categories
      .list()
      .then((r) => {
        const list = r?.categories || [];
        setCategories(Array.isArray(list) ? list : []);
      })
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (!placeId) {
      setError('Missing place');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadPlace()
      .then(() => {
        if (!cancelled) setLoading(false);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message || 'Failed to load place');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [placeId, loadPlace]);

  useEffect(() => {
    if (!form || !categories.length) return;
    const catId = form.categoryId || '';
    setCategoryCustom(!catId || !categories.some((c) => c.id === catId));
  }, [form, categories]);

  useEffect(() => {
    if (tab !== 'reviews' || !placeId) return;
    let cancelled = false;
    setBizReviewsLoading(true);
    setBizReviewsErr(null);
    api.business.places
      .reviews(placeId)
      .then((r) => {
        if (!cancelled) setBizReviews(Array.isArray(r.reviews) ? r.reviews : []);
      })
      .catch((e) => {
        if (!cancelled) {
          setBizReviewsErr(e.message || 'Could not load reviews');
          setBizReviews([]);
        }
      })
      .finally(() => {
        if (!cancelled) setBizReviewsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, placeId]);

  useEffect(() => {
    if (!placeId || !place || tab !== 'languages') return;
    let cancelled = false;
    setTransLoaded(false);
    api.business.translations
      .list(placeId)
      .then((r) => {
        if (cancelled) return;
        const row = (r.translations || []).find((t) => t.lang === transLang);
        setTransForm(mergeTranslationRow(row, form, place));
        setTransLoaded(true);
      })
      .catch(() => {
        if (!cancelled) {
          setTransForm(mergeTranslationRow(null, form, place));
          setTransLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [placeId, place, form, transLang, tab]);

  const imageUrls = form?.images?.trim()
    ? form.images.split(/\n/).map((s) => s.trim()).filter(Boolean)
    : [];

  const handleMapSelect = (lat, lng) => {
    markDirty();
    setForm((f) => (f ? { ...f, latitude: String(lat), longitude: String(lng) } : f));
    setMapPickerOpen(false);
  };

  const handleImageUpload = async (files) => {
    if (!files?.length || !placeId) return;
    setError(null);
    setUploading(true);
    try {
      const results = await Promise.all(
        Array.from(files).map((file) =>
          api.business.upload(file, placeId).catch((e) => {
            throw new Error(`${file.name}: ${e?.message || 'Upload failed'}`);
          })
        )
      );
      const newUrls = [...imageUrls, ...results].filter(Boolean);
      markDirty();
      setForm((f) => (f ? { ...f, images: newUrls.join('\n') } : f));
    } catch (e) {
      setError(e?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index) => {
    markDirty();
    const next = [...imageUrls];
    next.splice(index, 1);
    setForm((f) => (f ? { ...f, images: next.join('\n') } : f));
  };

  const setAsMainImage = (index) => {
    if (index === 0) return;
    markDirty();
    const next = [...imageUrls];
    const [img] = next.splice(index, 1);
    next.unshift(img);
    setForm((f) => (f ? { ...f, images: next.join('\n') } : f));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form || !placeId) return;
    let hoursPayload;
    if (form.hoursStr?.trim()) {
      try {
        hoursPayload = JSON.parse(form.hoursStr);
        if (hoursPayload !== null && (typeof hoursPayload !== 'object' || Array.isArray(hoursPayload))) {
          setError('Opening hours must be a JSON object (e.g. { "mon": "9–5" }) or leave empty.');
          return;
        }
      } catch {
        setError('Opening hours must be valid JSON or left empty.');
        return;
      }
    } else {
      hoursPayload = null;
    }

    setSaving(true);
    setError(null);
    try {
      const images = form.images.trim() ? form.images.split(/\n/).map((s) => s.trim()).filter(Boolean) : [];
      const tags = form.tags.trim() ? form.tags.split(/[,;]/).map((s) => s.trim()).filter(Boolean) : [];
      await api.business.places.update(placeId, {
        name: form.name,
        description: form.description,
        searchName: form.searchName,
        location: form.location,
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
        category: form.category,
        categoryId: form.categoryId,
        duration: form.duration,
        price: form.price,
        bestTime: form.bestTime,
        rating: form.rating ? parseFloat(form.rating) : null,
        reviewCount: form.reviewCount ? parseInt(form.reviewCount, 10) : null,
        images,
        tags,
        hours: hoursPayload,
      });
      dirtyRef.current = false;
      setDirty(false);
      setToast({ type: 'success', msg: 'Changes saved' });
      await loadPlace();
      if (typeof refreshMe === 'function') refreshMe().catch(() => {});
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTranslation = async () => {
    if (!placeId) return;
    setTransSaving(true);
    setError(null);
    try {
      const tags = transForm.tags.trim() ? transForm.tags.split(/[,;]/).map((s) => s.trim()).filter(Boolean) : [];
      await api.business.translations.save(placeId, transLang, {
        name: transForm.name,
        description: transForm.description,
        location: transForm.location,
        category: transForm.category,
        duration: transForm.duration,
        price: transForm.price,
        bestTime: transForm.bestTime,
        tags,
      });
      setToast({ type: 'success', msg: `Saved (${transLang.toUpperCase()})` });
    } catch (err) {
      setError(err.message || 'Could not save translation');
    } finally {
      setTransSaving(false);
    }
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  if (!placeId) {
    return (
      <div className="business-loading">
        <div className="business-banner-error" role="alert">
          Invalid place
        </div>
      </div>
    );
  }

  if (!loading && error && !form) {
    return (
      <div>
        <div className="business-banner-error" role="alert">
          {error}
        </div>
        <p style={{ marginTop: '1rem' }}>
          <Link to="/business" className="business-place-public-link">
            ← Back to dashboard
          </Link>
        </p>
      </div>
    );
  }

  if (loading || !form) {
    return (
      <div className="business-loading">
        {error ? (
          <span className="business-banner-error" role="alert">
            {error}
          </span>
        ) : (
          'Loading listing…'
        )}
      </div>
    );
  }

  const setField = (key) => (e) => {
    markDirty();
    const v = e.target.value;
    setForm((f) => (f ? { ...f, [key]: v } : f));
  };

  return (
    <div>
      <header className="business-edit-header">
        <p className="business-edit-breadcrumb">
          <Link to="/business">Dashboard</Link>
          {' · '}
          <a href={`/place/${encodeURIComponent(placeId)}`} target="_blank" rel="noopener noreferrer">
            Public preview
          </a>
        </p>
        <h1 className="business-edit-title">{place?.name || placeId}</h1>
        <p className="business-edit-id">Place ID: {placeId}</p>
      </header>

      {error && (
        <div className="business-banner-error" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="business-tabs" role="tablist" aria-label="Listing sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`business-tab${tab === t.id ? ' active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="business-panel">
            <h2 className="business-panel-title">Listing copy</h2>
            <div className="business-field">
              <label htmlFor="biz-name">Display name *</label>
              <input id="biz-name" className="business-input" value={form.name} onChange={setField('name')} required />
            </div>
            <div className="business-field">
              <label htmlFor="biz-search">URL / search name</label>
              <input id="biz-search" className="business-input" value={form.searchName} onChange={setField('searchName')} />
              <p className="business-hint">Used for matching URLs and search. Your administrator may set this initially.</p>
            </div>
            <div className="business-field">
              <label htmlFor="biz-desc">Description</label>
              <textarea id="biz-desc" className="business-textarea" rows={6} value={form.description} onChange={setField('description')} />
            </div>
            <div className="business-field">
              <label htmlFor="biz-cat">Category</label>
              <select
                id="biz-cat"
                className="business-select"
                value={categoryCustom ? '__custom__' : (form.categoryId || '')}
                onChange={(e) => {
                  markDirty();
                  const val = e.target.value;
                  setCategoryCustom(val === '__custom__');
                  if (val !== '__custom__') {
                    const cat = categories.find((c) => c.id === val);
                    setForm((f) => ({ ...f, categoryId: cat?.id || val, category: cat?.name || val }));
                  }
                }}
              >
                <option value="">Select…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
                <option value="__custom__">Custom…</option>
              </select>
            </div>
            {categoryCustom && (
              <div className="business-field-row">
                <div className="business-field">
                  <label>Category label</label>
                  <input className="business-input" value={form.category} onChange={setField('category')} />
                </div>
                <div className="business-field">
                  <label>Category ID</label>
                  <input className="business-input" value={form.categoryId} onChange={setField('categoryId')} />
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'location' && (
          <div className="business-panel">
            <h2 className="business-panel-title">Map & address</h2>
            <div className="business-field">
              <label htmlFor="biz-loc">Address</label>
              <input id="biz-loc" className="business-input" value={form.location} onChange={setField('location')} />
            </div>
            <div className="business-field-row">
              <div className="business-field">
                <label htmlFor="biz-lat">Latitude</label>
                <input id="biz-lat" className="business-input" type="number" step="any" value={form.latitude} onChange={setField('latitude')} />
              </div>
              <div className="business-field">
                <label htmlFor="biz-lng">Longitude</label>
                <input id="biz-lng" className="business-input" type="number" step="any" value={form.longitude} onChange={setField('longitude')} />
              </div>
            </div>
            <button type="button" className="business-btn business-btn--ghost" onClick={() => setMapPickerOpen(true)}>
              Pick on map
            </button>
          </div>
        )}

        {tab === 'media' && (
          <div className="business-panel">
            <h2 className="business-panel-title">Photos</h2>
            <p className="business-hint" style={{ marginBottom: '1rem' }}>
              First image is the cover. JPEG, PNG, GIF, or WebP — max 5 MB per file. Images are scanned server-side.
            </p>
            <div
              className="business-upload-zone"
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add('business-upload-zone--drag');
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove('business-upload-zone--drag');
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('business-upload-zone--drag');
                handleImageUpload(e.dataTransfer?.files);
              }}
            >
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                multiple
                style={{ display: 'none' }}
                id="biz-place-upload"
                onChange={(e) => {
                  handleImageUpload(e.target.files);
                  e.target.value = '';
                }}
              />
              <label htmlFor="biz-place-upload" style={{ cursor: uploading ? 'wait' : 'pointer' }}>
                {uploading ? 'Uploading…' : 'Drop images here or click to upload'}
              </label>
            </div>
            {imageUrls.length > 0 && (
              <div className="business-image-grid">
                {imageUrls.map((url, i) => (
                  <div key={url || `i-${i}`} className={`business-image-tile${i === 0 ? ' business-image-tile--cover' : ''}`}>
                    <BizImage url={url} />
                    <div className="business-image-tile-actions">
                      {i > 0 ? (
                        <button type="button" onClick={() => setAsMainImage(i)}>
                          Cover
                        </button>
                      ) : (
                        <span />
                      )}
                      <button type="button" onClick={() => removeImage(i)}>
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="business-field" style={{ marginTop: '1rem' }}>
              <label htmlFor="biz-urls">Image URLs (one per line)</label>
              <textarea id="biz-urls" className="business-textarea" rows={3} value={form.images} onChange={setField('images')} />
            </div>
          </div>
        )}

        {tab === 'details' && (
          <div className="business-panel">
            <h2 className="business-panel-title">Details & social proof</h2>
            <div className="business-field-row">
              <div className="business-field">
                <label>Duration</label>
                <select className="business-select" value={form.duration} onChange={setField('duration')}>
                  {DURATION_OPTIONS.map((o) => (
                    <option key={o || '_'} value={o}>{o || 'Select…'}</option>
                  ))}
                </select>
              </div>
              <div className="business-field">
                <label>Price</label>
                <select className="business-select" value={form.price} onChange={setField('price')}>
                  {PRICE_OPTIONS.map((o) => (
                    <option key={o || '_'} value={o}>{o || 'Select…'}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="business-field">
              <label>Best time to visit</label>
              <select className="business-select" value={form.bestTime} onChange={setField('bestTime')}>
                {BEST_TIME_OPTIONS.map((o) => (
                  <option key={o || '_'} value={o}>{o || 'Select…'}</option>
                ))}
              </select>
            </div>
            <div className="business-field-row">
              <div className="business-field">
                <label>Rating (0–5)</label>
                <select className="business-select" value={form.rating} onChange={setField('rating')}>
                  {RATING_OPTIONS.map((o) => (
                    <option key={o || '_'} value={o}>{o === '' ? 'Select…' : o}</option>
                  ))}
                </select>
              </div>
              <div className="business-field">
                <label>Review count</label>
                <input className="business-input" type="number" value={form.reviewCount} onChange={setField('reviewCount')} />
              </div>
            </div>
            <div className="business-field">
              <label htmlFor="biz-tags">Tags</label>
              <input id="biz-tags" className="business-input" value={form.tags} onChange={setField('tags')} placeholder="Comma-separated" />
            </div>
            <div className="business-field">
              <label htmlFor="biz-hours">Opening hours (JSON)</label>
              <textarea
                id="biz-hours"
                className="business-textarea"
                rows={8}
                value={form.hoursStr}
                onChange={(e) => {
                  markDirty();
                  setForm((f) => (f ? { ...f, hoursStr: e.target.value } : f));
                }}
                placeholder={'{\n  "mon": "9:00–18:00",\n  "tue": "9:00–18:00"\n}'}
                spellCheck={false}
              />
              <p className="business-hint">Optional structured hours for apps that read this field. Leave empty if unsure.</p>
            </div>
          </div>
        )}

        {tab === 'reviews' && (
          <div className="business-panel">
            <h2 className="business-panel-title">Member reviews</h2>
            <p className="business-hint" style={{ marginBottom: '1rem' }}>
              Hide reviews from your public page, restore them, or delete them. Members edit or delete their own reviews on the place page when the review is visible.
            </p>
            {bizReviewsErr && (
              <div className="business-banner-error" role="alert" style={{ marginBottom: '1rem' }}>
                {bizReviewsErr}
              </div>
            )}
            {bizReviewsLoading && <p className="business-hint">Loading…</p>}
            {!bizReviewsLoading && bizReviews.length === 0 && !bizReviewsErr && (
              <p className="business-hint">No member reviews yet.</p>
            )}
            {bizReviews.length > 0 && (
              <ul className="business-reviews-list">
                {bizReviews.map((rv) => (
                  <li key={rv.id} className="business-reviews-item">
                    <div className="business-reviews-meta">
                      <strong>{rv.authorName}</strong>
                      {rv.authorEmail ? <span className="business-reviews-email">{rv.authorEmail}</span> : null}
                      <span className="business-reviews-stars">{rv.rating}★</span>
                      {rv.hidden ? <span className="business-reviews-badge">Hidden</span> : null}
                    </div>
                    {rv.title ? <div className="business-reviews-title">{rv.title}</div> : null}
                    {rv.review ? <p className="business-reviews-body">{rv.review}</p> : null}
                    <div className="business-reviews-actions">
                      <button
                        type="button"
                        className="business-btn business-btn--ghost"
                        onClick={async () => {
                          try {
                            setBizReviewsErr(null);
                            await api.places.patchReview(placeId, rv.id, { hidden: !rv.hidden });
                            await refreshBizReviews();
                          } catch (e) {
                            setBizReviewsErr(e.message || 'Update failed');
                          }
                        }}
                      >
                        {rv.hidden ? 'Restore on public page' : 'Hide from public page'}
                      </button>
                      <button
                        type="button"
                        className="business-btn business-btn--ghost"
                        onClick={async () => {
                          if (!window.confirm('Permanently delete this review?')) return;
                          try {
                            setBizReviewsErr(null);
                            await api.places.deleteReview(placeId, rv.id);
                            await refreshBizReviews();
                          } catch (e) {
                            setBizReviewsErr(e.message || 'Delete failed');
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === 'languages' && (
          <div className="business-panel">
            <h2 className="business-panel-title">Localized copy</h2>
            <p className="business-hint" style={{ marginBottom: '1rem' }}>
              Overrides for visitors by language. Empty fields fall back to the main listing above.
            </p>
            <div className="business-trans-lang">
              {TRANS_LANGS.map(({ code, label }) => (
                <button
                  key={code}
                  type="button"
                  className={transLang === code ? 'active' : ''}
                  onClick={() => setTransLang(code)}
                >
                  {label}
                </button>
              ))}
            </div>
            {!transLoaded ? (
              <div className="business-loading">Loading…</div>
            ) : (
              <div>
                <div className="business-field">
                  <label>Name</label>
                  <input className="business-input" value={transForm.name} onChange={(e) => setTransForm((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="business-field">
                  <label>Description</label>
                  <textarea className="business-textarea" rows={4} value={transForm.description} onChange={(e) => setTransForm((f) => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="business-field">
                  <label>Location</label>
                  <input className="business-input" value={transForm.location} onChange={(e) => setTransForm((f) => ({ ...f, location: e.target.value }))} />
                </div>
                <div className="business-field-row">
                  <div className="business-field">
                    <label>Category</label>
                    <input className="business-input" value={transForm.category} onChange={(e) => setTransForm((f) => ({ ...f, category: e.target.value }))} />
                  </div>
                  <div className="business-field">
                    <label>Duration</label>
                    <input className="business-input" value={transForm.duration} onChange={(e) => setTransForm((f) => ({ ...f, duration: e.target.value }))} />
                  </div>
                </div>
                <div className="business-field-row">
                  <div className="business-field">
                    <label>Price</label>
                    <input className="business-input" value={transForm.price} onChange={(e) => setTransForm((f) => ({ ...f, price: e.target.value }))} />
                  </div>
                  <div className="business-field">
                    <label>Best time</label>
                    <input className="business-input" value={transForm.bestTime} onChange={(e) => setTransForm((f) => ({ ...f, bestTime: e.target.value }))} />
                  </div>
                </div>
                <div className="business-field">
                  <label>Tags</label>
                  <input className="business-input" value={transForm.tags} onChange={(e) => setTransForm((f) => ({ ...f, tags: e.target.value }))} />
                </div>
                <button type="button" className="business-btn business-btn--primary" disabled={transSaving} onClick={handleSaveTranslation}>
                  {transSaving ? 'Saving…' : `Save ${transLang.toUpperCase()}`}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="business-sticky-actions">
          <span style={{ fontSize: '0.85rem', color: 'var(--biz-muted)' }}>
            {dirty ? 'You have unsaved changes to this listing.' : 'Changes apply after you click Save listing.'}
          </span>
          <button type="submit" className="business-btn business-btn--primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save listing'}
          </button>
        </div>
      </form>

      {mapPickerOpen && (
        <MapPicker lat={form.latitude} lng={form.longitude} onSelect={handleMapSelect} onClose={() => setMapPickerOpen(false)} />
      )}

      {toast && (
        <div className={`business-toast business-toast--${toast.type}`} role="status" aria-live="polite">
          {toast.msg}
        </div>
      )}
    </div>
  );
}
