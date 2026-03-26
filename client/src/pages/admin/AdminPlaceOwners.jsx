import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../api/client';
import './Admin.css';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function useDebounced(value, ms) {
  const [d, setD] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setD(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return d;
}

/** Searchable dropdown: type to find a user or place; selection stores canonical id. */
function SearchPicker({
  label,
  hint,
  placeholder,
  valueLabel,
  onInputChange,
  onOpenChange,
  open,
  results,
  loading,
  onPick,
  renderRow,
  emptyText,
  wrapRef,
}) {
  return (
    <div className="admin-form-group admin-search-pick" ref={wrapRef}>
      <label>{label}</label>
      {hint && <p className="admin-search-pick__hint">{hint}</p>}
      <input
        type="search"
        autoComplete="off"
        placeholder={placeholder}
        value={valueLabel}
        onChange={(e) => onInputChange(e.target.value)}
        onFocus={() => onOpenChange(true)}
      />
      {open && (valueLabel.trim().length > 0 || loading) && (
        <div className="admin-search-pick__list" role="listbox">
          {loading && <div className="admin-search-pick__status">Searching…</div>}
          {!loading && results.length === 0 && <div className="admin-search-pick__status">{emptyText}</div>}
          {!loading &&
            results.map((r, i) => (
              <button
                key={r.key ?? i}
                type="button"
                role="option"
                className="admin-search-pick__item"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onPick(r);
                }}
              >
                {renderRow(r)}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

export default function AdminPlaceOwners() {
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');

  const [userQuery, setUserQuery] = useState('');
  const debouncedUserQ = useDebounced(userQuery, 350);
  const [userResults, setUserResults] = useState([]);
  const [userLoading, setUserLoading] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  const [placeQuery, setPlaceQuery] = useState('');
  const debouncedPlaceQ = useDebounced(placeQuery, 350);
  const [placeResults, setPlaceResults] = useState([]);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState(null);

  const [advanced, setAdvanced] = useState(false);
  const [rawUserId, setRawUserId] = useState('');
  const [rawPlaceId, setRawPlaceId] = useState('');

  const userWrapRef = useRef(null);
  const placeWrapRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    function onDoc(e) {
      if (userWrapRef.current && !userWrapRef.current.contains(e.target)) setUserOpen(false);
      if (placeWrapRef.current && !placeWrapRef.current.contains(e.target)) setPlaceOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (advanced) return;
    const q = debouncedUserQ.trim();
    if (q.length < 1) {
      setUserResults([]);
      setUserLoading(false);
      return;
    }
    let cancelled = false;
    setUserLoading(true);
    api.admin.users
      .list({ q, limit: 25 })
      .then((r) => {
        if (cancelled) return;
        const list = (r.users || []).filter((u) => !u.isBlocked);
        setUserResults(list.map((u) => ({ key: u.id, ...u })));
      })
      .catch(() => {
        if (!cancelled) setUserResults([]);
      })
      .finally(() => {
        if (!cancelled) setUserLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedUserQ, advanced]);

  useEffect(() => {
    if (advanced) return;
    const q = debouncedPlaceQ.trim();
    if (q.length < 1) {
      setPlaceResults([]);
      setPlaceLoading(false);
      return;
    }
    let cancelled = false;
    setPlaceLoading(true);
    api.admin.places
      .list({ q, limit: 50 })
      .then((r) => {
        if (cancelled) return;
        setPlaceResults((r.places || []).map((p) => ({ key: p.id, ...p })));
      })
      .catch(() => {
        if (!cancelled) setPlaceResults([]);
      })
      .finally(() => {
        if (!cancelled) setPlaceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedPlaceQ, advanced]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = {};
    if (debouncedQ) params.q = debouncedQ;
    api.admin.placeOwners
      .list(params)
      .then((r) => setOwners(r.owners || []))
      .catch((err) => setError(err.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [debouncedQ]);

  useEffect(() => {
    load();
  }, [load]);

  const onUserInput = (v) => {
    setUserQuery(v);
    setSelectedUser(null);
    setUserOpen(true);
  };

  const onPlaceInput = (v) => {
    setPlaceQuery(v);
    setSelectedPlace(null);
    setPlaceOpen(true);
  };

  const pickUser = (u) => {
    setSelectedUser(u);
    setUserQuery(`${u.name || '—'} · ${u.email}`);
    setUserOpen(false);
  };

  const pickPlace = (p) => {
    setSelectedPlace(p);
    setPlaceQuery(`${p.name} (${p.id})`);
    setPlaceOpen(false);
  };

  const canSubmit = () => {
    if (advanced) {
      const uid = rawUserId.trim();
      const pid = rawPlaceId.trim();
      return UUID_RE.test(uid) && pid.length > 0 && pid.length <= 50;
    }
    return !!(selectedUser?.id && selectedPlace?.id);
  };

  const add = async (e) => {
    e.preventDefault();
    if (!canSubmit()) return;
    setSaving(true);
    setError(null);
    const userId = advanced ? rawUserId.trim() : selectedUser.id;
    const placeId = advanced ? rawPlaceId.trim() : selectedPlace.id;
    try {
      await api.admin.placeOwners.add({ userId, placeId });
      setUserQuery('');
      setPlaceQuery('');
      setSelectedUser(null);
      setSelectedPlace(null);
      setRawUserId('');
      setRawPlaceId('');
      load();
    } catch (err) {
      setError(err.message || 'Failed to add');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (user_id, place_id) => {
    if (!window.confirm('Remove this ownership link?')) return;
    try {
      await api.admin.placeOwners.remove(user_id, place_id);
      load();
    } catch (err) {
      setError(err.message || 'Failed to remove');
    }
  };

  return (
    <div className="admin-page-content">
      <div className="admin-page-header">
        <div className="admin-page-title-wrap">
          <p className="admin-subtitle">Link business users to places (same as mobile app)</p>
          <h1>Place owners</h1>
        </div>
      </div>
      {error && <div className="admin-error">{error}</div>}

      <div className="admin-card" style={{ marginBottom: '1.5rem' }}>
        <div className="admin-card-header">
          <h2 className="admin-card-title">Add owner</h2>
        </div>
        <form onSubmit={add} className="admin-card-body">
          {!advanced ? (
            <div className="admin-form-row">
              <SearchPicker
                label="User"
                hint="Search by name or email. Blocked accounts are not listed."
                placeholder="Start typing a name or email…"
                valueLabel={userQuery}
                onInputChange={onUserInput}
                onOpenChange={setUserOpen}
                open={userOpen}
                results={userResults}
                loading={userLoading}
                wrapRef={userWrapRef}
                emptyText="No matches. Try another search."
                onPick={pickUser}
                renderRow={(u) => (
                  <>
                    <span className="admin-search-pick__title">{u.name || '—'}</span>
                    <span className="admin-search-pick__meta">{u.email}</span>
                  </>
                )}
              />
              <SearchPicker
                label="Place"
                hint="Search by place name, id, or area."
                placeholder="Start typing a place name or id…"
                valueLabel={placeQuery}
                onInputChange={onPlaceInput}
                onOpenChange={setPlaceOpen}
                open={placeOpen}
                results={placeResults}
                loading={placeLoading}
                wrapRef={placeWrapRef}
                emptyText="No matches. Try another search."
                onPick={pickPlace}
                renderRow={(p) => (
                  <>
                    <span className="admin-search-pick__title">{p.name}</span>
                    <span className="admin-search-pick__meta">{p.id}</span>
                    {p.location ? <span className="admin-search-pick__sub">{p.location}</span> : null}
                  </>
                )}
              />
            </div>
          ) : (
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label htmlFor="po-raw-user">User ID (UUID)</label>
                <input
                  id="po-raw-user"
                  value={rawUserId}
                  onChange={(e) => setRawUserId(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  autoComplete="off"
                />
              </div>
              <div className="admin-form-group">
                <label htmlFor="po-raw-place">Place ID</label>
                <input
                  id="po-raw-place"
                  value={rawPlaceId}
                  onChange={(e) => setRawPlaceId(e.target.value)}
                  placeholder="e.g. hallab_sweets"
                  autoComplete="off"
                />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginTop: '0.5rem' }}>
            <button type="submit" className="admin-btn admin-btn--primary" disabled={saving || !canSubmit()}>
              {saving ? 'Adding…' : 'Add link'}
            </button>
            <label className="admin-search-pick__advanced-toggle">
              <input
                type="checkbox"
                checked={advanced}
                onChange={(e) => {
                  setAdvanced(e.target.checked);
                  setError(null);
                  setUserQuery('');
                  setPlaceQuery('');
                  setSelectedUser(null);
                  setSelectedPlace(null);
                }}
              />
              <span>Enter raw IDs (advanced)</span>
            </label>
          </div>
          <p className="admin-search-pick__secure-note">
            Links are checked on the server: user and place must exist, the user must not be blocked, and duplicate links are
            rejected.
          </p>
        </form>
      </div>

      <div className="admin-card admin-toolbar-card" style={{ marginBottom: '1rem' }}>
        <div className="admin-card-body" style={{ padding: '1rem 1.25rem' }}>
          <div className="admin-admin-filters">
            <div className="admin-form-group" style={{ flex: '1 1 280px', minWidth: 200, marginBottom: 0 }}>
              <label htmlFor="po-search">Search place, user ID, or email</label>
              <input
                id="po-search"
                type="search"
                placeholder="Filter links…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="admin-toolbar-actions">
              <button type="button" className="admin-btn admin-btn--secondary" onClick={load} disabled={loading}>
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-card-title">
            Links ({owners.length}
            {debouncedQ ? ` matching “${debouncedQ}”` : ''})
          </h2>
        </div>
        <div className="admin-card-body" style={{ padding: 0 }}>
          {loading && owners.length === 0 && <div className="admin-loading" style={{ padding: '1.5rem' }}>Loading…</div>}
          {!loading && owners.length === 0 && <div className="admin-empty">No place owners match your search.</div>}
          {!loading && owners.length > 0 && (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Place</th>
                  <th>User</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {owners.map((o) => (
                  <tr key={`${o.user_id}-${o.place_id}`}>
                    <td>
                      <strong>{o.place_id}</strong>
                    </td>
                    <td style={{ fontSize: '0.8rem', wordBreak: 'break-all' }}>{o.user_id}</td>
                    <td>{o.user_name || '—'}</td>
                    <td>{o.email}</td>
                    <td>
                      <button
                        type="button"
                        className="admin-btn admin-btn--sm admin-btn--danger"
                        onClick={() => remove(o.user_id, o.place_id)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
