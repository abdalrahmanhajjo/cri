import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useSiteSettings } from '../../context/SiteSettingsContext';
import './Admin.css';

function buildUserListParams(debouncedQ, provider, isAdmin, isBusinessOwner, emailVerified, blocked) {
  const p = { limit: 200, offset: 0 };
  if (debouncedQ) p.q = debouncedQ;
  if (provider && provider !== 'all') p.provider = provider;
  if (isAdmin && isAdmin !== 'all') p.isAdmin = isAdmin;
  if (isBusinessOwner && isBusinessOwner !== 'all') p.isBusinessOwner = isBusinessOwner;
  if (emailVerified && emailVerified !== 'all') p.emailVerified = emailVerified;
  if (blocked && blocked !== 'all') p.isBlocked = blocked;
  return p;
}

export default function AdminUsers() {
  const { user: me } = useAuth();
  const { settings } = useSiteSettings();
  const myId = me?.id;
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingId, setSavingId] = useState(null);

  const [searchInput, setSearchInput] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [provider, setProvider] = useState('all');
  const [filterAdmin, setFilterAdmin] = useState('all');
  const [filterBusiness, setFilterBusiness] = useState('all');
  const [filterVerified, setFilterVerified] = useState('all');
  const [filterBlocked, setFilterBlocked] = useState('all');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const listParams = useMemo(
    () => buildUserListParams(debouncedQ, provider, filterAdmin, filterBusiness, filterVerified, filterBlocked),
    [debouncedQ, provider, filterAdmin, filterBusiness, filterVerified, filterBlocked]
  );

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.admin.users
      .list(listParams)
      .then((r) => {
        setUsers(r.users || []);
        setTotal(r.total ?? 0);
      })
      .catch((err) => setError(err.message || 'Failed to load users'))
      .finally(() => setLoading(false));
  }, [listParams]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (u, field) => {
    setSavingId(u.id);
    setError(null);
    try {
      const body =
        field === 'isAdmin'
          ? { isAdmin: !u.isAdmin }
          : field === 'isBusinessOwner'
            ? { isBusinessOwner: !u.isBusinessOwner }
            : { isBlocked: !u.isBlocked };
      await api.admin.users.update(u.id, body);
      setUsers((list) => list.map((x) => (x.id === u.id ? { ...x, ...body } : x)));
    } catch (err) {
      setError(err.message || 'Update failed');
    } finally {
      setSavingId(null);
    }
  };

  const removeUser = async (u) => {
    if (!window.confirm(`Delete account ${u.email}? This cannot be undone.`)) return;
    setSavingId(u.id);
    setError(null);
    try {
      await api.admin.users.delete(u.id);
      setUsers((list) => list.filter((x) => x.id !== u.id));
      setTotal((t) => Math.max(0, t - 1));
    } catch (err) {
      setError(err.message || 'Delete failed');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="admin-page-content">
      <div className="admin-page-header">
        <div className="admin-page-title-wrap">
          <p className="admin-subtitle">Same roles as the mobile app (is_admin, is_business_owner)</p>
          <h1>Users</h1>
        </div>
      </div>
      {error && <div className="admin-error">{error}</div>}

      <div className="admin-card admin-toolbar-card" style={{ marginBottom: '1rem' }}>
        <div className="admin-card-body" style={{ padding: '1rem 1.25rem' }}>
          <div className="admin-admin-filters">
            <div className="admin-form-group" style={{ flex: '1 1 220px', minWidth: 180, marginBottom: 0 }}>
              <label htmlFor="au-search">Search name or email</label>
              <input
                id="au-search"
                type="search"
                placeholder="Type to filter…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="admin-form-group" style={{ minWidth: 130, marginBottom: 0 }}>
              <label htmlFor="au-provider">Provider</label>
              <select id="au-provider" value={provider} onChange={(e) => setProvider(e.target.value)}>
                <option value="all">All</option>
                <option value="email">Email</option>
                <option value="google">Google</option>
              </select>
            </div>
            <div className="admin-form-group" style={{ minWidth: 120, marginBottom: 0 }}>
              <label htmlFor="au-admin">Admin</label>
              <select id="au-admin" value={filterAdmin} onChange={(e) => setFilterAdmin(e.target.value)}>
                <option value="all">All</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
            <div className="admin-form-group" style={{ minWidth: 120, marginBottom: 0 }}>
              <label htmlFor="au-biz">Business</label>
              <select id="au-biz" value={filterBusiness} onChange={(e) => setFilterBusiness(e.target.value)}>
                <option value="all">All</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
            <div className="admin-form-group" style={{ minWidth: 120, marginBottom: 0 }}>
              <label htmlFor="au-ver">Email ✓</label>
              <select id="au-ver" value={filterVerified} onChange={(e) => setFilterVerified(e.target.value)}>
                <option value="all">All</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
            <div className="admin-form-group" style={{ minWidth: 120, marginBottom: 0 }}>
              <label htmlFor="au-blocked">Blocked</label>
              <select id="au-blocked" value={filterBlocked} onChange={(e) => setFilterBlocked(e.target.value)}>
                <option value="all">All</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
            <div className="admin-toolbar-actions">
              {settings.aiPlannerEnabled !== false && (
                <Link to="/plan/ai" className="admin-btn admin-btn--secondary">
                  Open AI planner
                </Link>
              )}
              <button type="button" className="admin-btn admin-btn--secondary" onClick={load} disabled={loading}>
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="admin-widgets admin-dashboard-grid" style={{ gridTemplateColumns: 'repeat(12, 1fr)' }}>
        <div className="admin-card" style={{ gridColumn: 'span 12' }}>
          <div className="admin-card-header">
            <h2 className="admin-card-title">
              Accounts matching filters ({total})
              {loading && (
                <span style={{ fontWeight: 400, fontSize: '0.88rem', color: '#64748b' }}> — loading…</span>
              )}
            </h2>
          </div>
          <div className="admin-card-body" style={{ padding: 0 }}>
            {loading && users.length === 0 && <div className="admin-loading" style={{ padding: '1.5rem' }}>Loading…</div>}
            {!loading && users.length === 0 && <div className="admin-empty">No users match these filters.</div>}
            {!loading && users.length > 0 && (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Provider</th>
                    <th>Admin</th>
                    <th>Business</th>
                    <th>Blocked</th>
                    <th>Email ✓</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isSelf = myId && u.id === myId;
                    return (
                      <tr key={u.id}>
                        <td>{u.name || '—'}</td>
                        <td style={{ fontSize: '0.85rem' }}>{u.email}</td>
                        <td>{u.authProvider || '—'}</td>
                        <td>
                          <label
                            style={{ cursor: savingId === u.id || isSelf ? 'not-allowed' : 'pointer' }}
                            title={isSelf ? 'Cannot change your own admin role here' : undefined}
                          >
                            <input
                              type="checkbox"
                              checked={!!u.isAdmin}
                              disabled={savingId === u.id || isSelf}
                              onChange={() => toggle(u, 'isAdmin')}
                            />
                          </label>
                        </td>
                        <td>
                          <label
                            style={{ cursor: savingId === u.id || isSelf ? 'not-allowed' : 'pointer' }}
                            title={isSelf ? 'Cannot change your own business role here' : undefined}
                          >
                            <input
                              type="checkbox"
                              checked={!!u.isBusinessOwner}
                              disabled={savingId === u.id || isSelf}
                              onChange={() => toggle(u, 'isBusinessOwner')}
                            />
                          </label>
                        </td>
                        <td>
                          <label
                            style={{ cursor: savingId === u.id || isSelf ? 'not-allowed' : 'pointer' }}
                            title={isSelf ? 'Cannot block your own account' : undefined}
                          >
                            <input
                              type="checkbox"
                              checked={!!u.isBlocked}
                              disabled={savingId === u.id || isSelf}
                              onChange={() => toggle(u, 'isBlocked')}
                            />
                          </label>
                        </td>
                        <td>{u.emailVerified ? 'Yes' : 'No'}</td>
                        <td>
                          <button
                            type="button"
                            className="admin-btn admin-btn--danger admin-btn--sm"
                            disabled={savingId === u.id || isSelf}
                            title={isSelf ? 'Cannot delete your own account' : 'Permanently delete this user'}
                            onClick={() => removeUser(u)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
