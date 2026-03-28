import { useState, useEffect, useMemo } from 'react';
import { 
  useCreateAdminCategoryMutation, 
  useUpdateAdminCategoryMutation, 
  useDeleteAdminCategoryMutation,
  useAdminCategories
} from '../../hooks/useAdmin';
import './Admin.css';

function CategoryFormModal({ category, onClose, onSaved }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const [form, setForm] = useState({ id: '', name: '', icon: '', description: '', count: '', color: '', tags: '' });
  
  const createMutation = useCreateAdminCategoryMutation();
  const updateMutation = useUpdateAdminCategoryMutation();

  const [err, setErr] = useState(null);

  useEffect(() => {
    if (category) {
      setForm({
        id: category.id || '',
        name: category.name || '',
        icon: category.icon || '',
        description: category.description || '',
        count: category.count ?? '',
        color: category.color || '#666666',
        tags: Array.isArray(category.tags) ? category.tags.join(', ') : '',
      });
    } else {
      setForm({ id: '', name: '', icon: 'fas fa-folder', description: '', count: '0', color: '#666666', tags: '' });
    }
  }, [category]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr(null);
    try {
      const tags = form.tags.trim() ? form.tags.split(/[,;]/).map((s) => s.trim()).filter(Boolean) : [];
      const payload = {
        id: form.id || undefined,
        name: form.name,
        icon: form.icon,
        description: form.description,
        count: form.count ? parseInt(form.count, 10) : 0,
        color: form.color,
        tags,
      };
      if (category) {
        await updateMutation.mutateAsync({ id: category.id, body: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      onSaved();
      onClose();
    } catch (e) {
      setErr(e.message || 'Failed to save');
    }
  };

  const CategoryIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
    </svg>
  );

  return (
    <div className="admin-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <h2>
            <span className="admin-modal-header-icon"><CategoryIcon /></span>
            {category ? 'Edit Category' : 'Add Category'}
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
              {!category && (
                <div className="admin-form-group">
                  <label>ID (slug)</label>
                  <input value={form.id} onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))} placeholder="e.g. food" />
                  <span className="admin-form-hint">Unique identifier used in URLs</span>
                </div>
              )}
              <div className="admin-form-group">
                <label>Name *</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required placeholder="e.g. Food & Dining" />
              </div>
              <div className="admin-form-group">
                <label>Icon (Font Awesome class)</label>
                <input value={form.icon} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))} placeholder="fas fa-utensils" />
                <span className="admin-form-hint">e.g. fas fa-utensils, fas fa-landmark</span>
              </div>
              <div className="admin-form-group">
                <label>Description</label>
                <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Brief description of this category…" rows={2} />
              </div>
            </div>

            <div className="admin-form-section">
              <div className="admin-form-section-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                Display & count
              </div>
              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label>Place count</label>
                  <input type="number" value={form.count} onChange={(e) => setForm((f) => ({ ...f, count: e.target.value }))} placeholder="0" />
                  <span className="admin-form-hint">Number of places in this category</span>
                </div>
                <div className="admin-form-group">
                  <label>Color</label>
                  <div className="admin-form-color-wrap">
                    <input type="color" value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} className="admin-form-color-picker" />
                    <input value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} className="admin-form-color-input" />
                  </div>
                  <span className="admin-form-hint">Used for badges and progress bars</span>
                </div>
              </div>
            </div>

            <div className="admin-form-section">
              <div className="admin-form-section-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /></svg>
                Tags
              </div>
              <div className="admin-form-group">
                <label>Tags (comma-separated)</label>
                <input value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} placeholder="food, restaurant, dining, cafe" />
              </div>
            </div>
          </div>
          <div className="admin-modal-footer">
            <button type="button" className="admin-btn admin-btn--secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="admin-btn admin-btn--primary" disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? 'Saving…' : 'Save Category'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminCategories() {
  const [search, setSearch] = useState('');
  const [modalCategory, setModalCategory] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast] = useState(null);

  const { data: categoriesRes, isLoading: loading, error } = useAdminCategories();
  const categoriesData = categoriesRes?.categories || [];
  const deleteMutation = useDeleteAdminCategoryMutation();

  const filtered = useMemo(() => {
    if (!search.trim()) return categoriesData;
    const q = search.trim().toLowerCase();
    return categoriesData.filter((c) =>
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.description && c.description.toLowerCase().includes(q))
    );
  }, [categoriesData, search]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      setToast({ type: 'success', msg: 'Category deleted' });
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
          <p className="admin-subtitle">Manage content categories</p>
          <h1>Categories</h1>
        </div>
        <div className="admin-page-header-actions">
          <div className="admin-search-wrap">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input type="search" placeholder="Search categories…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button type="button" className="admin-btn admin-btn--primary" onClick={() => setModalCategory({})}>+ Add Category</button>
        </div>
      </div>
      {error && <div className="admin-error">{error.message || 'Failed to load categories'}</div>}
      <div className="admin-widgets admin-dashboard-grid" style={{ gridTemplateColumns: 'repeat(12, 1fr)' }}>
        <div className="admin-card" style={{ gridColumn: 'span 3' }}>
          <div className="admin-card-body">
            <div className="admin-stat-value">{loading ? '—' : filtered.length}</div>
            <div className="admin-stat-label">Categories{search.trim() ? ' (filtered)' : ''}</div>
          </div>
        </div>
        <div className="admin-card" style={{ gridColumn: 'span 9' }}>
          <div className="admin-card-header">
            <h2 className="admin-card-title">All Categories</h2>
            <div className="admin-card-header-actions">
              <button type="button" className="admin-btn admin-btn--sm admin-btn--primary" onClick={() => setModalCategory({})}>+ Add</button>
            </div>
          </div>
          <div className="admin-card-body" style={{ padding: 0 }}>
            {loading && <div className="admin-loading">Loading categories…</div>}
            {!loading && filtered.length === 0 && <div className="admin-empty">No categories found.</div>}
            {!loading && filtered.length > 0 && (
              <table className="admin-table">
            <thead>
              <tr><th>Name</th><th>Description</th><th>Count</th><th>Color</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td>{c.name || '—'}</td>
                  <td>{(c.description || '').slice(0, 50)}{(c.description || '').length > 50 ? '…' : ''}</td>
                  <td>{c.count != null ? c.count : '—'}</td>
                  <td><span style={{ display: 'inline-block', width: 16, height: 16, borderRadius: 4, backgroundColor: c.color || '#999' }} title={c.color} /></td>
                  <td>
                    <div className="admin-table-actions">
                      <button type="button" className="admin-btn admin-btn--sm admin-btn--secondary" onClick={() => setModalCategory(c)}>Edit</button>
                      <button type="button" className="admin-btn admin-btn--sm admin-btn--danger" onClick={() => setDeleteTarget(c)}>Delete</button>
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

      {modalCategory !== null && (
        <CategoryFormModal
          category={modalCategory && Object.keys(modalCategory).length ? modalCategory : null}
          onClose={() => setModalCategory(null)}
          onSaved={() => { setToast({ type: 'success', msg: 'Category saved' }); }}
        />
      )}

      {deleteTarget && (
        <div className="admin-confirm-backdrop" onClick={(e) => e.target === e.currentTarget && setDeleteTarget(null)}>
          <div className="admin-confirm" onClick={(e) => e.stopPropagation()}>
            <h3>Delete category?</h3>
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
