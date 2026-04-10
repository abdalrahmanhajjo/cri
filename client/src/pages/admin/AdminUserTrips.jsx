import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useSiteSettings } from '../../context/SiteSettingsContext';
import './Admin.css';

function formatDate(str) {
  if (!str) return '—';
  try {
    const d = new Date(str);
    return isNaN(d.getTime()) ? str : d.toLocaleDateString(undefined, { dateStyle: 'short' });
  } catch {
    return str;
  }
}

export default function AdminUserTrips() {
  const { settings } = useSiteSettings();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = { limit: 500 };
    if (debouncedQ) params.q = debouncedQ;
    api.admin.allTrips
      .list(params)
      .then((r) => setTrips(r.trips || []))
      .catch((err) => setError(err.message || 'Failed to load trips'))
      .finally(() => setLoading(false));
  }, [debouncedQ]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="admin-page-content">
      <div className="admin-page-header">
        <div className="admin-page-title-wrap">
          <p className="admin-subtitle">Trips saved from the web planner or mobile app (same database)</p>
          <h1>User trips</h1>
        </div>
      </div>
      {error && <div className="admin-error">{error}</div>}

      <div className="admin-card admin-toolbar-card" style={{ marginBottom: '1rem' }}>
        <div className="admin-card-body" style={{ padding: '1rem 1.25rem' }}>
          <div className="admin-admin-filters">
            <div className="admin-form-group" style={{ flex: '1 1 280px', minWidth: 200, marginBottom: 0 }}>
              <label htmlFor="ut-search">Search trip name, ID, user name or email</label>
              <input
                id="ut-search"
                type="search"
                placeholder="Filter results…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                autoComplete="off"
              />
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
              Trips ({trips.length}
              {debouncedQ ? ` matching “${debouncedQ}”` : ''})
            </h2>
          </div>
          <div className="admin-card-body" style={{ padding: 0 }}>
            {loading && trips.length === 0 && <div className="admin-loading" style={{ padding: '1.5rem' }}>Loading…</div>}
            {!loading && trips.length === 0 && (
              <div className="admin-empty">No trips match your search.</div>
            )}
            {!loading && trips.length > 0 && (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Trip</th>
                    <th>User</th>
                    <th>Dates</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {trips.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <strong>{t.name}</strong>
                        <br />
                        <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>{t.id}</span>
                      </td>
                      <td>
                        {t.userName || '—'}
                        <br />
                        <span style={{ fontSize: '0.8rem' }}>{t.userEmail}</span>
                      </td>
                      <td>
                        {formatDate(t.startDate)} → {formatDate(t.endDate)}
                      </td>
                      <td>{formatDate(t.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
