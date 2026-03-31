import { useEffect } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { getPlaceImageUrl } from '../../api/client';
import { mergeBusinessPortal } from '../../config/siteSettingsDefaults';
import './Business.css';

const BASE_TITLE = 'Business — Visit Tripoli';

const DEFAULT_KICKER = 'Venue hub';
const DEFAULT_TITLE = 'Your places on Visit Tripoli';
const DEFAULT_LEAD = (
  <>
    A calm workspace for partners: refresh photos and copy, tune listing details, and preview the public page. Site-wide
    configuration and moderation stay in the admin console — this area is only for your venues.
  </>
);

export default function BusinessDashboard() {
  const ctx = useOutletContext();
  const data = ctx?.me;
  const loadErr = ctx?.loadErr;
  const portal = mergeBusinessPortal(ctx?.businessPortal);
  const copy = portal.copy || {};
  const feedOn = portal.sections?.feed !== false;

  useEffect(() => {
    document.title = `Dashboard · ${BASE_TITLE}`;
    return () => {
      document.title = BASE_TITLE;
    };
  }, []);

  const places = data?.places || [];
  const isBusinessOwner = data?.isBusinessOwner === true;
  const n = places.length;

  const kicker = copy.dashboardKicker || DEFAULT_KICKER;
  const title = copy.dashboardTitle || DEFAULT_TITLE;
  const leadFromSettings = copy.dashboardLead?.trim();

  return (
    <div className="business-dashboard business-dashboard--venue-hub">
      <header className="business-dashboard-hero business-dashboard-hero--venue">
        <div className="business-dashboard-hero-accent" aria-hidden="true" />
        <div className="business-dashboard-hero-inner">
          <p className="business-dashboard-kicker">{kicker}</p>
          <h1 className="business-dashboard-title">{title}</h1>
          <p className="business-dashboard-lead">
            {leadFromSettings ? (
              leadFromSettings
            ) : (
              <>
                {DEFAULT_LEAD}{' '}
                {feedOn ? (
                  <>
                    When enabled for your account, use <Link to="/business/places">Feed</Link> to publish posts for your
                    venues.
                  </>
                ) : (
                  'Community feed posting is turned off in site settings for now.'
                )}
              </>
            )}
          </p>
        </div>
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
