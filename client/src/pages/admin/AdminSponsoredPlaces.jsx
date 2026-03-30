import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import './Admin.css';
import './AdminSponsoredPlaces.css';

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

function SurfacePill({ value, onChange, id, ariaLabel }) {
  return (
    <select
      id={id}
      className="asp-surface-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel || (id ? undefined : 'Surface')}
    >
      <option value="all">All surfaces</option>
      <option value="home">Home</option>
      <option value="discover">Discover</option>
      <option value="feed">Feed</option>
    </select>
  );
}

function SectionTitle({ children, icon }) {
  return (
    <div className="admin-form-section-title">
      {icon}
      {children}
    </div>
  );
}

export default function AdminSponsoredPlaces() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [savedOk, setSavedOk] = useState(false);
  const saveToastTimer = useRef(null);

  const [pickerQ, setPickerQ] = useState('');
  const [pickerResults, setPickerResults] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickedLabel, setPickedLabel] = useState('');

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

  const showSavedToast = () => {
    setSavedOk(true);
    if (saveToastTimer.current) window.clearTimeout(saveToastTimer.current);
    saveToastTimer.current = window.setTimeout(() => setSavedOk(false), 3200);
  };

  useEffect(
    () => () => {
      if (saveToastTimer.current) window.clearTimeout(saveToastTimer.current);
    },
    []
  );

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
      setPickedLabel('');
      setPickerQ('');
      setPickerResults([]);
      showSavedToast();
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
          <p className="admin-subtitle">
            Curate sponsored places that appear on the public site. Surface visibility can be narrowed per row or gated in{' '}
            <Link to="../settings?tab=features">Site settings → Features</Link>.
          </p>
          <h1>Sponsored places</h1>
        </div>
        <div className="admin-page-actions">
          <button type="button" className="admin-btn admin-btn--secondary" onClick={load} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      {err ? <div className="admin-error">{err}</div> : null}
      {savedOk ? (
        <div className="admin-toast admin-toast--success" style={{ position: 'relative', marginBottom: '1rem' }} role="status">
          Placement saved — list refreshed.
        </div>
      ) : null}

      <div className="admin-card asp-card--compose" style={{ marginBottom: '1rem' }}>
        <div className="admin-card-header">
          <h2 className="admin-card-title">New placement</h2>
          <p className="admin-form-hint" style={{ margin: '0.35rem 0 0', maxWidth: '44rem' }}>
            Search for a place, set where it runs (surface), optional schedule and creative overrides, then save. Lower rank numbers
            sort first.
          </p>
        </div>
        <div className="admin-card-body">
          <div className="admin-form-section">
            <SectionTitle
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              }
            >
              Place & targeting
            </SectionTitle>
            <div className="admin-form-group asp-place-search-wrap">
              <label htmlFor="asp-search-place">Search place</label>
              <input
                id="asp-search-place"
                value={pickerQ}
                onChange={(e) => setPickerQ(e.target.value)}
                placeholder="Type to search places…"
                autoComplete="off"
              />
              <span className="admin-form-hint">{pickerLoading ? 'Searching…' : 'Choose a place from the results below.'}</span>
              {pickerResults.length > 0 ? (
                <div className="admin-list asp-picker-results" role="listbox" aria-label="Place search results">
                  {pickerResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="admin-list-item"
                      role="option"
                      onClick={() => {
                        setDraft((d) => ({ ...d, placeId: String(p.id) }));
                        setPickedLabel(String(p.name || p.id));
                        setPickerQ('');
                        setPickerResults([]);
                      }}
                    >
                      <strong>{p.name || p.id}</strong>
                      <span style={{ opacity: 0.72, fontSize: '0.9rem' }}>{p.location || ''}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              {draft.placeId && pickedLabel ? (
                <div className="asp-selected-bar">
                  <strong>{pickedLabel}</strong>
                  <span className="asp-selected-id">ID {draft.placeId}</span>
                  <button
                    type="button"
                    className="asp-clear-place"
                    onClick={() => {
                      setDraft((d) => ({ ...d, placeId: '' }));
                      setPickedLabel('');
                    }}
                  >
                    Clear
                  </button>
                </div>
              ) : null}
            </div>
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label htmlFor="asp-surface-new">Surface</label>
                <SurfacePill id="asp-surface-new" value={draft.surface} onChange={(surface) => setDraft((d) => ({ ...d, surface }))} />
              </div>
              <div className="admin-form-group">
                <label htmlFor="asp-rank-new">Rank</label>
                <input
                  id="asp-rank-new"
                  type="number"
                  value={draft.rank}
                  onChange={(e) => setDraft((d) => ({ ...d, rank: e.target.value }))}
                />
              </div>
            </div>
            <div className="admin-form-group" style={{ marginBottom: 0 }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))}
                />
                Enabled (live immediately if within schedule and site toggles allow)
              </label>
            </div>
          </div>

          <div className="admin-form-section">
            <SectionTitle
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
              }
            >
              Schedule
            </SectionTitle>
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label htmlFor="asp-start-new">Starts at (optional)</label>
                <input
                  id="asp-start-new"
                  type="datetime-local"
                  value={draft.startsAt}
                  onChange={(e) => setDraft((d) => ({ ...d, startsAt: e.target.value }))}
                />
              </div>
              <div className="admin-form-group">
                <label htmlFor="asp-end-new">Ends at (optional)</label>
                <input
                  id="asp-end-new"
                  type="datetime-local"
                  value={draft.endsAt}
                  onChange={(e) => setDraft((d) => ({ ...d, endsAt: e.target.value }))}
                />
              </div>
              <div className="admin-form-group">
                <label htmlFor="asp-badge-new">Badge text (optional)</label>
                <input
                  id="asp-badge-new"
                  value={draft.badgeText}
                  onChange={(e) => setDraft((d) => ({ ...d, badgeText: e.target.value }))}
                  placeholder="e.g. Partner"
                />
              </div>
            </div>
          </div>

          <div className="admin-form-section">
            <SectionTitle
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
              }
            >
              Creative overrides
            </SectionTitle>
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label htmlFor="asp-title-new">Title override</label>
                <input
                  id="asp-title-new"
                  value={draft.titleOverride}
                  onChange={(e) => setDraft((d) => ({ ...d, titleOverride: e.target.value }))}
                />
              </div>
              <div className="admin-form-group">
                <label htmlFor="asp-sub-new">Subtitle override</label>
                <input
                  id="asp-sub-new"
                  value={draft.subtitleOverride}
                  onChange={(e) => setDraft((d) => ({ ...d, subtitleOverride: e.target.value }))}
                />
              </div>
            </div>
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label htmlFor="asp-img-new">Image override URL</label>
                <input
                  id="asp-img-new"
                  type="url"
                  value={draft.imageOverrideUrl}
                  onChange={(e) => setDraft((d) => ({ ...d, imageOverrideUrl: e.target.value }))}
                  placeholder="https://… or /uploads/…"
                />
              </div>
              <div className="admin-form-group">
                <label htmlFor="asp-cta-new">CTA URL</label>
                <input
                  id="asp-cta-new"
                  type="url"
                  value={draft.ctaUrl}
                  onChange={(e) => setDraft((d) => ({ ...d, ctaUrl: e.target.value }))}
                  placeholder="https://…"
                />
              </div>
            </div>
          </div>

          <div className="asp-footer-actions">
            <button type="button" className="admin-btn admin-btn--primary" onClick={createOrUpsert}>
              Save sponsored placement
            </button>
          </div>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-card-title">Current placements</h2>
          <span className="admin-form-hint" style={{ margin: '0.35rem 0 0' }}>
            Edits apply on blur / change. Delete removes the row permanently.
          </span>
        </div>
        <div className="admin-card-body">
          {loading ? <div className="admin-loading">Loading…</div> : null}
          {sorted.length === 0 && !loading ? (
            <p className="asp-empty-placements">
              <strong>No sponsored placements yet</strong>
              Add one above to surface a place on Home, Discover, and/or the community feed — subject to site feature toggles and each
              row’s schedule.
            </p>
          ) : null}
          {sorted.length > 0 ? (
            <div className="asp-table-wrap admin-table-wrap">
              <table className="admin-table asp-table">
                <thead>
                  <tr>
                    <th scope="col">Rank</th>
                    <th scope="col">Place</th>
                    <th scope="col">Surface</th>
                    <th scope="col">Enabled</th>
                    <th scope="col">Schedule</th>
                    <th scope="col">Overrides</th>
                    <th scope="col" className="admin-table-actions">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((it) => {
                    const title = it?.titleOverride || it?.place?.name || it?.placeId;
                    const schedule = `${it.startsAt ? new Date(it.startsAt).toISOString().slice(0, 16) : '—'} → ${
                      it.endsAt ? new Date(it.endsAt).toISOString().slice(0, 16) : '—'
                    }`;
                    const overrideCount = [
                      it.titleOverride,
                      it.badgeText,
                      it.subtitleOverride,
                      it.imageOverrideUrl,
                      it.ctaUrl,
                    ].filter(Boolean).length;
                    return (
                      <tr key={it.id}>
                        <td>
                          <input
                            type="number"
                            className="asp-rank-input"
                            value={Number(it.rank) || 0}
                            onChange={(e) => patch(it.id, { rank: Number(e.target.value) || 0 })}
                            aria-label={`Rank for ${title}`}
                          />
                        </td>
                        <td>
                          <div style={{ display: 'grid', gap: 2 }}>
                            <strong>{title}</strong>
                            <span style={{ opacity: 0.72, fontSize: '0.88rem' }}>
                              {it?.place?.location || it?.place?.category || ''}
                            </span>
                          </div>
                        </td>
                        <td>
                          <SurfacePill
                            value={it.surface || 'all'}
                            onChange={(surface) => patch(it.id, { surface })}
                            ariaLabel={`Surface for ${title}`}
                          />
                        </td>
                        <td>
                          <label className="asp-status">
                            <input
                              type="checkbox"
                              checked={it.enabled === true}
                              onChange={(e) => patch(it.id, { enabled: e.target.checked })}
                            />
                            <span className={`asp-status-label${it.enabled === true ? ' asp-status-label--on' : ''}`}>
                              {it.enabled === true ? 'On' : 'Off'}
                            </span>
                          </label>
                        </td>
                        <td>
                          <div className="admin-form-row" style={{ gap: 8, flexWrap: 'wrap', margin: 0 }}>
                            <input
                              type="datetime-local"
                              className="asp-schedule-input"
                              value={toLocalInput(it.startsAt)}
                              onChange={(e) => patch(it.id, { startsAt: fromLocalInput(e.target.value) })}
                              aria-label={`Start for ${title}`}
                            />
                            <input
                              type="datetime-local"
                              className="asp-schedule-input"
                              value={toLocalInput(it.endsAt)}
                              onChange={(e) => patch(it.id, { endsAt: fromLocalInput(e.target.value) })}
                              aria-label={`End for ${title}`}
                            />
                          </div>
                          <div className="asp-schedule-hint">{schedule}</div>
                        </td>
                        <td>
                          <span
                            className={`asp-overrides-badge${overrideCount > 0 ? ' asp-overrides-badge--has' : ''}`}
                            title="Count of optional fields set"
                          >
                            {overrideCount}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
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
