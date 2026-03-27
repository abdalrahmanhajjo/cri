import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  useCreateAdminExperienceMutation, 
  useUpdateAdminExperienceMutation, 
  useDeleteAdminExperienceMutation,
  useAdminExperiences
} from '../../hooks/useAdmin';
import './Admin.css';

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
  });

  const createMutation = useCreateAdminExperienceMutation();
  const updateMutation = useUpdateAdminExperienceMutation();

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
      });
    } else {
      setForm({
        id: '', name: '', duration: '', durationHours: '0', locations: '0', rating: '0', reviews: '0',
        price: '0', currency: 'USD', priceDisplay: '', badge: '', badgeColor: '', description: '', image: '',
        difficulty: 'Easy', placeIds: '',
      });
    }
  }, [tour]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr(null);
    try {
      const placeIds = form.placeIds.trim() ? form.placeIds.split(/[,;]/).map((s) => s.trim()).filter(Boolean) : [];
      const payload = {
        id: form.id || undefined,
        name: form.name,
        duration: form.duration,
        durationHours: parseInt(form.durationHours, 10) || 0,
        locations: parseInt(form.locations, 10) || 0,
        rating: parseFloat(form.rating) || 0,
        reviews: parseInt(form.reviews, 10) || 0,
        price: parseFloat(form.price) || 0,
        currency: form.currency,
        priceDisplay: form.priceDisplay,
        badge: form.badge || null,
        badgeColor: form.badgeColor || null,
        description: form.description,
        image: form.image || 'https://via.placeholder.com/400',
        difficulty: form.difficulty,
        placeIds,
      };
      if (tour) {
        await updateMutation.mutateAsync({ id: tour.id, body: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      onSaved();
      onClose();
    } catch (e) {
      setErr(e.message || 'Failed to save');
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

            <div className="admin-form-section">
              <div className="admin-form-section-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" /></svg>
                Basic info
              </div>
              {!tour && (
                <div className="admin-form-group">
                  <label>ID (slug)</label>
                  <input value={form.id} onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))} placeholder="e.g. tour_food" />
                  <span className="admin-form-hint">Unique identifier used in URLs</span>
                </div>
              )}
              <div className="admin-form-group">
                <label>Name *</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required placeholder="e.g. Food Tour of Tripoli" />
              </div>
              <div className="admin-form-group">
                <label>Description</label>
                <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Describe the experience…" rows={3} />
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
                  <input value={form.duration} onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))} placeholder="4-5 hours" />
                </div>
                <div className="admin-form-group">
                  <label>Duration (hours)</label>
                  <input type="number" value={form.durationHours} onChange={(e) => setForm((f) => ({ ...f, durationHours: e.target.value }))} placeholder="4" />
                </div>
              </div>
              <div className="admin-form-group">
                <label>Difficulty</label>
                <input value={form.difficulty} onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value }))} placeholder="Easy, Moderate, or Challenging" />
              </div>
            </div>

            <div className="admin-form-section">
              <div className="admin-form-section-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                Price & availability
              </div>
              <div className="admin-form-row admin-form-row--3">
                <div className="admin-form-group">
                  <label>Price</label>
                  <input type="number" step="0.01" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} placeholder="25" />
                </div>
                <div className="admin-form-group">
                  <label>Currency</label>
                  <input value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} placeholder="USD" />
                </div>
                <div className="admin-form-group">
                  <label>Price display</label>
                  <input value={form.priceDisplay} onChange={(e) => setForm((f) => ({ ...f, priceDisplay: e.target.value }))} placeholder="$25" />
                </div>
              </div>
            </div>

            <div className="admin-form-section">
              <div className="admin-form-section-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                Ratings & badge
              </div>
              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label>Rating (0–5)</label>
                  <input type="number" step="0.1" value={form.rating} onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value }))} placeholder="4.5" />
                </div>
                <div className="admin-form-group">
                  <label>Review count</label>
                  <input type="number" value={form.reviews} onChange={(e) => setForm((f) => ({ ...f, reviews: e.target.value }))} placeholder="0" />
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
            </div>

            <div className="admin-form-section">
              <div className="admin-form-section-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>
                Media & places
              </div>
              {form.image && (
                <div className="admin-form-preview-wrap">
                  <img src={form.image} alt="Preview" className="admin-form-preview" onError={(e) => { e.target.style.display = 'none'; }} />
                </div>
              )}
              <div className="admin-form-group">
                <label>Cover image URL</label>
                <input value={form.image} onChange={(e) => setForm((f) => ({ ...f, image: e.target.value }))} placeholder="https://..." />
              </div>
              <div className="admin-form-group">
                <label>Locations count</label>
                <input type="number" value={form.locations} onChange={(e) => setForm((f) => ({ ...f, locations: e.target.value }))} placeholder="e.g. 5" />
              </div>
              <div className="admin-form-group">
                <label>Place IDs (comma-separated)</label>
                <input value={form.placeIds} onChange={(e) => setForm((f) => ({ ...f, placeIds: e.target.value }))} placeholder="hallab_sweets, clock_tower, souk" />
                <span className="admin-form-hint">Places included in this experience</span>
              </div>
            </div>
          </div>
          <div className="admin-modal-footer">
            <button type="button" className="admin-btn admin-btn--secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="admin-btn admin-btn--primary" disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? 'Saving…' : 'Save Experience'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminExperiences() {
  const [search, setSearch] = useState('');
  const [modalTour, setModalTour] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast] = useState(null);

  const { data: experiencesRes, isLoading: loading, error } = useAdminExperiences();
  const data = experiencesRes?.featured || [];

  const deleteMutation = useDeleteAdminExperienceMutation();

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
      await deleteMutation.mutateAsync(deleteTarget.id);
      setToast({ type: 'success', msg: 'Experience deleted' });
      setDeleteTarget(null);
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
      {error && <div className="admin-error">{error.message || 'Failed to load experiences'}</div>}
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
          onSaved={() => { setToast({ type: 'success', msg: 'Experience saved' }); }}
        />
      )}

      {deleteTarget && (
        <div className="admin-confirm-backdrop" onClick={(e) => e.target === e.currentTarget && setDeleteTarget(null)}>
          <div className="admin-confirm" onClick={(e) => e.stopPropagation()}>
            <h3>Delete experience?</h3>
            <p>This will permanently delete &quot;{deleteTarget.name}&quot;. This cannot be undone.</p>
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
