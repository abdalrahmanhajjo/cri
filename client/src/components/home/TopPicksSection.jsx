import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getPlaceImageUrl } from '../../api/client';
import DeliveryImg from '../DeliveryImg';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFavourites } from '../../context/FavouritesContext';
import Icon from '../Icon';

export default function TopPicksSection({ places, t, moreTo }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { isFavourite, toggleFavourite: commitFavouriteToggle } = useFavourites();

  const safePlaces = Array.isArray(places) ? places : [];
  const [index, setIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const carouselRef = useRef(null);

  useEffect(() => {
    const el = carouselRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return setIsVisible(true);
    const obs = new IntersectionObserver(([e]) => setIsVisible(e.isIntersecting), { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (safePlaces.length <= 1 || !isVisible) return;
    const id = setInterval(() => setIndex(i => (i + 1) % safePlaces.length), 10000);
    return () => clearInterval(id);
  }, [safePlaces.length, isVisible]);

  useEffect(() => {
    setIndex(i => (safePlaces.length ? Math.min(i, safePlaces.length - 1) : 0));
  }, [safePlaces.length]);

  const handlePrev = useCallback((e) => {
    e?.preventDefault();
    setIndex(i => (i - 1 + safePlaces.length) % safePlaces.length);
  }, [safePlaces.length]);

  const handleNext = useCallback((e) => {
    e?.preventDefault();
    setIndex(i => (i + 1) % safePlaces.length);
  }, [safePlaces.length]);

  const onCarouselKeyDown = useCallback((e) => {
    if (safePlaces.length <= 1) return;
    if (e.key === 'ArrowRight') handleNext(e);
    else if (e.key === 'ArrowLeft') handlePrev(e);
    else if (e.key === 'Home') { e.preventDefault(); setIndex(0); }
    else if (e.key === 'End') { e.preventDefault(); setIndex(safePlaces.length - 1); }
  }, [safePlaces.length, handleNext, handlePrev]);

  const toggleFavourite = useCallback(async (e, placeId) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return navigate('/login', { state: { from: 'favourite' } });
    if (!placeId) return;

    const r = await commitFavouriteToggle(String(placeId));
    if (r.reason === 'auth') return navigate('/login', { state: { from: 'favourite' } });
    if (!r.ok) return r.reason !== 'busy' && showToast(t('feedback', 'favouriteUpdateFailed'), 'error');

    showToast(t('feedback', r.added ? 'favouriteAdded' : 'favouriteRemoved'), 'success');
  }, [user, commitFavouriteToggle, navigate, showToast, t]);

  if (!safePlaces.length) return null;

  return (
    <section className="vd-section vd-top-picks">
      <div className="vd-container">
        <header className="vd-top-picks-header">
          <div className="vd-top-picks-header-row">
            <div className="vd-top-picks-heading-text">
              <h2 className="vd-top-picks-title">{t('home', 'topPicks')}</h2>
              <p className="vd-top-picks-subtitle">{t('home', 'topPicksSub')}</p>
            </div>
            {moreTo && (
              <Link to={moreTo} className="vd-community-feed-more">
                {t('discover', 'seeAllDiscover')} <Icon name="arrow_forward" size={18} />
              </Link>
            )}
          </div>
        </header>

        <div
          ref={carouselRef}
          className="vd-top-picks-carousel"
          tabIndex={0}
          role="region"
          aria-roledescription="carousel"
          aria-label={t('home', 'topPicksCarouselLabel')}
          onKeyDown={onCarouselKeyDown}
        >
          <div
            className="vd-top-picks-track"
            style={{ transform: `translateX(calc(-${index} * (100% + 24px)))`, gap: '24px', direction: 'ltr' }}
          >
            {safePlaces.map((p, slideIndex) => {
              if (!p?.id) return null;
              const placeId = String(p.id);
              const safeImg = getPlaceImageUrl(p.image || p.images?.[0]) || null;
              const name = String(p.name || '');
              const desc = String(p.description || '');
              const rating = Number.isFinite(Number(p.rating)) && Number(p.rating) > 0 ? Number(p.rating) : null;
              const isFav = isFavourite(placeId);
              const heartAria = user ? t('home', isFav ? 'removeFromFavourites' : 'addToFavourites') : t('home', 'signInToSave');
              const titleId = `vd-top-picks-title-${placeId}`;

              return (
                <article key={placeId} className="vd-top-picks-card vd-top-picks-card--split-hit">
                  <Link to={`/place/${placeId}`} className="vd-top-picks-card-bg vd-top-picks-card-bg--hit" tabIndex={-1} aria-hidden="true">
                    {safeImg ? (
                      <DeliveryImg url={safeImg} preset="topPicks" alt="" loading={slideIndex === 0 ? 'eager' : 'lazy'} fetchPriority={slideIndex === 0 ? 'high' : undefined} />
                    ) : <span className="vd-top-picks-fallback">{t('home', 'place')}</span>}
                  </Link>
                  <div className="vd-top-picks-card-body">
                    <div className="vd-top-picks-card-content">
                      <Link to={`/place/${placeId}`} className="vd-top-picks-card-text-hit" aria-labelledby={titleId} aria-describedby={desc ? `${titleId}-desc` : undefined}>
                        <span className="vd-top-picks-eyebrow">{t('home', 'topPickEyebrow')}</span>
                        <h3 id={titleId} className="vd-top-picks-name">{name}</h3>
                        {desc && <p id={`${titleId}-desc`} className="vd-top-picks-desc">{desc}</p>}
                        <div className="vd-top-picks-details">
                          {rating && <span className="vd-top-picks-detail vd-top-picks-detail--rating"><Icon name="star" size={16} /> {rating.toFixed(1)}</span>}
                        </div>
                      </Link>
                    </div>
                    <div className="vd-top-picks-glass-footer">
                      <div className="vd-top-picks-cta-row">
                        <Link to={`/place/${placeId}`} className="vd-top-picks-read-now">
                          {t('home', 'topPicksReadMore')} <Icon name="arrow_forward" size={18} className="vd-btn-arrow" />
                        </Link>
                        <div className="vd-top-picks-card-floating-actions">
                          <button
                            type="button"
                            className={`vd-top-picks-action-btn vd-top-picks-action-btn--heart ${isFav ? 'vd-top-picks-action-btn--active' : ''}`}
                            onClick={(e) => toggleFavourite(e, placeId)}
                            aria-label={heartAria}
                          >
                            <Icon name={isFav ? 'favorite' : 'favorite_border'} size={24} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {safePlaces.length > 1 && (
            <div className="vd-top-picks-nav" aria-hidden="true">
              <button type="button" className="vd-top-picks-arrow vd-top-picks-arrow--prev" onClick={handlePrev} aria-label={t('home', 'prevSlide')}><Icon name="chevron_left" size={28} /></button>
              <button type="button" className="vd-top-picks-arrow vd-top-picks-arrow--next" onClick={handleNext} aria-label={t('home', 'nextSlide')}><Icon name="chevron_right" size={28} /></button>
            </div>
          )}
        </div>

        <footer className="vd-top-picks-carousel-footer">
          <div className="vd-top-picks-counter">
            <span className="vd-top-picks-counter-label">{t('home', 'topPicksCounterLabel')}</span>
            <div className="vd-top-picks-counter-nums">
              <span className="vd-top-picks-counter-current">{String(index + 1).padStart(2, '0')}</span>
              <span className="vd-top-picks-counter-sep">/</span>
              <span className="vd-top-picks-counter-total">{String(safePlaces.length).padStart(2, '0')}</span>
            </div>
          </div>
          <div className="vd-top-picks-dots" role="tablist">
            {safePlaces.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={t('home', 'goToSlide').replace('{n}', i + 1)}
                className={`vd-top-picks-dot ${i === index ? 'vd-top-picks-dot--active' : ''}`}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
        </footer>
      </div>
    </section>
  );
}
