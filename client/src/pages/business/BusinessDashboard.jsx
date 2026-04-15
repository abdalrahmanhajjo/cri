import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getPlaceImageUrl } from '../../api/client';
import { placePublicPagePath } from '../../utils/discoverPaths';
import './Business.css';

const BASE_TITLE = 'Business — Visit Tripoli';

export default function BusinessDashboard() {
  const { user } = useAuth();
  const ctx = useOutletContext();
  const data = ctx?.me;
  const loadErr = ctx?.loadErr;
  const isAdmin = user?.isAdmin === true;

  const [venueQuery, setVenueQuery] = useState('');
  const [kindFilter, setKindFilter] = useState('all');

  useEffect(() => {
    document.title = `Dashboard · ${BASE_TITLE}`;
    return () => {
      document.title = BASE_TITLE;
    };
  }, []);

  const places = useMemo(() => (Array.isArray(data?.places) ? data.places : []), [data]);
  const isBusinessOwner = data?.isBusinessOwner === true;
  const meIsAdmin = data?.isAdmin === true;

  const filteredPlaces = useMemo(() => {
    let list = places;
    if (kindFilter === 'dining') {
      list = list.filter((p) => p.venueKind === 'dining');
    }
    const q = venueQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) => {
      const name = String(p.name || '').toLowerCase();
      const loc = String(p.location || '').toLowerCase();
      const cat = String(p.category || '').toLowerCase();
      return name.includes(q) || loc.includes(q) || cat.includes(q);
    });
  }, [places, venueQuery, kindFilter]);

  const diningCount = useMemo(() => places.filter((p) => p.venueKind === 'dining').length, [places]);

  return (
    <div className="business-dashboard">
      <header className={`business-dashboard-hero${diningCount > 0 ? ' business-dashboard-hero--dining' : ''}`}>
        <p className="business-dashboard-kicker">Partner portal</p>
        <h1 className="business-dashboard-title">Restaurant & venue console</h1>
        <p className="business-dashboard-lead">
          Manage listings by name: edit copy, photos, hours, dining profile, and translations. Use{' '}
          <Link to="/business/places">Feed & engagement</Link> for posts, inquiries, offers, and moderation tools.
          {isAdmin && (
            <>
              {' '}
              <span className="business-admin-inline">
                Admin: block users or adjust roles in{' '}
                <Link to="/admin/users">Users</Link>, full content tools in{' '}
                <Link to="/admin-full">Admin</Link>.
              </span>
            </>
          )}
        </p>
      </header>

      {loadErr && !data && <div className="business-banner-error">{loadErr}</div>}

      {!data && !loadErr && <div className="business-loading">Loading your workspace…</div>}

      {data && (
        <>
          <div className="business-kpi-row">
            <div className="business-kpi">
              <div className="business-kpi-value">{places.length}</div>
              <div className="business-kpi-label">Venues in workspace</div>
            </div>
            <div className="business-kpi">
              <div className="business-kpi-value">{diningCount}</div>
              <div className="business-kpi-label">Dining / restaurant</div>
            </div>
            <div className="business-kpi">
              <div className="business-kpi-value">{isBusinessOwner ? 'Yes' : '—'}</div>
              <div className="business-kpi-label">Business profile</div>
            </div>
            {meIsAdmin && (
              <div className="business-kpi business-kpi--accent">
                <div className="business-kpi-value">Admin</div>
                <div className="business-kpi-label">Full venue access</div>
              </div>
            )}
          </div>

          {places.length > 0 && (
            <div className="business-place-toolbar" role="search">
              <label className="business-place-search">
                <span className="business-visually-hidden">Search venues</span>
                <input
                  type="search"
                  className="business-input"
                  placeholder="Search by venue name, area, or category…"
                  value={venueQuery}
                  onChange={(e) => setVenueQuery(e.target.value)}
                  autoComplete="off"
                />
              </label>
              <div className="business-segmented" role="group" aria-label="Venue type">
                <button
                  type="button"
                  className={`business-seg-btn${kindFilter === 'all' ? ' business-seg-btn--on' : ''}`}
                  onClick={() => setKindFilter('all')}
                >
                  All
                </button>
                <button
                  type="button"
                  className={`business-seg-btn${kindFilter === 'dining' ? ' business-seg-btn--on' : ''}`}
                  onClick={() => setKindFilter('dining')}
                >
                  Dining
                </button>
              </div>
            </div>
          )}

          {places.length === 0 && (
            <div className="business-empty-card">
              <p>
                {isBusinessOwner || meIsAdmin
                  ? 'No venues in this workspace yet. Ask an administrator to assign your place (Admin → Place owners), or browse dining venues as an admin once places exist.'
                  : 'No venue is assigned yet. An administrator must link your account to a place before you can edit a listing.'}
              </p>
            </div>
          )}

          {places.length > 0 && filteredPlaces.length === 0 && (
            <div className="business-empty-card">
              <p>No venues match your search. Try another name or clear filters.</p>
            </div>
          )}

          {filteredPlaces.length > 0 && (
            <div className="business-place-grid business-place-grid--modern">
              {filteredPlaces.map((p) => {
                const imgs = Array.isArray(p.images) ? p.images : [];
                const cover = imgs.length ? getPlaceImageUrl(imgs[0]) : null;
                const subtitle = [p.location, p.category].filter(Boolean).join(' · ') || '—';
                return (
                  <article key={p.id} className="business-place-card">
                    <div className={`business-place-cover${cover ? '' : ' business-place-cover--empty'}`}>
                      {cover ? <img src={cover} alt="" loading="lazy" /> : <span>No photo yet</span>}
                    </div>
                    <div className="business-place-card-body">
                      <div className="business-place-card-title-row">
                        <h3>{p.name || 'Venue'}</h3>
                        <div className="business-venue-badges">
                          {p.venueKind === 'dining' && <span className="business-venue-badge business-venue-badge--dining">Dining</span>}
                          {p.access === 'admin' && meIsAdmin && (
                            <span className="business-venue-badge business-venue-badge--admin">Admin scope</span>
                          )}
                        </div>
                      </div>
                      <p className="business-place-meta">{subtitle}</p>
                      {p.rating != null && (
                        <p className="business-place-meta" style={{ fontWeight: 600, color: 'var(--biz-accent)' }}>
                          Rating {Number(p.rating).toFixed(1)} / 5
                        </p>
                      )}
                      <div className="business-place-actions">
                        <Link className="business-btn business-btn--primary" to={`/business/places/${encodeURIComponent(p.id)}`}>
                          Edit listing
                        </Link>
                        {p.venueKind === 'dining' ? (
                          <Link
                            className="business-btn business-btn--ghost"
                            to={`/business/places?placeId=${encodeURIComponent(p.id)}`}
                          >
                            Feed, offers & proposals
                          </Link>
                        ) : null}
                        <Link
                          to={placePublicPagePath(p.id, { dining: p.venueKind === 'dining' })}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="business-place-public-link"
                        >
                          Preview public page
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
