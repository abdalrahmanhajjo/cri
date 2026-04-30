import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { suggestPublicId, linesToStringArray, parseItineraryJson } from '../../utils/adminContentHelpers';
import { AdminCoverImageField, AdminPlaceIdsPicker } from './AdminFormPickers';
import './css/Admin.css';

const CURRENCY_OPTIONS = ['USD', 'EUR', 'LBP'];
const DIFFICULTY_OPTIONS = ['Easy', 'Moderate', 'Challenging'];

function ExperienceFormModal({ tour, onClose, onSaved }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const [form, setForm] = useState({
    id: '', name: '', duration: '', durationHours: '', locations: '', rating: '', reviews: '',
    price: '', currency: '', priceDisplay: '', badge: '', badgeColor: '', description: '', image: '',
    difficulty: '', placeIds: '',
    languagesText: '', highlightsText: '', includesText: '', excludesText: '', itineraryJson: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (tour) {
      setForm({
        id: tour.id || '',
        name: tour.name || '',
        duration: tour.duration || '',
        durationHours: tour.durationHours ?? tour.duration_hours ?? '',
        locations: tour.locations ?? '',
        rating: tour.rating ?? '',
        reviews: tour.reviews ?? '',
        price: tour.price ?? '',
        currency: tour.currency || 'USD',
        priceDisplay: tour.priceDisplay || tour.price_display || '',
        badge: tour.badge || '',
        badgeColor: tour.badgeColor || tour.badge_color || '',
        description: tour.description || '',
        image: tour.image || '',
        difficulty: tour.difficulty || 'Easy',
        placeIds: Array.isArray(tour.placeIds) ? tour.placeIds.join(', ') : (Array.isArray(tour.place_ids) ? tour.place_ids.join(', ') : ''),
        languagesText: Array.isArray(tour.languages) ? tour.languages.join('\n') : '',
        highlightsText: Array.isArray(tour.highlights) ? tour.highlights.join('\n') : '',
        includesText: Array.isArray(tour.includes) ? tour.includes.join('\n') : '',
        excludesText: Array.isArray(tour.excludes) ? tour.excludes.join('\n') : '',
        itineraryJson: Array.isArray(tour.itinerary) && tour.itinerary.length > 0
          ? JSON.stringify(tour.itinerary, null, 2)
          : '',
      });
    } else {
      setForm({
        id: '',
        name: '',
        duration: '3 hours',
        durationHours: '3',
        locations: '1',
        rating: '0',
        reviews: '0',
        price: '',
        currency: 'USD',
        priceDisplay: '',
        badge: '',
        badgeColor: '',
        description: '',
        image: '',
        difficulty: 'Easy',
        placeIds: '',
        languagesText: '',
        highlightsText: '',
        includesText: '',
        excludesText: '',
        itineraryJson: '',
      });
    }
  }, [tour]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    try {
      const itParsed = parseItineraryJson(form.itineraryJson);
      if (!itParsed.ok) {
        setErr(itParsed.error || 'Invalid itinerary JSON');
        setSaving(false);
        return;
      }
      const placeIds = form.placeIds.trim() ? form.placeIds.split(/[,;]/).map((s) => s.trim()).filter(Boolean) : [];
      const customId = (form.id || '').trim();
      const resolvedId = !tour && !customId ? suggestPublicId('tour', form.name) : customId || undefined;
      const fromPlaces = placeIds.length;
      const locationsCount = fromPlaces > 0 ? fromPlaces : Math.max(1, parseInt(form.locations, 10) || 1);
      const payload = {
        id: resolvedId || undefined,
        name: form.name,
        duration: form.duration || '3 hours',
        durationHours: parseInt(form.durationHours, 10) || 3,
        locations: locationsCount,
        rating: parseFloat(form.rating) || 0,
        reviews: parseInt(form.reviews, 10) || 0,
        price: form.price === '' || form.price == null ? 0 : parseFloat(form.price) || 0,
        currency: form.currency,
        priceDisplay: form.priceDisplay || (form.price === '' || form.price == null ? 'On request' : String(form.price)),
        badge: form.badge || null,
        badgeColor: form.badgeColor || null,
        description: form.description,
        image: form.image.trim() || 'https://via.placeholder.com/400',
        difficulty: form.difficulty,
        placeIds,
        languages: linesToStringArray(form.languagesText),
        highlights: linesToStringArray(form.highlightsText),
        includes: linesToStringArray(form.includesText),
        excludes: linesToStringArray(form.excludesText),
        itinerary: itParsed.data,
      };
      if (tour) {
        await api.admin.tours.update(tour.id, payload);
      } else {
        await api.admin.tours.create(payload);
      }
      onSaved();
      onClose();
    } catch (e) {
      setErr(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const TourIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );

  return (
    <div className="admin-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal admin-modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <h2>
            <span className="admin-modal-header-icon"><TourIcon /></span>
            {tour ? 'Edit Experience' : 'Add Experience'}
          </h2>
          <button type="button" className="admin-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="admin-modal-body">
            {err && <div className="admin-error">{err}</div>}
            {!tour && (
              <p className="admin-modal-lead">
                <strong>Quick add:</strong> title and duration are enough — a URL id is generated on save. Price is optional (saved as &quot;On request&quot; if you leave it blank).
                Add <strong>place IDs</strong> to link stops; the stop count follows the list. Open <strong>More options</strong> for ratings, badges, or a manual stop count.
                Use <strong>Full tour content</strong> for languages, bullet lists, and a JSON itinerary.
              </p>
            )}

            <div className="admin-form-section">
              <div className="admin-form-section-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" /></svg>
                Basic info
              </div>
              <div className="admin-form-group">
                <label>Name *</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required placeholder="e.g. Food Tour of Tripoli" />
              </div>
              <div className="admin-form-group">
                <label>Description</label>
                <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Short public description (you can expand later)…" rows={3} />
              </div>
            </div>

            <div className="admin-form-section">
              <div className="admin-form-section-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                Duration & difficulty
              </div>
              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label>Duration (text)</label>
                  <input value={form.duration} onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))} placeholder="e.g. 3 hours" />
                </div>
                <div className="admin-form-group">
                  <label>Duration (hours)</label>
                  <input type="number" min="1" value={form.durationHours} onChange={(e) => setForm((f) => ({ ...f, durationHours: e.target.value }))} placeholder="3" />
                </div>
              </div>
              <div className="admin-form-group">
                <label>Difficulty</label>
                <select value={form.difficulty} onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value }))}>
                  {form.difficulty && !DIFFICULTY_OPTIONS.includes(form.difficulty) && (
                    <option value={form.difficulty}>{form.difficulty} (custom)</option>
                  )}
                  {DIFFICULTY_OPTIONS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="admin-form-section">
              <div className="admin-form-section-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                Price
              </div>
              <div className="admin-form-row admin-form-row--3">
                <div className="admin-form-group">
                  <label>Amount (optional)</label>
                  <input type="number" step="0.01" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} placeholder="Leave empty for “on request”" />
                </div>
                <div className="admin-form-group">
                  <label>Currency</label>
                  <select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}>
                    {form.currency && !CURRENCY_OPTIONS.includes(form.currency) && (
                      <option value={form.currency}>{form.currency} (custom)</option>
                    )}
                    {CURRENCY_OPTIONS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="admin-form-group">
                  <label>Price display</label>
                  <input value={form.priceDisplay} onChange={(e) => setForm((f) => ({ ...f, priceDisplay: e.target.value }))} placeholder="e.g. $25, From $40" />
                </div>
              </div>
            </div>

            <div className="admin-form-section">
              <div className="admin-form-section-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>
                Media & route
              </div>
              <AdminCoverImageField
                inputId="admin-experience-cover-upload"
                value={form.image}
                onChange={(url) => setForm((f) => ({ ...f, image: url }))}
                onError={(msg) => setErr(msg)}
              />
              <AdminPlaceIdsPicker
                value={form.placeIds}
                onChange={(idsStr) => setForm((f) => ({ ...f, placeIds: idsStr }))}
                onError={(msg) => setErr(msg)}
              />
            </div>

            <details className="admin-advanced-details">
              <summary>Full tour content — languages, highlights, includes / excludes, itinerary</summary>
              <div className="admin-form-section" style={{ border: 'none', paddingBottom: 0 }}>
                <div className="admin-form-group">
                  <label>Languages (one per line)</label>
                  <textarea
                    value={form.languagesText}
                    onChange={(e) => setForm((f) => ({ ...f, languagesText: e.target.value }))}
                    placeholder={'English\nArabic'}
                    rows={3}
                  />
                </div>
                <div className="admin-form-group">
                  <label>Highlights (one per line)</label>
                  <textarea
                    value={form.highlightsText}
                    onChange={(e) => setForm((f) => ({ ...f, highlightsText: e.target.value }))}
                    placeholder="Short bullets shown on the public page"
                    rows={3}
                  />
                </div>
                <div className="admin-form-group">
                  <label>Includes (one per line)</label>
                  <textarea
                    value={form.includesText}
                    onChange={(e) => setForm((f) => ({ ...f, includesText: e.target.value }))}
                    placeholder="e.g. Local guide, water"
                    rows={3}
                  />
                </div>
                <div className="admin-form-group">
                  <label>Excludes (one per line)</label>
                  <textarea
                    value={form.excludesText}
                    onChange={(e) => setForm((f) => ({ ...f, excludesText: e.target.value }))}
                    placeholder="e.g. Meals, tips"
                    rows={3}
                  />
                </div>
                <div className="admin-form-group">
                  <label>Itinerary (JSON array)</label>
                  <textarea
                    value={form.itineraryJson}
                    onChange={(e) => setForm((f) => ({ ...f, itineraryJson: e.target.value }))}
                    placeholder='[{"time":"09:00","activity":"Hallab","description":"..."}]'
                    rows={8}
                    spellCheck={false}
                    className="admin-textarea-code"
                  />
                  <span className="admin-form-hint">Leave empty if none. Each item can be a string or an object with time, activity, description.</span>
                </div>
              </div>
            </details>

            <details className="admin-advanced-details">
              <summary>More options — ratings, badge &amp; stop count</summary>
              <div className="admin-form-section" style={{ border: 'none', paddingBottom: 0 }}>
                <div className="admin-form-row">
                  <div className="admin-form-group">
                    <label>Rating (0–5)</label>
                    <input type="number" step="0.1" min="0" max="5" value={form.rating} onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value }))} placeholder="0" />
                  </div>
                  <div className="admin-form-group">
                    <label>Review count</label>
                    <input type="number" min="0" value={form.reviews} onChange={(e) => setForm((f) => ({ ...f, reviews: e.target.value }))} placeholder="0" />
                  </div>
                </div>
                <div className="admin-form-row">
                  <div className="admin-form-group">
                    <label>Badge</label>
                    <input value={form.badge} onChange={(e) => setForm((f) => ({ ...f, badge: e.target.value }))} placeholder="Popular, New, Best value" />
                  </div>
                  <div className="admin-form-group">
                    <label>Badge color</label>
                    <input value={form.badgeColor} onChange={(e) => setForm((f) => ({ ...f, badgeColor: e.target.value }))} placeholder="#0F766E" />
                  </div>
                </div>
                <div className="admin-form-group">
                  <label>Manual stop count</label>
                  <input type="number" min="1" value={form.locations} onChange={(e) => setForm((f) => ({ ...f, locations: e.target.value }))} placeholder="Used when place IDs are empty" />
                  <span className="admin-form-hint">Ignored when you list place IDs above.</span>
                </div>
              </div>
            </details>

            {!tour && (
              <details className="admin-advanced-details">
                <summary>Custom URL id (optional)</summary>
                <div className="admin-form-group" style={{ marginTop: '0.75rem' }}>
                  <label>Id slug</label>
                  <input value={form.id} onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))} placeholder="Leave blank to auto-generate from the name" />
                  <div className="admin-row-actions">
                    <button
                      type="button"
                      className="admin-btn admin-btn--sm admin-btn--secondary"
                      onClick={() => setForm((f) => ({ ...f, id: suggestPublicId('tour', f.name) }))}
                    >
                      Suggest from title
                    </button>
                  </div>
                  <span className="admin-form-hint">Used in /tour/your-id — only change if you need a fixed link</span>
                </div>
              </details>
            )}
          </div>
          <div className="admin-modal-footer">
            <button type="button" className="admin-btn admin-btn--secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="admin-btn admin-btn--primary" disabled={saving}>{saving ? 'Saving…' : 'Save Experience'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminExperiences() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [modalTour, setModalTour] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast] = useState(null);

  const fetchData = useCallback(() => {
    api.tours.list()
      .then((r) => setData(r.featured || []))
      .catch((err) => setError(err.message || 'Failed to load experiences'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.trim().toLowerCase();
    return data.filter((t) =>
      (t.name && t.name.toLowerCase().includes(q)) ||
      (t.description && t.description.toLowerCase().includes(q))
    );
  }, [data, search]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.admin.tours.delete(deleteTarget.id);
      setToast({ type: 'success', msg: 'Experience deleted' });
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
          <p className="admin-subtitle">Manage tours and experiences</p>
          <h1>Experiences</h1>
        </div>
        <div className="admin-page-header-actions">
          <div className="admin-search-wrap">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input type="search" placeholder="Search experiences…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button type="button" className="admin-btn admin-btn--primary" onClick={() => setModalTour({})}>+ Add Experience</button>
        </div>
      </div>
      {error && <div className="admin-error">{error}</div>}
      <div className="admin-widgets admin-dashboard-grid" style={{ gridTemplateColumns: 'repeat(12, 1fr)' }}>
        <div className="admin-card" style={{ gridColumn: 'span 3' }}>
          <div className="admin-card-body">
            <div className="admin-stat-value">{loading ? '—' : filtered.length}</div>
            <div className="admin-stat-label">Experiences{search.trim() ? ' (filtered)' : ''}</div>
          </div>
        </div>
        <div className="admin-card" style={{ gridColumn: 'span 9' }}>
          <div className="admin-card-header">
            <h2 className="admin-card-title">All Experiences</h2>
            <div className="admin-card-header-actions">
              <button type="button" className="admin-btn admin-btn--sm admin-btn--primary" onClick={() => setModalTour({})}>+ Add</button>
            </div>
          </div>
          <div className="admin-card-body" style={{ padding: 0 }}>
            {loading && <div className="admin-loading">Loading experiences…</div>}
            {!loading && filtered.length === 0 && <div className="admin-empty">No experiences found.</div>}
            {!loading && filtered.length > 0 && (
              <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Duration</th>
                <th>Price</th>
                <th>Rating</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id}>
                  <td>{t.name || '—'}</td>
                  <td>{t.duration || (t.durationHours != null ? `${t.durationHours}h` : '—')}</td>
                  <td>{t.priceDisplay || (t.price != null ? String(t.price) : '—')}</td>
                  <td>{t.rating != null ? t.rating : '—'}</td>
                  <td>
                    <div className="admin-table-actions">
                      <Link to={`/tour/${t.id}`} target="_blank" rel="noopener noreferrer">View</Link>
                      <button type="button" className="admin-btn admin-btn--sm admin-btn--secondary" onClick={() => setModalTour(t)}>Edit</button>
                      <button type="button" className="admin-btn admin-btn--sm admin-btn--danger" onClick={() => setDeleteTarget(t)}>Delete</button>
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

      {modalTour !== null && (
        <ExperienceFormModal
          tour={modalTour && Object.keys(modalTour).length ? modalTour : null}
          onClose={() => setModalTour(null)}
          onSaved={() => { setToast({ type: 'success', msg: 'Experience saved' }); fetchData(); }}
        />
      )}

      {deleteTarget && (
        <div className="admin-confirm-backdrop" onClick={(e) => e.target === e.currentTarget && setDeleteTarget(null)}>
          <div className="admin-confirm" onClick={(e) => e.stopPropagation()}>
            <h3>Delete experience?</h3>
            <p>{`This will permanently delete "${deleteTarget.name}". This cannot be undone.`}</p>
            <div className="admin-confirm-actions">
              <button type="button" className="admin-btn admin-btn--secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button type="button" className="admin-btn admin-btn--danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`admin-toast admin-toast--${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
