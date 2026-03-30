import { useEffect, useMemo, useState } from 'react';
import api from '../../api/client';
import './Admin.css';

function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 16);
}

function fromLocalInput(v) {
  const s = String(v || '').trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function SurfacePill({ value, onChange }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="all">All surfaces</option>
      <option value="home">Home</option>
      <option value="discover">Discover</option>
      <option value="feed">Feed</option>
    </select>
  );
}

export default function AdminSponsoredPlaces() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const [pickerQ, setPickerQ] = useState('');
  const [pickerResults, setPickerResults] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);

  const [draft, setDraft] = useState(() => ({
    placeId: '',
    surface: 'all',
    rank: 0,
    enabled: true,
    startsAt: '',
    endsAt: '',
    badgeText: '',
    titleOverride: '',
    subtitleOverride: '',
    imageOverrideUrl: '',
    ctaUrl: '',
  }));

  const load = () => {
    setLoading(true);
    setErr(null);
    api.admin.sponsoredPlaces
      .list()
      .then((r) => setItems(Array.isArray(r.items) ? r.items : []))
      .catch((e) => setErr(e?.message || 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sorted = useMemo(() => {
    const list = Array.isArray(items) ? items : [];
    return list.slice().sort((a, b) => (Number(a.rank) || 0) - (Number(b.rank) || 0));
  }, [items]);

  useEffect(() => {
    const q = pickerQ.trim();
    if (!q) {
      setPickerResults([]);
      return undefined;
    }
    let cancelled = false;
    setPickerLoading(true);
    api.admin.places
      .list({ q, limit: 20 })
      .then((r) => {
        if (cancelled) return;
        setPickerResults(Array.isArray(r.places) ? r.places : []);
      })
      .catch(() => {
        if (!cancelled) setPickerResults([]);
      })
      .finally(() => {
        if (!cancelled) setPickerLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pickerQ]);

  const createOrUpsert = async () => {
    setErr(null);
    const body = {
      placeId: draft.placeId.trim(),
      surface: draft.surface,
      rank: Number(draft.rank) || 0,
      enabled: draft.enabled,
      startsAt: fromLocalInput(draft.startsAt),
      endsAt: fromLocalInput(draft.endsAt),
      badgeText: draft.badgeText.trim() || null,
      titleOverride: draft.titleOverride.trim() || null,
      subtitleOverride: draft.subtitleOverride.trim() || null,
      imageOverrideUrl: draft.imageOverrideUrl.trim() || null,
      ctaUrl: draft.ctaUrl.trim() || null,
    };
    if (!body.placeId) {
      setErr('Pick a place first.');
      return;
    }
    try {
      await api.admin.sponsoredPlaces.create(body);
      setDraft((d) => ({ ...d, placeId: '' }));
      load();
    } catch (e) {
      setErr(e?.message || 'Failed to create');
    }
  };

  const patch = async (id, patchBody) => {
    setErr(null);
    try {
      await api.admin.sponsoredPlaces.update(id, patchBody);
      load();
    } catch (e) {
      setErr(e?.message || 'Failed to update');
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this sponsored placement?')) return;
    setErr(null);
    try {
      await api.admin.sponsoredPlaces.delete(id);
      load();
    } catch (e) {
      setErr(e?.message || 'Failed to delete');
    }
  };

  return (
    <div className="admin-page-content">
      <div className="admin-page-header">
        <div className="admin-page-title-wrap">
          <p className="admin-subtitle">Curate sponsored places that appear across the public site.</p>
          <h1>Sponsored places</h1>
        </div>
        <div className="admin-page-actions">
          <button type="button" className="admin-btn admin-btn--secondary" onClick={load} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      {err ? <div className="admin-error">{err}</div> : null}

      <div className="admin-card" style={{ marginBottom: '1rem' }}>
        <div className="admin-card-header">
          <h2 className="admin-card-title">Add / upsert placement</h2>
        </div>
        <div className="admin-card-body">
          <div className="admin-form-row">
            <div className="admin-form-group" style={{ flex: 2 }}>
              <label>Search place</label>
              <input value={pickerQ} onChange={(e) => setPickerQ(e.target.value)} placeholder="Type to search places…" />
              <span className="admin-form-hint">{pickerLoading ? 'Searching…' : 'Pick a place from results.'}</span>
              {pickerResults.length > 0 ? (
                <div className="admin-list" style={{ marginTop: '0.5rem' }}>
                  {pickerResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="admin-list-item"
                      onClick={() => {
                        setDraft((d) => ({ ...d, placeId: String(p.id) }));
                        setPickerQ(`${p.name || p.id}`);
                        setPickerResults([]);
                      }}
                    >
                      <strong>{p.name || p.id}</strong>
                      <span style={{ opacity: 0.7, fontSize: '0.9rem' }}>{p.location || ''}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="admin-form-group">
              <label>Surface</label>
              <SurfacePill value={draft.surface} onChange={(surface) => setDraft((d) => ({ ...d, surface }))} />
            </div>
            <div className="admin-form-group">
              <label>Rank</label>
              <input
                type="number"
                value={draft.rank}
                onChange={(e) => setDraft((d) => ({ ...d, rank: e.target.value }))}
              />
            </div>
            <div className="admin-form-group" style={{ alignSelf: 'end' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))}
                />
                Enabled
              </label>
            </div>
          </div>

          <div className="admin-form-row">
            <div className="admin-form-group">
              <label>Starts at (optional)</label>
              <input
                type="datetime-local"
                value={draft.startsAt}
                onChange={(e) => setDraft((d) => ({ ...d, startsAt: e.target.value }))}
              />
            </div>
            <div className="admin-form-group">
              <label>Ends at (optional)</label>
              <input
                type="datetime-local"
                value={draft.endsAt}
                onChange={(e) => setDraft((d) => ({ ...d, endsAt: e.target.value }))}
              />
            </div>
            <div className="admin-form-group">
              <label>Badge text (optional)</label>
              <input value={draft.badgeText} onChange={(e) => setDraft((d) => ({ ...d, badgeText: e.target.value }))} />
            </div>
          </div>

          <div className="admin-form-row">
            <div className="admin-form-group">
              <label>Title override (optional)</label>
              <input value={draft.titleOverride} onChange={(e) => setDraft((d) => ({ ...d, titleOverride: e.target.value }))} />
            </div>
            <div className="admin-form-group">
              <label>Subtitle override (optional)</label>
              <input
                value={draft.subtitleOverride}
                onChange={(e) => setDraft((d) => ({ ...d, subtitleOverride: e.target.value }))}
              />
            </div>
          </div>

          <div className="admin-form-row">
            <div className="admin-form-group">
              <label>Image override URL (optional)</label>
              <input
                type="url"
                value={draft.imageOverrideUrl}
                onChange={(e) => setDraft((d) => ({ ...d, imageOverrideUrl: e.target.value }))}
                placeholder="https://… or /uploads/…"
              />
            </div>
            <div className="admin-form-group">
              <label>CTA URL (optional)</label>
              <input
                type="url"
                value={draft.ctaUrl}
                onChange={(e) => setDraft((d) => ({ ...d, ctaUrl: e.target.value }))}
                placeholder="https://…"
              />
            </div>
          </div>

          <div className="admin-modal-footer" style={{ borderTop: '1px solid #e5e7eb', marginTop: '1rem', paddingTop: '1rem' }}>
            <button type="button" className="admin-btn admin-btn--primary" onClick={createOrUpsert}>
              Save sponsored placement
            </button>
          </div>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-card-title">Current placements</h2>
        </div>
        <div className="admin-card-body">
          {loading ? <div className="admin-loading">Loading…</div> : null}
          {sorted.length === 0 && !loading ? <p style={{ margin: 0, opacity: 0.75 }}>No sponsored places yet.</p> : null}
          {sorted.length > 0 ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Place</th>
                    <th>Surface</th>
                    <th>Enabled</th>
                    <th>Schedule</th>
                    <th>Overrides</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((it) => {
                    const title = it?.titleOverride || it?.place?.name || it?.placeId;
                    const schedule = `${it.startsAt ? new Date(it.startsAt).toISOString().slice(0, 16) : '—'} → ${
                      it.endsAt ? new Date(it.endsAt).toISOString().slice(0, 16) : '—'
                    }`;
                    const overrides = [it.badgeText, it.subtitleOverride, it.imageOverrideUrl, it.ctaUrl].filter(Boolean).length;
                    return (
                      <tr key={it.id}>
                        <td style={{ width: 90 }}>
                          <input
                            type="number"
                            value={Number(it.rank) || 0}
                            onChange={(e) => patch(it.id, { rank: Number(e.target.value) || 0 })}
                            style={{ width: 80 }}
                          />
                        </td>
                        <td>
                          <div style={{ display: 'grid' }}>
                            <strong>{title}</strong>
                            <span style={{ opacity: 0.7, fontSize: '0.9rem' }}>
                              {it?.place?.location || it?.place?.category || ''}
                            </span>
                          </div>
                        </td>
                        <td style={{ width: 120 }}>
                          <SurfacePill value={it.surface || 'all'} onChange={(surface) => patch(it.id, { surface })} />
                        </td>
                        <td style={{ width: 110 }}>
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            <input
                              type="checkbox"
                              checked={it.enabled === true}
                              onChange={(e) => patch(it.id, { enabled: e.target.checked })}
                            />
                            {it.enabled === true ? 'On' : 'Off'}
                          </label>
                        </td>
                        <td style={{ width: 240 }}>
                          <div className="admin-form-row" style={{ gap: 8, flexWrap: 'wrap' }}>
                            <input
                              type="datetime-local"
                              value={toLocalInput(it.startsAt)}
                              onChange={(e) => patch(it.id, { startsAt: fromLocalInput(e.target.value) })}
                              style={{ width: 150 }}
                            />
                            <input
                              type="datetime-local"
                              value={toLocalInput(it.endsAt)}
                              onChange={(e) => patch(it.id, { endsAt: fromLocalInput(e.target.value) })}
                              style={{ width: 150 }}
                            />
                          </div>
                          <div style={{ opacity: 0.65, fontSize: '0.8rem', marginTop: 6 }}>{schedule}</div>
                        </td>
                        <td style={{ width: 140 }}>{overrides} fields</td>
                        <td style={{ textAlign: 'right', width: 120 }}>
                          <button type="button" className="admin-btn admin-btn--danger" onClick={() => remove(it.id)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

