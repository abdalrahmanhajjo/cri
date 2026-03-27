import { useEffect } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { getPlaceImageUrl } from '../../api';
import './Business.css';

const BASE_TITLE = 'Business — Visit Tripoli';

export default function BusinessDashboard() {
  const ctx = useOutletContext();
  const data = ctx?.me;
  const loadErr = ctx?.loadErr;

  useEffect(() => {
    document.title = `Dashboard · ${BASE_TITLE}`;
    return () => {
      document.title = BASE_TITLE;
    };
  }, []);

  const places = data?.places || [];
  const isBusinessOwner = data?.isBusinessOwner === true;
  const n = places.length;

  return (
    <div className="business-dashboard">
      <header className="business-dashboard-hero">
        <p className="business-dashboard-kicker">Partner portal</p>
        <h1 className="business-dashboard-title">Manage your listings</h1>
        <p className="business-dashboard-lead">
          Update how your place appears on Visit Tripoli: copy, photos, map pin, hours, and language-specific text.
          Use <Link to="/business/places">Feed</Link> to publish community posts for your venues. User and platform
          administration stay in the separate admin console.
        </p>
      </header>

      {loadErr && !data && <div className="business-banner-error">{loadErr}</div>}

      {!data && !loadErr && <div className="business-loading">Loading your workspace…</div>}

      {data && (
        <>
          <div className="business-kpi-row">
            <div className="business-kpi">
              <div className="business-kpi-value">{n}</div>
              <div className="business-kpi-label">Places you manage</div>
            </div>
            <div className="business-kpi">
              <div className="business-kpi-value">{isBusinessOwner ? 'Yes' : '—'}</div>
              <div className="business-kpi-label">Business profile flag</div>
            </div>
          </div>

          {places.length === 0 && (
            <div className="business-empty-card">
              <p>
                {isBusinessOwner
                  ? 'No place is linked to your account yet. Contact your Visit Tripoli administrator to assign your venue under Admin → Place owners.'
                  : 'No venue is assigned yet. An administrator must link your account to a place before you can edit a listing.'}
              </p>
            </div>
          )}

          {places.length > 0 && (
            <div className="business-place-grid">
              {places.map((p) => {
                const imgs = Array.isArray(p.images) ? p.images : [];
                const cover = imgs.length ? getPlaceImageUrl(imgs[0]) : null;
                return (
                  <article key={p.id} className="business-place-card">
                    <div className={`business-place-cover${cover ? '' : ' business-place-cover--empty'}`}>
                      {cover ? <img src={cover} alt="" loading="lazy" /> : <span>No photo yet</span>}
                    </div>
                    <div className="business-place-card-body">
                      <h3>{p.name || p.id}</h3>
                      <p className="business-place-meta">{p.location || '—'}</p>
                      {p.rating != null && (
                        <p className="business-place-meta" style={{ fontWeight: 600, color: 'var(--biz-accent)' }}>
                          Rating {Number(p.rating).toFixed(1)} / 5
                        </p>
                      )}
                      <div className="business-place-actions">
                        <Link className="business-btn business-btn--primary" to={`/business/places/${encodeURIComponent(p.id)}`}>
                          Edit listing
                        </Link>
                        <Link
                          to={`/place/${encodeURIComponent(p.id)}`}
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
