import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api, getImageUrl, fixImageUrlExtension, getImageUrlAlternate } from '../../api/client';
import MapPicker from '../../components/MapPicker';
import './Admin.css';

function AdminImageWithFallback({ url }) {
  const primary = getImageUrl(fixImageUrlExtension(url));
  const altUrl = getImageUrlAlternate(primary) || url;
  const fallback = altUrl !== primary ? getImageUrl(altUrl) : null;
  const [src, setSrc] = useState(primary);
  const [triedFallback, setTriedFallback] = useState(false);
  useEffect(() => {
    setSrc(primary);
    setTriedFallback(false);
  }, [url, primary]);
  const handleError = (e) => {
    if (fallback && !triedFallback) {
      setTriedFallback(true);
      setSrc(fallback);
    } else {
      e.target.style.display = 'none';
      e.target.parentElement?.classList.add('admin-image-error');
    }
  };
  return <img src={src} alt="" onError={handleError} onLoad={(ev) => { ev.target.style.display = ''; ev.target.parentElement?.classList.remove('admin-image-error'); }} />;
}

const DURATION_OPTIONS = ['', '15 mins', '30 mins', '45 mins', '1 hour', '1-2 hours', '2-3 hours', 'Half day', 'Full day'];
const PRICE_OPTIONS = ['', 'Free', '0', '5', '10', '15', '20', '25', '30', '$', '$$', '$$$'];
const BEST_TIME_OPTIONS = ['', 'Morning (9 AM - 12 PM)', 'Afternoon (12 PM - 5 PM)', 'Evening (5 PM - 9 PM)', 'All Day', 'Morning to Afternoon', 'Between Prayer Times', 'Lunch (11 AM - 2 PM)'];
const RATING_OPTIONS = ['', '0', '0.5', '1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5'];

