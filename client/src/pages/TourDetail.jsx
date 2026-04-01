import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api, { getPlaceImageUrl } from '../api/client';
import DeliveryImg from '../components/DeliveryImg';
import Icon from '../components/Icon';
import { getDeliveryImgProps } from '../utils/responsiveImages.js';
import { useLanguage } from '../context/LanguageContext';
import './Detail.css';

function InfoRow({ icon, label, value }) {
  if (value == null || value === '') return null;
  const display = Array.isArray(value) ? value.join(', ') : value;
  if (display === '') return null;
  return (
    <div className="place-detail-info-row">
      <span className="place-detail-info-icon" aria-hidden="true">
        <Icon name={icon} size={20} />
      </span>
      <div className="place-detail-info-content">
        <span className="place-detail-info-label">{label}</span>
        <span className="place-detail-info-value">{display}</span>
      </div>
    </div>
  );
}

function parseBadgeColor(hex) {
  if (!hex || typeof hex !== 'string') return null;
  const h = hex.trim().replace(/^#/, '');
  if (!/^[0-9A-Fa-f]{6}$/.test(h)) return null;
  return `#${h}`;
}

/** API may return plain strings or objects e.g. { time, activity, description }. */
function ItineraryStepContent({ item }) {
  if (item == null) return null;
  if (typeof item === 'string' || typeof item === 'number') return <>{String(item)}</>;
  if (typeof item === 'object' && !Array.isArray(item)) {
    const time = item.time ?? item.Time;
    const activity = item.activity ?? item.Activity ?? item.title ?? item.name;
    const description = item.description ?? item.Description ?? item.details;
    if (time != null || activity != null || description != null) {
      return (
        <div className="detail-itinerary-step">
          {time != null && String(time).trim() !== '' && (
            <span className="detail-itinerary-step-time">{String(time)}</span>
          )}
          {activity != null && String(activity).trim() !== '' && (
            <span className="detail-itinerary-step-activity">{String(activity)}</span>
          )}
          {description != null && String(description).trim() !== '' && (
            <p className="detail-itinerary-step-desc">{String(description)}</p>
          )}
        </div>
      );
    }
    const textBits = Object.values(item).filter(
      (v) => (typeof v === 'string' || typeof v === 'number') && String(v).trim() !== ''
    );
    if (textBits.length > 0) return <>{textBits.map(String).join(' · ')}</>;
    return null;
  }
  return <>{String(item)}</>;
}

/** All distinct image URLs for a place (hero + gallery), same data as the app uses per stop. */
function collectPlaceImageUrls(place) {
  if (!place) return [];
  const raw = [];
  if (place.image) raw.push(place.image);
  if (Array.isArray(place.images)) raw.push(...place.images);
  const seen = new Set();
  const out = [];
  for (const im of raw) {
    if (im == null || im === '') continue;
    const u = getPlaceImageUrl(im) || String(im);
    if (u && !seen.has(u)) {
      seen.add(u);
      out.push(u);
    }
  }
  return out;
}

export default function TourDetail() {
  const { id } = useParams();
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const langParam = lang === 'ar' ? 'ar' : lang === 'fr' ? 'fr' : 'en';
  const [tour, setTour] = useState(null);
  const [tourList, setTourList] = useState([]);
  const [stopPlaces, setStopPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.tours
      .get(id)
      .then((data) => {
        if (cancelled) return;
        setTour(data);
        const ids = Array.isArray(data?.placeIds) ? data.placeIds.map(String) : [];
        if (ids.length === 0) {
          setStopPlaces([]);
          return;
        }
        return Promise.all(ids.map((pid) => api.places.get(pid).catch(() => null))).then((rows) => {
          if (cancelled) return;
          const byId = new Map();
          rows.filter(Boolean).forEach((p) => byId.set(String(p.id), p));
          setStopPlaces(ids.map((pid) => byId.get(pid) || { id: pid, name: pid, _missing: true }));
        });
      })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    api.tours.list({ lang: langParam })
      .then((r) => setTourList(Array.isArray(r?.featured) ? r.featured : []))
      .catch(() => setTourList([]));
  }, [langParam]);

  const similarTours = useMemo(
    () => tourList.filter((x) => String(x.id) !== String(id)).slice(0, 8),
    [tourList, id]
  );

  const openTourOnMap = useCallback(() => {
    if (!tour?.placeIds?.length) return;
    const ids = tour.placeIds.map(String);
    navigate('/map', {
      state: {
        tripPlaceIds: ids,
        tripDays: [{ placeIds: [...ids] }],
        tripName: tour.name || t('detail', 'tourBadge'),
        tripStartDate: '',
        tripDayLabel: tour.name,
      },
    });
  }, [navigate, tour, t]);

  const handleShare = useCallback(() => {
    if (typeof navigator !== 'undefined' && navigator.share && tour) {
      navigator.share({
        title: tour.name,
        text: tour.description || tour.name,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(window.location.href).catch(() => {});
    }
  }, [tour]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  if (loading) {
    return (
      <div className="place-detail place-detail--loading">
        <div className="place-detail-loading">
          <div className="place-detail-loading-spinner" aria-hidden="true" />
          <p>{t('detail', 'loading')}</p>
        </div>
      </div>
    );
  }

  if (error || !tour) {
    return (
      <div className="place-detail place-detail--error">
        <div className="place-detail-container">
          <Link to="/activities" className="place-detail-back">
            <Icon name="arrow_back" size={20} /> {t('detail', 'backToExplore')}
          </Link>
          <div className="place-detail-error">
            <p>{t('detail', 'notFound')}</p>
            <p className="place-detail-error-sub">{error || ''}</p>
          </div>
        </div>
      </div>
    );
  }

  const img = getPlaceImageUrl(tour.image);
  const locationsStr = Array.isArray(tour.locations) ? tour.locations.join(', ') : tour.locations;
  const languagesStr = Array.isArray(tour.languages) && tour.languages.length > 0
    ? tour.languages.join(', ')
    : null;
  const stopCount = Array.isArray(tour.placeIds) ? tour.placeIds.length : 0;
  const badgeStyle = parseBadgeColor(tour.badgeColor)
    ? { backgroundColor: parseBadgeColor(tour.badgeColor) }
    : undefined;
  const includes = Array.isArray(tour.includes) ? tour.includes : [];
  const excludes = Array.isArray(tour.excludes) ? tour.excludes : [];
  const itinerary = Array.isArray(tour.itinerary) ? tour.itinerary : [];
  const rating = tour.rating != null && Number.isFinite(Number(tour.rating)) ? Number(tour.rating) : null;
  const reviews = tour.reviews != null && Number.isFinite(Number(tour.reviews)) ? Number(tour.reviews) : null;

  return (
    <div className="place-detail place-detail--tabs place-detail--experience">
      <div className="place-detail-container place-detail-container--experience">
        <nav className="place-detail-breadcrumb" aria-label="Breadcrumb">
          <ol className="place-detail-breadcrumb-list">
            <li><Link to="/">{t('nav', 'home')}</Link></li>
            <li><Link to="/activities">{t('nav', 'experiencesTours')}</Link></li>
            <li aria-current="page">{tour.name}</li>
          </ol>
        </nav>

        <Link to="/activities" className="place-detail-back">
          <Icon name="arrow_back" size={20} /> {t('detail', 'backToExplore')}
        </Link>

        <article className="place-detail-article">
          <header className="place-detail-hero place-detail-hero--tour">
            {img && (
              <img
                key={img}
                className="place-detail-hero__img"
                alt=""
                loading="eager"
                decoding="async"
                fetchPriority="high"
                {...getDeliveryImgProps(img, 'detailHero')}
              />
            )}
            {!img && (
              <div className="place-detail-hero-fallback">
                <Icon name="explore" size={48} />
                <span>{t('detail', 'noImage')}</span>
              </div>
            )}
            <div className="place-detail-hero-overlay" />
            <div
              className="place-detail-hero-badge"
              style={badgeStyle}
            >
              {tour.badge || t('detail', 'tourBadge')}
            </div>
            <div className="place-detail-hero-content">
              <h1 className="place-detail-title">{tour.name}</h1>
              {locationsStr && (
                <p className="place-detail-location">
                  <Icon name="location_on" size={18} /> {locationsStr}
                </p>
              )}
              <p className="place-detail-subtitle">
                {(tour.badge && String(tour.badge).trim()) ? `${String(tour.badge).trim()} · ` : ''}
                {t('detail', 'stopsCount').replace('{count}', String(stopCount))}
              </p>
              <div className="place-detail-hero-meta">
                {tour.duration && <span className="place-detail-category">{tour.duration}</span>}
                {tour.priceDisplay && <span className="place-detail-category">{tour.priceDisplay}</span>}
                {tour.difficulty && <span className="place-detail-category">{tour.difficulty}</span>}
                {rating != null && (
                  <span className="place-detail-category">
                    <Icon name="star" size={14} /> {rating.toFixed(1)}
                    {reviews != null ? ` (${reviews})` : ''}
                  </span>
                )}
              </div>
            </div>
          </header>

          <div className="detail-tab-bar" role="tablist" aria-label={t('detail', 'tourBadge')}>
            {[
              { id: 'overview', label: t('detail', 'tourOverviewTab') },
              { id: 'map', label: t('detail', 'tourMapTab') },
              { id: 'itinerary', label: t('detail', 'tourItineraryTab') },
            ].map(({ id: tid, label }) => (
              <button
                key={tid}
                type="button"
                role="tab"
                aria-selected={tab === tid}
                className={`detail-tab ${tab === tid ? 'detail-tab--active' : ''}`}
                onClick={() => setTab(tid)}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'overview' && (
            <div className="detail-tab-panel" role="tabpanel">
              <div className="place-detail-actions detail-tab-actions">
                <button type="button" className="place-detail-btn place-detail-btn--primary" onClick={openTourOnMap} disabled={!stopCount}>
                  <Icon name="map" size={20} /> {t('detail', 'viewOnMap')}
                </button>
                <button type="button" className="place-detail-btn place-detail-btn--icon" onClick={handleShare} aria-label={t('detail', 'share')}>
                  <Icon name="share" size={22} />
                  <span className="place-detail-btn-label">{t('detail', 'share')}</span>
                </button>
                <button type="button" className="place-detail-btn place-detail-btn--icon" onClick={handlePrint} aria-label={t('detail', 'print')}>
                  <Icon name="print" size={22} />
                  <span className="place-detail-btn-label">{t('detail', 'print')}</span>
                </button>
              </div>

              <div className="place-detail-info">
                <InfoRow icon="schedule" label={t('detail', 'duration')} value={tour.duration} />
                <InfoRow icon="payments" label={t('detail', 'priceRange')} value={tour.priceDisplay} />
                <InfoRow icon="terrain" label={t('detail', 'difficulty')} value={tour.difficulty} />
                <InfoRow icon="translate" label={t('detail', 'languages')} value={languagesStr || (Array.isArray(tour.languages) ? tour.languages : null)} />
                <InfoRow icon="location_on" label={t('detail', 'location')} value={locationsStr} />
              </div>

              {itinerary.length > 0 && (
                <section className="place-detail-section" aria-labelledby="tour-itin-preview">
                  <h2 id="tour-itin-preview" className="place-detail-section-title">{t('detail', 'tourItineraryFull')}</h2>
                  <p className="detail-section-hint">
                    <button type="button" className="detail-text-link" onClick={() => setTab('itinerary')}>
                      {t('detail', 'tourItineraryTab')} →
                    </button>
                  </p>
                  <ol className="detail-itinerary-preview">
                    {itinerary.slice(0, 4).map((item, i) => (
                      <li key={i}>
                        <ItineraryStepContent item={item} />
                      </li>
                    ))}
                  </ol>
                  {itinerary.length > 4 && (
                    <button type="button" className="detail-text-link" onClick={() => setTab('itinerary')}>
                      +{itinerary.length - 4} {t('detail', 'tourMoreSteps')}
                    </button>
                  )}
                </section>
              )}

              {stopPlaces.length > 0 && (
                <section className="place-detail-section" aria-labelledby="tour-stops-heading">
                  <h2 id="tour-stops-heading" className="place-detail-section-title">{t('detail', 'tourStopsPhotos')}</h2>
                  <p className="detail-section-sub">{t('detail', 'tourStopsPhotosSub')}</p>
                  <div className="tour-stops-list">
                    {stopPlaces.map((place, idx) => {
                      const imgs = collectPlaceImageUrls(place);
                      const pid = String(place.id);
                      const name = place.name || pid;
                      return (
                        <div key={pid} className="tour-stop-card">
                          <div className="tour-stop-card-head">
                            <span className="tour-stop-num">{idx + 1}</span>
                            <div>
                              {place._missing ? (
                                <span className="tour-stop-name">{name}</span>
                              ) : (
                                <Link to={`/place/${pid}`} className="tour-stop-name tour-stop-name--link">{name}</Link>
                              )}
                              {place.location && <p className="tour-stop-loc">{place.location}</p>}
                            </div>
                          </div>
                          {imgs.length > 0 ? (
                            <div className="tour-stop-gallery">
                              {imgs.map((src, gi) =>
                                place._missing ? (
                                  <span key={gi} className="tour-stop-gallery-item">
                                    <img
                                      className="tour-stop-gallery-img"
                                      alt=""
                                      loading="lazy"
                                      decoding="async"
                                      {...getDeliveryImgProps(src, 'galleryTile')}
                                    />
                                  </span>
                                ) : (
                                  <Link key={gi} to={`/place/${pid}`} className="tour-stop-gallery-item">
                                    <img
                                      className="tour-stop-gallery-img"
                                      alt=""
                                      loading="lazy"
                                      decoding="async"
                                      {...getDeliveryImgProps(src, 'galleryTile')}
                                    />
                                  </Link>
                                )
                              )}
                            </div>
                          ) : (
                            <p className="tour-stop-no-img">{t('detail', 'noImage')}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {tour.description && (
                <section className="place-detail-section" aria-labelledby="tour-description-heading">
                  <h2 id="tour-description-heading" className="place-detail-section-title">{t('detail', 'description')}</h2>
                  <div className="place-detail-description place-detail-description--card">
                    {tour.description.split(/\n\n+/).map((para, i) => (
                      <p key={i}>{para}</p>
                    ))}
                  </div>
                </section>
              )}

              {tour.highlights && tour.highlights.length > 0 && (
                <section className="place-detail-section" aria-labelledby="tour-highlights-heading">
                  <h2 id="tour-highlights-heading" className="place-detail-section-title">{t('detail', 'highlights')}</h2>
                  <ul className="detail-tip-list">
                    {tour.highlights.map((item, i) => (
                      <li key={i} className="detail-tip-card">{item}</li>
                    ))}
                  </ul>
                </section>
              )}

              {includes.length > 0 && (
                <section className="place-detail-section" aria-labelledby="tour-inc-heading">
                  <h2 id="tour-inc-heading" className="place-detail-section-title">{t('detail', 'tourIncludes')}</h2>
                  <div className="detail-chip-wrap detail-chip-wrap--success">
                    {includes.map((s, i) => (
                      <span key={i} className="detail-chip detail-chip--ok"><Icon name="check" size={16} /> {s}</span>
                    ))}
                  </div>
                </section>
              )}

              {excludes.length > 0 && (
                <section className="place-detail-section" aria-labelledby="tour-exc-heading">
                  <h2 id="tour-exc-heading" className="place-detail-section-title">{t('detail', 'tourExcludes')}</h2>
                  <div className="detail-chip-wrap detail-chip-wrap--muted">
                    {excludes.map((s, i) => (
                      <span key={i} className="detail-chip detail-chip--no"><Icon name="close" size={16} /> {s}</span>
                    ))}
                  </div>
                </section>
              )}

              {similarTours.length > 0 && (
                <section className="place-detail-section" aria-labelledby="tour-sim-heading">
                  <h2 id="tour-sim-heading" className="place-detail-section-title">{t('detail', 'tourSimilar')}</h2>
                  <div className="detail-similar-scroll">
                    {similarTours.map((st) => {
                      const simImg = getPlaceImageUrl(st.image);
                      return (
                        <Link key={st.id} to={`/tour/${st.id}`} className="detail-similar-card">
                          <div className="detail-similar-card-media">
                            {simImg ? <DeliveryImg url={simImg} preset="similarStrip" alt="" /> : null}
                          </div>
                          <span className="detail-similar-card-title">{st.name}</span>
                          {st.duration && <span className="detail-similar-card-meta">{st.duration}</span>}
                        </Link>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          )}

          {tab === 'map' && (
            <div className="detail-tab-panel" role="tabpanel">
              <p className="detail-map-intro">{t('detail', 'mapRouteIntro')}</p>
              <div className="place-detail-actions">
                <button type="button" className="place-detail-btn place-detail-btn--primary" onClick={openTourOnMap} disabled={!stopCount}>
                  <Icon name="map" size={20} /> {t('detail', 'viewOnMap')}
                </button>
              </div>
              {stopPlaces.length > 0 && (
                <ol className="detail-map-stop-list">
                  {stopPlaces.map((p, i) => (
                    <li key={String(p.id)}>
                      <span className="detail-map-stop-num">{i + 1}</span>
                      {p._missing ? (p.name || p.id) : <Link to={`/place/${p.id}`}>{p.name || p.id}</Link>}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          {tab === 'itinerary' && (
            <div className="detail-tab-panel" role="tabpanel">
              {itinerary.length > 0 ? (
                <ol className="detail-itinerary-full">
                  {itinerary.map((item, i) => (
                    <li key={i}>
                      <ItineraryStepContent item={item} />
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="detail-empty-tab">{t('detail', 'tourNoItinerary')}</p>
              )}
            </div>
          )}

          <footer className="place-detail-footer">
            <p className="place-detail-footer-notice">{t('detail', 'footerNotice')}</p>
          </footer>
        </article>
      </div>
    </div>
  );
}
