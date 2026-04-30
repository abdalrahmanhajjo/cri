import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import './css/Admin.css';

function formatDate(str) {
  if (!str) return '—';
  try {
    const d = new Date(str);
    return isNaN(d.getTime()) ? str : d.toLocaleDateString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return str;
  }
}

export default function AdminDashboard() {
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState({
    places: 0,
    categories: 0,
    tours: 0,
    events: 0,
    users: 0,
    trips: 0,
    feedPosts: 0,
    placePromotions: 0,
    coupons: 0,
  });
  const [places, setPlaces] = useState([]);
  const [events, setEvents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [quickTab, setQuickTab] = useState('places');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      api.admin.stats().catch(() => ({})),
      api.places.list().then((r) => r.popular || r.locations || []),
      api.categories.list().then((r) => r.categories || []),
      api.events.list().then((r) => r.events || []),
    ])
      .then(([st, pList, cList, eList]) => {
        if (cancelled) return;
        const placesArr = Array.isArray(pList) ? pList : [];
        const categoriesArr = Array.isArray(cList) ? cList : [];
        const eventsArr = Array.isArray(eList) ? eList : [];
        setStats({
          places: st.places != null ? st.places : placesArr.length,
          categories: st.categories != null ? st.categories : categoriesArr.length,
          tours: st.tours != null ? st.tours : 0,
          events: st.events != null ? st.events : eventsArr.length,
          users: st.users ?? 0,
          trips: st.trips ?? 0,
          feedPosts: st.feedPosts ?? 0,
          placePromotions: st.placePromotions ?? 0,
          coupons: st.coupons ?? 0,
        });
        setPlaces(placesArr.slice(0, 5));
        setEvents(eventsArr.slice(0, 5));
        setCategories(categoriesArr);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load dashboard data');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const {
    places: placesNum,
    categories: categoriesNum,
    tours: toursNum,
    events: eventsNum,
    users: usersNum,
    trips: tripsNum,
    feedPosts: feedNum,
    placePromotions: promosNum,
    coupons: couponsNum,
  } = stats;
  const total = placesNum + categoriesNum + toursNum + eventsNum;

  const categoryCounts = categories.slice(0, 4).map((c) => ({
    label: c.name || c.id,
    count: c.count ?? 0,
    color: c.color || '#6b7280',
  }));
  const maxCat = Math.max(1, ...categoryCounts.map((x) => x.count));

  if (loading) {
    return (
      <div className="admin-main">
        <div className="admin-page-header">
          <div className="admin-page-title-wrap">
            <p className="admin-subtitle">Manage and track your content</p>
            <h1>Admin Dashboard</h1>
          </div>
        </div>
        <div className="admin-loading">Loading dashboard…</div>
      </div>
    );
  }

  return (
    <div className="admin-main">
      <div className="admin-page-header">
        <div className="admin-page-title-wrap">
          <p className="admin-subtitle">Website and mobile app — one database</p>
          <h1>Admin dashboard</h1>
        </div>
        <div className="admin-search-wrap">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="search"
            placeholder="Search places, events, experiences…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {error && <div className="admin-error">{error}</div>}

      <div className="admin-widgets admin-dashboard-grid" style={{ gridTemplateColumns: 'repeat(12, 1fr)' }}>
        {/* Quick Manage - My Tasks style */}
        <div className="admin-card" style={{ gridColumn: 'span 4' }}>
          <div className="admin-card-header">
            <h2 className="admin-card-title">Quick Manage</h2>
            <div className="admin-card-header-actions">
              <Link to="/admin/places" title="Add">+</Link>
            </div>
          </div>
          <div className="admin-card-body">
            <div className="admin-segmented">
              <button type="button" className={quickTab === 'places' ? 'active' : ''} onClick={() => setQuickTab('places')}>
                Places
              </button>
              <button type="button" className={quickTab === 'events' ? 'active' : ''} onClick={() => setQuickTab('events')}>
                Events
              </button>
            </div>
            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
              {quickTab === 'places' &&
                places.map((p) => (
                  <div key={p.id} className="admin-list-item">
                    <div className="admin-list-item-icon" style={{ background: '#dbeafe', color: '#1e40af' }}>
                      {(p.name || 'P')[0]}
                    </div>
                    <div className="admin-list-item-content">
                      <div className="admin-list-item-title">{p.name || p.id}</div>
                      <div className="admin-list-item-desc">{(p.location || p.category || '').slice(0, 40)}</div>
                    </div>
                    <Link to={`/admin/places`}>Manage →</Link>
                  </div>
                ))}
              {quickTab === 'events' &&
                events.map((e) => (
                  <div key={e.id} className="admin-list-item">
                    <div className="admin-list-item-icon" style={{ background: '#fef3c7', color: '#b45309' }}>
                      {(e.name || 'E')[0]}
                    </div>
                    <div className="admin-list-item-content">
                      <div className="admin-list-item-title">{e.name || e.id}</div>
                      <div className="admin-list-item-desc">{formatDate(e.startDate)}</div>
                    </div>
                    <Link to={`/admin/events`}>Manage →</Link>
                  </div>
                ))}
              {((quickTab === 'places' && places.length === 0) || (quickTab === 'events' && events.length === 0)) && (
                <div className="admin-empty" style={{ padding: '1.5rem' }}>No items yet.</div>
              )}
            </div>
            <div style={{ marginTop: '0.75rem' }}>
              <Link to={quickTab === 'places' ? '/admin/places' : '/admin/events'}>See all →</Link>
            </div>
          </div>
        </div>

        {/* Content Overview - Projects Overview style */}
        <div className="admin-card" style={{ gridColumn: 'span 4' }}>
          <div className="admin-card-header">
            <h2 className="admin-card-title">Content Overview</h2>
            <div className="admin-card-header-actions">
              <Link to="/admin/places" title="Expand">⤢</Link>
            </div>
          </div>
          <div className="admin-card-body">
            <div className="admin-donut-wrap">
              <div
                className="admin-donut"
                style={{
                  background: total
                    ? `conic-gradient(
                        #3b82f6 0deg ${(placesNum / total) * 360}deg,
                        #f59e0b ${(placesNum / total) * 360}deg ${((placesNum + categoriesNum) / total) * 360}deg,
                        #10b981 ${((placesNum + categoriesNum) / total) * 360}deg ${((placesNum + categoriesNum + toursNum) / total) * 360}deg,
                        #8b5cf6 ${((placesNum + categoriesNum + toursNum) / total) * 360}deg 360deg
                      )`
                    : 'conic-gradient(#e5e7eb 0deg 360deg)',
                }}
              />
            </div>
            <div className="admin-legend">
              <div className="admin-legend-item">
                <span className="admin-legend-dot" style={{ background: '#3b82f6' }} />
                Places: {placesNum}
              </div>
              <div className="admin-legend-item">
                <span className="admin-legend-dot" style={{ background: '#f59e0b' }} />
                Categories: {categoriesNum}
              </div>
              <div className="admin-legend-item">
                <span className="admin-legend-dot" style={{ background: '#10b981' }} />
                Experiences: {toursNum}
              </div>
              <div className="admin-legend-item">
                <span className="admin-legend-dot" style={{ background: '#8b5cf6' }} />
                Events: {eventsNum}
              </div>
            </div>
          </div>
        </div>

        {/* Upcoming Events - My Meetings style */}
        <div className="admin-card" style={{ gridColumn: 'span 4' }}>
          <div className="admin-card-header">
            <h2 className="admin-card-title">Upcoming Events</h2>
            <div className="admin-card-header-actions">
              <Link to="/admin/events" title="Add">+</Link>
            </div>
          </div>
          <div className="admin-card-body">
            {events.length === 0 ? (
              <div className="admin-empty" style={{ padding: '1.5rem' }}>No upcoming events.</div>
            ) : (
              <>
                {events.map((e) => (
                  <div key={e.id} className="admin-list-item">
                    <div className="admin-list-item-content">
                      <div className="admin-list-item-title">{e.name || e.id}</div>
                      <div className="admin-list-item-desc">{formatDate(e.startDate)} · {e.location || '—'}</div>
                    </div>
                    <Link to={`/admin/events`}>View →</Link>
                  </div>
                ))}
                <div style={{ marginTop: '0.75rem' }}>
                  <Link to="/admin/events">See all events →</Link>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Content by Category - Invoice Overview style (progress bars) */}
        <div className="admin-card" style={{ gridColumn: 'span 6' }}>
          <div className="admin-card-header">
            <h2 className="admin-card-title">Content by Category</h2>
            <div className="admin-card-header-actions">
              <Link to="/admin/categories" title="Expand">⤢</Link>
            </div>
          </div>
          <div className="admin-card-body">
            <div className="admin-progress-list">
              {categoryCounts.map((item) => (
                <div key={item.label} className="admin-progress-item">
                  <span className="admin-progress-item-label">{item.label}</span>
                  <div className="admin-progress-bar-wrap">
                    <div
                      className="admin-progress-bar"
                      style={{
                        width: `${(item.count / maxCat) * 100}%`,
                        background: item.color,
                      }}
                    />
                  </div>
                  <span className="admin-progress-item-value">{item.count}</span>
                </div>
              ))}
              {categoryCounts.length === 0 && (
                <div className="admin-empty" style={{ padding: '1rem' }}>No categories.</div>
              )}
            </div>
          </div>
        </div>

        {/* Stats cards row */}
        <div className="admin-card" style={{ gridColumn: 'span 2' }}>
          <div className="admin-card-body">
            <div className="admin-stat-value">{placesNum}</div>
            <div className="admin-stat-label">Places</div>
            <Link to="/admin/places">Manage →</Link>
          </div>
        </div>
        <div className="admin-card" style={{ gridColumn: 'span 2' }}>
          <div className="admin-card-body">
            <div className="admin-stat-value">{categoriesNum}</div>
            <div className="admin-stat-label">Categories</div>
            <Link to="/admin/categories">Manage →</Link>
          </div>
        </div>
        <div className="admin-card" style={{ gridColumn: 'span 2' }}>
          <div className="admin-card-body">
            <div className="admin-stat-value">{toursNum}</div>
            <div className="admin-stat-label">Experiences</div>
            <Link to="/admin/experiences">Manage →</Link>
          </div>
        </div>
        <div className="admin-card" style={{ gridColumn: 'span 2' }}>
          <div className="admin-card-body">
            <div className="admin-stat-value">{eventsNum}</div>
            <div className="admin-stat-label">Events</div>
            <Link to="/admin/events">Manage →</Link>
          </div>
        </div>
        <div className="admin-card" style={{ gridColumn: 'span 2' }}>
          <div className="admin-card-body">
            <div className="admin-stat-value">Aa</div>
            <div className="admin-stat-label">Content</div>
            <Link to="/admin/settings?tab=translations">Translations →</Link>
          </div>
        </div>
        <div className="admin-card" style={{ gridColumn: 'span 2' }}>
          <div className="admin-card-body">
            <div className="admin-stat-value">{usersNum}</div>
            <div className="admin-stat-label">Users</div>
            <Link to="/admin/users">Manage →</Link>
          </div>
        </div>
        <div className="admin-card" style={{ gridColumn: 'span 2' }}>
          <div className="admin-card-body">
            <div className="admin-stat-value">{tripsNum}</div>
            <div className="admin-stat-label">Trips</div>
            <Link to="/admin/user-trips">View →</Link>
          </div>
        </div>
        <div className="admin-card" style={{ gridColumn: 'span 2' }}>
          <div className="admin-card-body">
            <div className="admin-stat-value">{feedNum}</div>
            <div className="admin-stat-label">Feed posts</div>
            <Link to="/admin/feed">Open →</Link>
          </div>
        </div>
        <div className="admin-card" style={{ gridColumn: 'span 2' }}>
          <div className="admin-card-body">
            <div className="admin-stat-value">{promosNum + couponsNum}</div>
            <div className="admin-stat-label">Offers & coupons</div>
            <Link to="/admin/offers">Manage →</Link>
          </div>
        </div>
        <div className="admin-card" style={{ gridColumn: 'span 2' }}>
          <div className="admin-card-body">
            <div className="admin-stat-value">⚙</div>
            <div className="admin-stat-label">Settings</div>
            <Link to="/admin/settings">Configure →</Link>
          </div>
        </div>

        {/* Recent Places - Open Tickets style */}
        <div className="admin-card" style={{ gridColumn: 'span 6' }}>
          <div className="admin-card-header">
            <h2 className="admin-card-title">Recent Places</h2>
            <div className="admin-card-header-actions">
              <Link to="/admin/places" title="Expand">⤢</Link>
            </div>
          </div>
          <div className="admin-card-body">
            {places.length === 0 ? (
              <div className="admin-empty" style={{ padding: '1.5rem' }}>No places yet.</div>
            ) : (
              places.map((p) => (
                <div key={p.id} className="admin-list-item">
                  <div className="admin-list-item-icon" style={{ background: '#d1fae5', color: '#065f46' }}>
                    {(p.name || 'P')[0]}
                  </div>
                  <div className="admin-list-item-content">
                    <div className="admin-list-item-title">{p.name || p.id}</div>
                    <div className="admin-list-item-desc">{(p.description || p.location || '').slice(0, 50)}…</div>
                  </div>
                  <Link to="/admin/places">Check →</Link>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