function PlaceFormModal({ place, onClose, onSaved }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const [form, setForm] = useState({
    id: '',
    name: '',
    description: '',
    location: '',
    latitude: '',
    longitude: '',
    category: '',
    categoryId: '',
    duration: '',
    price: '',
    bestTime: '',
    rating: '',
    reviewCount: '',
    images: '',
    tags: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [categories, setCategories] = useState([]);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [categoryCustom, setCategoryCustom] = useState(false);

  useEffect(() => {
    api.categories.list().then((r) => {
      const list = r?.categories || [];
      setCategories(Array.isArray(list) ? list : []);
    }).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (place) {
      const catId = place.categoryId || place.category_id || '';
      setCategoryCustom(!categories.length || !categories.some((c) => c.id === catId));
      setForm({
        id: place.id || '',
        name: place.name || '',
        description: place.description || '',
        location: place.location || '',
        latitude: place.latitude ?? '',
        longitude: place.longitude ?? '',
        category: place.category || '',
        categoryId: place.categoryId || place.category_id || '',
        duration: place.duration || '',
        price: place.price ?? '',
        bestTime: place.bestTime || place.best_time || '',
        rating: place.rating ?? '',
        reviewCount: place.reviewCount ?? place.review_count ?? '',
        images: Array.isArray(place.images) ? place.images.join('\n') : '',
        tags: Array.isArray(place.tags) ? place.tags.join(', ') : (place.tags || ''),
      });
    } else {
      setCategoryCustom(false);
      setForm({
        id: '', name: '', description: '', location: '', latitude: '', longitude: '',
        category: '', categoryId: '', duration: '', price: '', bestTime: '', rating: '', reviewCount: '',
        images: '', tags: '',
      });
    }
  }, [place]);

  useEffect(() => {
    if (place && categories.length > 0) {
      const catId = place.categoryId || place.category_id || '';
      setCategoryCustom(!catId || !categories.some((c) => c.id === catId));
    }
  }, [place, categories]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    try {
      const images = form.images.trim() ? form.images.split(/\n/).map((s) => s.trim()).filter(Boolean) : [];
      const tags = form.tags.trim() ? form.tags.split(/[,;]/).map((s) => s.trim()).filter(Boolean) : [];
      const payload = {
        id: form.id || undefined,
        name: form.name,
        description: form.description,
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
      };
      if (place) {
        await api.admin.places.update(place.id, payload);
      } else {
        await api.admin.places.create(payload);
      }
      onSaved();
      onClose();
    } catch (e) {
      setErr(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const imageUrls = form.images.trim() ? form.images.split(/\n/).map((s) => s.trim()).filter(Boolean) : [];
  const firstImage = imageUrls[0];

  const handleMapSelect = (lat, lng) => {
    setForm((f) => ({ ...f, latitude: String(lat), longitude: String(lng) }));
    setMapPickerOpen(false);
  };

  const handleImageUpload = async (files) => {
    if (!files?.length) return;
    setErr(null);
    setUploading(true);
    try {
      const results = await Promise.all(
        Array.from(files).map((file) =>
          api.admin.upload(file).catch((e) => {
            throw new Error(`${file.name}: ${e?.message || 'Upload failed'}`);
          })
        )
      );
      const newUrls = [...imageUrls, ...results].filter(Boolean);
      setForm((f) => ({ ...f, images: newUrls.join('\n') }));
    } catch (e) {
      setErr(e?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index) => {
    const next = [...imageUrls];
    next.splice(index, 1);
    setForm((f) => ({ ...f, images: next.join('\n') }));
  };

  const setAsMainImage = (index) => {
    if (index === 0) return;
    const next = [...imageUrls];
    const [img] = next.splice(index, 1);
    next.unshift(img);
    setForm((f) => ({ ...f, images: next.join('\n') }));
  };
  const PlaceIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
  );

  return (
    <div className="admin-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal admin-modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <h2>
            <span className="admin-modal-header-icon"><PlaceIcon /></span>
            {place ? 'Edit Place' : 'Add Place'}
          </h2>
          <button type="button" className="admin-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="admin-modal-body">
            {err && <div className="admin-error">{err}</div>}

            <div className="admin-form-section">
              <div className="admin-form-section-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" /></svg>
                Basic info
              </div>
              {!place && (
                <div className="admin-form-group">
                  <label>ID (slug)</label>
                  <input value={form.id} onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))} placeholder="e.g. my_place" />
                  <span className="admin-form-hint">Unique identifier used in URLs</span>
                </div>
              )}
              <div className="admin-form-group">
                <label>Name *</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required placeholder="e.g. Hallab Sweets" />
              </div>
              <div className="admin-form-group">
                <label>Description</label>
                <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Brief description of the place…" rows={3} />
              </div>
            </div>

            <div className="admin-form-section">
              <div className="admin-form-section-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                Location & coordinates
              </div>
              <div className="admin-form-group">
                <label>Address / Location</label>
                <input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="e.g. Al-Mina, Tripoli" />
              </div>
              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label>Latitude</label>
                  <input type="number" step="any" value={form.latitude} onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))} placeholder="34.4367" />
                </div>
                <div className="admin-form-group">
                  <label>Longitude</label>
                  <input type="number" step="any" value={form.longitude} onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))} placeholder="35.8497" />
                </div>
              </div>
              <button type="button" className="admin-btn admin-btn--secondary" onClick={() => setMapPickerOpen(true)}>
                Pick on map
              </button>
            </div>

            <div className="admin-form-section">
              <div className="admin-form-section-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" /></svg>
                Category & details
              </div>
              <div className="admin-form-group">
                <label>Category</label>
                <select
                  value={categoryCustom ? '__custom__' : (form.categoryId || '')}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCategoryCustom(val === '__custom__');
                    if (val !== '__custom__') {
                      const cat = categories.find((c) => c.id === val);
                      setForm((f) => ({ ...f, categoryId: cat?.id || val, category: cat?.name || val }));
                    }
                  }}
                >
                  <option value="">Select category…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                  <option value="__custom__">Other (type below)</option>
                </select>
              </div>
              {categoryCustom && (
                <div className="admin-form-row">
                  <div className="admin-form-group">
                    <label>Category (custom)</label>
                    <input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="e.g. Food & Dining" />
                  </div>
                  <div className="admin-form-group">
                    <label>Category ID</label>
                    <input value={form.categoryId} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))} placeholder="e.g. food" />
                  </div>
                </div>
              )}
              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label>Duration</label>
                  <select value={form.duration} onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}>
                    {DURATION_OPTIONS.map((o) => (
                      <option key={o || '_'} value={o}>{o || 'Select…'}</option>
                    ))}
                  </select>
                </div>
                <div className="admin-form-group">
                  <label>Price</label>
                  <select value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}>
                    {PRICE_OPTIONS.map((o) => (
                      <option key={o || '_'} value={o}>{o || 'Select…'}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="admin-form-group">
                <label>Best time to visit</label>
                <select value={form.bestTime} onChange={(e) => setForm((f) => ({ ...f, bestTime: e.target.value }))}>
                  {BEST_TIME_OPTIONS.map((o) => (
                    <option key={o || '_'} value={o}>{o || 'Select…'}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="admin-form-section">
              <div className="admin-form-section-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                Ratings & reviews
              </div>
              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label>Rating (0–5)</label>
                  <select value={form.rating} onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value }))}>
                    {RATING_OPTIONS.map((o) => (
                      <option key={o || '_'} value={o}>{o === '' ? 'Select…' : o}</option>
                    ))}
                  </select>
                </div>
                <div className="admin-form-group">
                  <label>Review count</label>
                  <input type="number" value={form.reviewCount} onChange={(e) => setForm((f) => ({ ...f, reviewCount: e.target.value }))} placeholder="0" />
                </div>
              </div>
            </div>

            <div className="admin-form-section">
              <div className="admin-form-section-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>
                Media & tags
              </div>
              <div
                className="admin-image-upload-zone"
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('admin-image-upload-zone--drag'); }}
                onDragLeave={(e) => { e.currentTarget.classList.remove('admin-image-upload-zone--drag'); }}
                onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('admin-image-upload-zone--drag'); handleImageUpload(e.dataTransfer?.files); }}
              >
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  multiple
                  style={{ display: 'none' }}
                  id="place-image-upload"
                  onChange={(e) => { handleImageUpload(e.target.files); e.target.value = ''; }}
                />
                <label htmlFor="place-image-upload" style={{ cursor: uploading ? 'wait' : 'pointer', margin: 0 }}>
                  {uploading ? 'Uploading…' : 'Drop images here or click to upload (JPEG, PNG, GIF, WebP)'}
                </label>
              </div>
              {imageUrls.length > 0 && (
                <div className="admin-image-list">
                  <p className="admin-form-hint" style={{ width: '100%', marginBottom: '0.5rem' }}>First image is the main/cover image. Click &quot;Set as main&quot; to change.</p>
                  {imageUrls.map((url, i) => (
                    <div key={i} className={`admin-image-list-item ${i === 0 ? 'admin-image-list-item--main' : ''}`}>
                      {i === 0 && <span className="admin-image-main-badge">Main</span>}
                      <AdminImageWithFallback url={url} />
                      <div className="admin-image-list-item-actions">
                        {i > 0 ? (
                          <button type="button" className="admin-btn admin-btn--sm admin-btn--secondary" onClick={() => setAsMainImage(i)}>Set as main</button>
                        ) : (
                          <span className="admin-image-main-label">Cover</span>
                        )}
                        <button type="button" className="admin-image-remove" onClick={() => removeImage(i)} aria-label="Remove">×</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="admin-form-group">
                <label>Or paste URLs (one per line)</label>
                <textarea value={form.images} onChange={(e) => setForm((f) => ({ ...f, images: e.target.value }))} placeholder={'https://example.com/image1.jpg\nhttps://example.com/image2.jpg'} rows={2} />
              </div>
              <div className="admin-form-group">
                <label>Tags (comma-separated)</label>
                <input value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} placeholder="market, historic, shopping, family-friendly" />
              </div>
            </div>
          </div>
          <div className="admin-modal-footer">
            <button type="button" className="admin-btn admin-btn--secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="admin-btn admin-btn--primary" disabled={saving}>{saving ? 'Saving…' : 'Save Place'}</button>
          </div>
        </form>
      </div>
      {mapPickerOpen && (
        <MapPicker
          lat={form.latitude}
          lng={form.longitude}
          onSelect={handleMapSelect}
          onClose={() => setMapPickerOpen(false)}
        />
      )}
    </div>
  );
}

export default function AdminPlaces() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [modalPlace, setModalPlace] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast] = useState(null);

  const fetchData = useCallback(() => {
    api.places.list()
      .then((r) => {
        const list = r.popular || r.locations || [];
        setData(Array.isArray(list) ? list : []);
      })
      .catch((err) => setError(err.message || 'Failed to load places'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.trim().toLowerCase();
    return data.filter((p) =>
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.location && p.location.toLowerCase().includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q))
    );
  }, [data, search]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.admin.places.delete(deleteTarget.id);
      setToast({ type: 'success', msg: 'Place deleted' });
      setDeleteTarget(null);
      fetchData();
    } catch (e) {
      setToast({ type: 'error', msg: e.message || 'Delete failed' });
    }
  };

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  return (
    <div className="admin-page-content">
      <div className="admin-page-header">
        <div className="admin-page-title-wrap">
          <p className="admin-subtitle">Manage spots and places</p>
          <h1>Places</h1>
        </div>
        <div className="admin-page-header-actions">
          <div className="admin-search-wrap">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input type="search" placeholder="Search places…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button type="button" className="admin-btn admin-btn--primary" onClick={() => setModalPlace({})}>
            + Add Place
          </button>
        </div>
      </div>
      {error && <div className="admin-error">{error}</div>}
      <div className="admin-widgets admin-dashboard-grid" style={{ gridTemplateColumns: 'repeat(12, 1fr)' }}>
        <div className="admin-card" style={{ gridColumn: 'span 3' }}>
          <div className="admin-card-body">
            <div className="admin-stat-value">{loading ? '—' : filtered.length}</div>
            <div className="admin-stat-label">Places{search.trim() ? ' (filtered)' : ''}</div>
          </div>
        </div>
        <div className="admin-card" style={{ gridColumn: 'span 9' }}>
          <div className="admin-card-header">
            <h2 className="admin-card-title">All Places</h2>
            <div className="admin-card-header-actions">
              <button type="button" className="admin-btn admin-btn--sm admin-btn--primary" onClick={() => setModalPlace({})}>+ Add</button>
            </div>
          </div>
          <div className="admin-card-body" style={{ padding: 0 }}>
            {loading && <div className="admin-loading">Loading places…</div>}
            {!loading && filtered.length === 0 && <div className="admin-empty">No places found.</div>}
            {!loading && filtered.length > 0 && (
              <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Location</th>
                <th>Category</th>
                <th>Rating</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td>{p.name || '—'}</td>
                  <td>{p.location || '—'}</td>
                  <td>{p.category || '—'}</td>
                  <td>{p.rating != null ? p.rating : '—'}</td>
                  <td>
                    <div className="admin-table-actions">
                      <Link to={'/place/' + p.id} target="_blank" rel="noopener noreferrer">View</Link>
                      <button type="button" className="admin-btn admin-btn--sm admin-btn--secondary" onClick={() => setModalPlace(p)}>Edit</button>
                      <button type="button" className="admin-btn admin-btn--sm admin-btn--danger" onClick={() => setDeleteTarget(p)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
            )}
          </div>
        </div>
      </div>

      {modalPlace !== null && (
        <PlaceFormModal
          place={modalPlace && Object.keys(modalPlace).length ? modalPlace : null}
          onClose={() => setModalPlace(null)}
          onSaved={() => { setToast({ type: 'success', msg: 'Place saved' }); fetchData(); }}
        />
      )}

      {deleteTarget && (
        <div className="admin-confirm-backdrop" onClick={(e) => e.target === e.currentTarget && setDeleteTarget(null)}>
          <div className="admin-confirm" onClick={(e) => e.stopPropagation()}>
            <h3>Delete place?</h3>
            <p>This will permanently delete &quot;{deleteTarget.name}&quot;. This cannot be undone.</p>
            <div className="admin-confirm-actions">
              <button type="button" className="admin-btn admin-btn--secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button type="button" className="admin-btn admin-btn--danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`admin-toast admin-toast--${toast.type}`}>{toast.msg}</div>
      )}
    </div>
  );
}
