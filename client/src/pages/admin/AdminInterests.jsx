import { 
  useCreateAdminInterestMutation, 
  useUpdateAdminInterestMutation, 
  useDeleteAdminInterestMutation,
  useAdminInterests
} from '../../hooks/useAdmin';
import './Admin.css';

function InterestModal({ interest, onClose, onSaved }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const [form, setForm] = useState({
    id: '', name: '', icon: 'place', description: '', color: '#666666', count: '0', popularity: '0', tags: '',
  });

  const createMutation = useCreateAdminInterestMutation();
  const updateMutation = useUpdateAdminInterestMutation();

  const [err, setErr] = useState(null);

  useEffect(() => {
    if (interest && interest.id) {
      setForm({
        id: interest.id,
        name: interest.name || '',
        icon: interest.icon || 'place',
        description: interest.description || '',
        color: interest.color || '#666666',
        count: String(interest.count ?? 0),
        popularity: String(interest.popularity ?? 0),
        tags: Array.isArray(interest.tags) ? interest.tags.join(', ') : '',
      });
    } else {
      setForm({ id: '', name: '', icon: 'place', description: '', color: '#666666', count: '0', popularity: '0', tags: '' });
    }
  }, [interest]);

  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    try {
      const tags = form.tags.trim() ? form.tags.split(/[,;]/).map((s) => s.trim()).filter(Boolean) : [];
      const payload = {
        id: form.id || undefined,
        name: form.name,
        icon: form.icon,
        description: form.description,
        color: form.color,
        count: parseInt(form.count, 10) || 0,
        popularity: parseInt(form.popularity, 10) || 0,
        tags,
      };
      if (interest?.id) {
        await updateMutation.mutateAsync({ id: interest.id, body: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      onSaved();
      onClose();
    } catch (ex) {
      setErr(ex.message || 'Failed to save');
    }
  };

  return (
    <div className="admin-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <h2>{interest?.id ? 'Edit interest' : 'Add interest'}</h2>
          <button type="button" className="admin-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <form onSubmit={submit}>
          <div className="admin-modal-body">
            {err && <div className="admin-error">{err}</div>}
            {!interest?.id && (
              <div className="admin-form-group">
                <label>ID (slug)</label>
                <input value={form.id} onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))} required />
              </div>
            )}
            <div className="admin-form-group">
              <label>Name *</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label>Icon</label>
                <input value={form.icon} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))} />
              </div>
              <div className="admin-form-group">
                <label>Color</label>
                <input type="color" value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} />
              </div>
            </div>
            <div className="admin-form-group">
              <label>Description</label>
              <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label>Count</label>
                <input type="number" value={form.count} onChange={(e) => setForm((f) => ({ ...f, count: e.target.value }))} />
              </div>
              <div className="admin-form-group">
                <label>Popularity</label>
                <input type="number" value={form.popularity} onChange={(e) => setForm((f) => ({ ...f, popularity: e.target.value }))} />
              </div>
            </div>
            <div className="admin-form-group">
              <label>Tags (comma-separated)</label>
              <input value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} />
            </div>
          </div>
          <div className="admin-modal-footer">
            <button type="button" className="admin-btn admin-btn--secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="admin-btn admin-btn--primary" disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminInterests() {
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data: interestsRes, isLoading: loading, error } = useAdminInterests();
  const data = interestsRes?.interests || interestsRes?.featured || [];
  const deleteMutation = useDeleteAdminInterestMutation();

  const filtered = useMemo(() => {
    const list = data || [];
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter((c) => (c.name && c.name.toLowerCase().includes(q)) || (c.id && c.id.toLowerCase().includes(q)));
  }, [data, search]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch (e) {
      console.error('Delete failed', e);
    }
  };

  return (
    <div className="admin-page-content">
      <div className="admin-page-header">
        <div className="admin-page-title-wrap">
          <p className="admin-subtitle">“Find your way” interests — shared DB with the app</p>
          <h1>Interests</h1>
        </div>
        <div className="admin-page-header-actions">
          <div className="admin-search-wrap">
            <input type="search" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button type="button" className="admin-btn admin-btn--primary" onClick={() => setModal({})}>+ Add interest</button>
        </div>
      </div>
      {error && <div className="admin-error">{error.message || 'Failed to load interests'}</div>}
      <div className="admin-card">
        <div className="admin-card-body" style={{ padding: 0 }}>
          {loading && <div className="admin-loading" style={{ padding: '1.5rem' }}>Loading…</div>}
          {!loading && filtered.length === 0 && <div className="admin-empty">No interests.</div>}
          {!loading && filtered.length > 0 && (
            <table className="admin-table">
              <thead>
                <tr><th>Name</th><th>ID</th><th>Popularity</th><th>Color</th><th /></tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td style={{ fontSize: '0.85rem' }}>{c.id}</td>
                    <td>{c.popularity ?? '—'}</td>
                    <td><span style={{ display: 'inline-block', width: 16, height: 16, borderRadius: 4, backgroundColor: c.color || '#999' }} /></td>
                    <td>
                      <button type="button" className="admin-btn admin-btn--sm admin-btn--secondary" onClick={() => setModal(c)}>Edit</button>
                      <button type="button" className="admin-btn admin-btn--sm admin-btn--danger" onClick={() => setDeleteTarget(c)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modal !== null && (
        <InterestModal
          interest={modal && modal.id ? modal : null}
          onClose={() => setModal(null)}
          onSaved={() => {}}
        />
      )}

      {deleteTarget && (
        <div className="admin-confirm-backdrop" onClick={(e) => e.target === e.currentTarget && setDeleteTarget(null)}>
          <div className="admin-confirm" onClick={(e) => e.stopPropagation()}>
            <h3>Delete interest?</h3>
            <p>Delete &quot;{deleteTarget.name}&quot;?</p>
            <div className="admin-confirm-actions">
              <button type="button" className="admin-btn admin-btn--secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button type="button" className="admin-btn admin-btn--danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
