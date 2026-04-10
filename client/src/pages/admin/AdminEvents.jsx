import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { suggestPublicId } from '../../utils/adminContentHelpers';
import MapPicker from '../../components/MapPicker';
import { AdminCoverImageField, AdminSinglePlacePicker } from './AdminFormPickers';
import './Admin.css';

const EVENT_CATEGORY_QUICK = ['Festival', 'Concert', 'Culture', 'Food & drink', 'Family', 'Sports', 'Workshop'];

function formatDate(str) {
  if (!str) return '—';
  try {
    const d = new Date(str);
    return isNaN(d.getTime()) ? str : d.toLocaleDateString(undefined, { dateStyle: 'short' });
  } catch {
    return str;
  }
}

function toISOLocal(d) {
  if (!d) return '';
  const x = new Date(d);
  return isNaN(x.getTime()) ? '' : x.toISOString().slice(0, 16);
}

function EventFormModal({ event, onClose, onSaved }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const [form, setForm] = useState({
    id: '', name: '', description: '', startDate: '', endDate: '', location: '', image: '',
    category: '', organizer: '', price: '', priceDisplay: '', status: 'active', placeId: '',
    latitude: '', longitude: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [placeLinkBusy, setPlaceLinkBusy] = useState(false);

  useEffect(() => {
    if (event) {
      setForm({
        id: event.id || '',
        name: event.name || '',
        description: event.description || '',
        startDate: toISOLocal(event.startDate),
        endDate: toISOLocal(event.endDate),
        location: event.location || '',
        image: event.image || '',
        category: event.category || '',
        organizer: event.organizer || '',
        price: event.price ?? '',
        priceDisplay: event.priceDisplay || event.price_display || '',
        status: event.status || 'active',
        placeId: event.placeId || event.place_id || '',
        latitude: event.latitude != null && event.latitude !== '' ? String(event.latitude) : '',
        longitude: event.longitude != null && event.longitude !== '' ? String(event.longitude) : '',
      });
    } else {
      const now = new Date();
      const end = new Date(now.getTime() + 3600000);
      setForm({
        id: '', name: '', description: '', startDate: toISOLocal(now), endDate: toISOLocal(end),
        location: '', image: '', category: '', organizer: '', price: '', priceDisplay: '', status: 'draft', placeId: '',
        latitude: '', longitude: '',
      });
    }
  }, [event]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    try {
      const customId = (form.id || '').trim();
      const resolvedId = !event && !customId ? suggestPublicId('event', form.name) : customId || undefined;
      const latStr = (form.latitude || '').trim();
      const lngStr = (form.longitude || '').trim();
      const payload = {
        id: resolvedId || undefined,
        name: form.name,
        description: form.description,
        startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
        endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
        location: form.location,
        image: form.image || null,
        category: form.category,
        organizer: form.organizer || null,
        price: form.price ? parseFloat(form.price) : null,
        priceDisplay: form.priceDisplay || null,
        status: form.status,
        placeId: form.placeId || null,
        latitude: latStr && Number.isFinite(parseFloat(latStr)) ? parseFloat(latStr) : null,
        longitude: lngStr && Number.isFinite(parseFloat(lngStr)) ? parseFloat(lngStr) : null,
      };
      if (event) {
        await api.admin.events.update(event.id, payload);
      } else {
        await api.admin.events.create(payload);
      }
      onSaved();
      onClose();
    } catch (e) {
      setErr(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const applyLinkedPlace = async () => {
    const pid = (form.placeId || '').trim();
    if (!pid) {
      setErr('Link a place first (search above), then apply its address and map pin.');
      return;
    }
    setErr(null);
    setPlaceLinkBusy(true);
    try {
      const p = await api.places.get(pid);
      if (!p) throw new Error('Place not found');
      setForm((f) => ({
        ...f,
        location: p.location || p.name || f.location,
        latitude: p.latitude != null && p.latitude !== '' ? String(p.latitude) : f.latitude,
        longitude: p.longitude != null && p.longitude !== '' ? String(p.longitude) : f.longitude,
      }));
    } catch (e) {
      setErr(e.message || 'Could not load place');
    } finally {
      setPlaceLinkBusy(false);
    }
  };

  const EventIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );

  return (
    <div className="admin-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal admin-modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <h2>
            <span className="admin-modal-header-icon"><EventIcon /></span>
            {event ? 'Edit Event' : 'Add Event'}
          </h2>
          <button type="button" className="admin-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="admin-modal-body">
            {err && <div className="admin-error">{err}</div>}
            {!event && (
              <p className="admin-modal-lead">
                <strong>Quick add:</strong> name and dates are enough — a URL id is generated on save. Use “More options” for pricing and publishing,
                and open “Custom URL id” only if you need a fixed link.
              </p>
            )}

            <div className="admin-form-section">
              <div className="admin-form-section-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" /></svg>
                Basic info
              </div>
              <div className="admin-form-group">
                <label>Name *</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required placeholder="e.g. Tripoli Food Festival" />
              </div>
              <div className="admin-form-group">
                <label>Description</label>
                <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Short public description (you can expand later)…" rows={3} />
              </div>
              <div className="admin-form-group">
                <label>Category</label>
                <input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="Type or pick a tag below" />
                <div className="admin-chip-row" role="group" aria-label="Quick category tags">
                  {EVENT_CATEGORY_QUICK.map((c) => (
                    <button key={c} type="button" className="admin-chip-btn" onClick={() => setForm((f) => ({ ...f, category: c }))}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="admin-form-section">
              <div className="admin-form-section-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                Date & time
              </div>
              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label>Start date & time</label>
                  <input type="datetime-local" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
                </div>
                <div className="admin-form-group">
                  <label>End date & time</label>
                  <input type="datetime-local" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
                </div>
              </div>
            </div>

            <div className="admin-form-section">
              <div className="admin-form-section-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                Location & media
              </div>
              <AdminSinglePlacePicker
                value={form.placeId}
                onChange={(placeId) => setForm((f) => ({ ...f, placeId }))}
                onError={(msg) => setErr(msg)}
              />
              <div className="admin-row-actions" style={{ marginBottom: '1rem' }}>
                <button
                  type="button"
                  className="admin-btn admin-btn--secondary"
                  onClick={() => void applyLinkedPlace()}
                  disabled={placeLinkBusy || !(form.placeId || '').trim()}
                >
                  {placeLinkBusy ? 'Loading place…' : 'Use linked place for address & map pin'}
                </button>
              </div>
              <div className="admin-form-group">
                <label>Location label</label>
                <input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="Shown to visitors — e.g. Al-Mina Port, Tripoli" />
                <span className="admin-form-hint">Filled automatically when you use a linked place, or type your own.</span>
              </div>
              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label>Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={form.latitude}
                    onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
                    placeholder="34.4367"
                  />
                </div>
                <div className="admin-form-group">
                  <label>Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={form.longitude}
                    onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
                    placeholder="35.8497"
                  />
                </div>
              </div>
              <div className="admin-row-actions" style={{ marginBottom: '1rem' }}>
                <button type="button" className="admin-btn admin-btn--secondary" onClick={() => setMapPickerOpen(true)}>
                  Pick on map
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn--sm admin-btn--secondary"
                  onClick={() => setForm((f) => ({ ...f, latitude: '', longitude: '' }))}
                >
                  Clear map pin
                </button>
              </div>
              <AdminCoverImageField
                inputId="admin-event-cover-upload"
                value={form.image}
                onChange={(url) => setForm((f) => ({ ...f, image: url }))}
                onError={(msg) => setErr(msg)}
              />
            </div>

            <details className="admin-advanced-details">
              <summary>More options — organizer, pricing, status & venue</summary>
              <div className="admin-form-section" style={{ border: 'none', paddingBottom: 0 }}>
                <div className="admin-form-row">
                  <div className="admin-form-group">
                    <label>Organizer</label>
                    <input value={form.organizer} onChange={(e) => setForm((f) => ({ ...f, organizer: e.target.value }))} placeholder="e.g. Tripoli Municipality" />
                  </div>
                </div>
                <div className="admin-form-row">
                  <div className="admin-form-group">
                    <label>Price (number)</label>
                    <input type="number" step="0.01" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} placeholder="Leave empty if free" />
                  </div>
                  <div className="admin-form-group">
                    <label>Price display</label>
                    <input value={form.priceDisplay} onChange={(e) => setForm((f) => ({ ...f, priceDisplay: e.target.value }))} placeholder="e.g. Free, From $10, LL 50,000" />
                  </div>
                </div>
                <div className="admin-form-row">
                  <div className="admin-form-group">
                    <label>Status</label>
                    <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                      <option value="draft">Draft — not highlighted on the site</option>
                      <option value="active">Active</option>
                      <option value="published">Published</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
              </div>
            </details>

            {!event && (
              <details className="admin-advanced-details">
                <summary>Custom URL id (optional)</summary>
                <div className="admin-form-group" style={{ marginTop: '0.75rem' }}>
                  <label>Id slug</label>
                  <input value={form.id} onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))} placeholder="Leave blank to auto-generate from the name" />
                  <div className="admin-row-actions">
                    <button
                      type="button"
                      className="admin-btn admin-btn--sm admin-btn--secondary"
                      onClick={() => setForm((f) => ({ ...f, id: suggestPublicId('event', f.name) }))}
                    >
                      Suggest from title
                    </button>
                  </div>
                  <span className="admin-form-hint">Used in /event/your-id — only change if you need a fixed link</span>
                </div>
              </details>
            )}
          </div>
          <div className="admin-modal-footer">
            <button type="button" className="admin-btn admin-btn--secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="admin-btn admin-btn--primary" disabled={saving}>{saving ? 'Saving…' : 'Save Event'}</button>
          </div>
        </form>
        {mapPickerOpen && (
          <MapPicker
            lat={form.latitude}
            lng={form.longitude}
            onSelect={(lat, lng) => {
              setForm((f) => ({ ...f, latitude: String(lat), longitude: String(lng) }));
              setErr(null);
            }}
            onClose={() => setMapPickerOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

export default function AdminEvents() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [modalEvent, setModalEvent] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast] = useState(null);

  const fetchData = useCallback(() => {
    api.events.list()
      .then((r) => setData(r.events || []))
      .catch((err) => setError(err.message || 'Failed to load events'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.trim().toLowerCase();
    return data.filter((e) =>
      (e.name && e.name.toLowerCase().includes(q)) ||
      (e.location && e.location.toLowerCase().includes(q)) ||
      (e.category && e.category.toLowerCase().includes(q))
    );
  }, [data, search]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.admin.events.delete(deleteTarget.id);
      setToast({ type: 'success', msg: 'Event deleted' });
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
          <p className="admin-subtitle">Manage events</p>
          <h1>Events</h1>
        </div>
        <div className="admin-page-header-actions">
          <div className="admin-search-wrap">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input type="search" placeholder="Search events…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button type="button" className="admin-btn admin-btn--primary" onClick={() => setModalEvent({})}>+ Add Event</button>
        </div>
      </div>
      {error && <div className="admin-error">{error}</div>}
      <div className="admin-widgets admin-dashboard-grid" style={{ gridTemplateColumns: 'repeat(12, 1fr)' }}>
        <div className="admin-card" style={{ gridColumn: 'span 3' }}>
          <div className="admin-card-body">
            <div className="admin-stat-value">{loading ? '—' : filtered.length}</div>
            <div className="admin-stat-label">Events{search.trim() ? ' (filtered)' : ''}</div>
          </div>
        </div>
        <div className="admin-card" style={{ gridColumn: 'span 9' }}>
          <div className="admin-card-header">
            <h2 className="admin-card-title">All Events</h2>
            <div className="admin-card-header-actions">
              <button type="button" className="admin-btn admin-btn--sm admin-btn--primary" onClick={() => setModalEvent({})}>+ Add</button>
            </div>
          </div>
          <div className="admin-card-body" style={{ padding: 0 }}>
            {loading && <div className="admin-loading">Loading events…</div>}
            {!loading && filtered.length === 0 && <div className="admin-empty">No events found.</div>}
            {!loading && filtered.length > 0 && (
              <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Start</th>
                <th>End</th>
                <th>Location</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id}>
                  <td>{e.name || '—'}</td>
                  <td>{formatDate(e.startDate)}</td>
                  <td>{formatDate(e.endDate)}</td>
                  <td>{(e.location || '').slice(0, 30)}{(e.location || '').length > 30 ? '…' : ''}</td>
                  <td>
                    <span className={`admin-badge admin-badge--${e.status === 'published' ? 'green' : 'gray'}`}>
                      {e.status || '—'}
                    </span>
                  </td>
                  <td>
                    <div className="admin-table-actions">
                      <Link to={`/event/${e.id}`} target="_blank" rel="noopener noreferrer">View</Link>
                      <button type="button" className="admin-btn admin-btn--sm admin-btn--secondary" onClick={() => setModalEvent(e)}>Edit</button>
                      <button type="button" className="admin-btn admin-btn--sm admin-btn--danger" onClick={() => setDeleteTarget(e)}>Delete</button>
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

      {modalEvent !== null && (
        <EventFormModal
          event={modalEvent && Object.keys(modalEvent).length ? modalEvent : null}
          onClose={() => setModalEvent(null)}
          onSaved={() => { setToast({ type: 'success', msg: 'Event saved' }); fetchData(); }}
        />
      )}

      {deleteTarget && (
        <div className="admin-confirm-backdrop" onClick={(e) => e.target === e.currentTarget && setDeleteTarget(null)}>
          <div className="admin-confirm" onClick={(e) => e.stopPropagation()}>
            <h3>Delete event?</h3>
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
