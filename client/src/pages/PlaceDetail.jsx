import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import api from '../api/client';
import Icon from '../components/Icon';
import OfferCard from '../components/OfferCard';
import { getPlaceImageUrl } from '../api/client';
import { getDeliveryImgProps } from '../utils/responsiveImages.js';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { discoverPlaceFeedPath } from '../utils/discoverPaths';
import './Detail.css';

/** Resolved, unique image URLs for gallery (primary `image` + `images[]`). */
function collectPlaceImageUrls(place) {
  if (!place) return [];
  const raw = [];
  if (place.image) raw.push(place.image);
  if (Array.isArray(place.images)) raw.push(...place.images);
  const urls = [];
  const seen = new Set();
  for (const item of raw) {
    const u = getPlaceImageUrl(item);
    if (u && !seen.has(u)) {
      seen.add(u);
      urls.push(u);
    }
  }
  return urls;
}

function formatReviewDate(iso, lang) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const locale = lang === 'ar' ? 'ar-LB' : lang === 'fr' ? 'fr-LB' : 'en-GB';
  return d.toLocaleDateString(locale, { dateStyle: 'medium' });
}

function placeHasGpsForCheckin(place) {
  const c =
    place?.coordinates ||
    (place?.latitude != null && place?.longitude != null
      ? { lat: Number(place.latitude), lng: Number(place.longitude) }
      : null);
  return !!(c && Number.isFinite(c.lat) && Number.isFinite(c.lng));
}

function InfoRow({ icon, label, value }) {
  if (value == null || value === '') return null;
  return (
    <div className="place-detail-info-row">
      <span className="place-detail-info-icon" aria-hidden="true">
        <Icon name={icon} size={20} />
      </span>
      <div className="place-detail-info-content">
        <span className="place-detail-info-label">{label}</span>
        <span className="place-detail-info-value">{value}</span>
      </div>
    </div>
  );
}

export default function PlaceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const [place, setPlace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFavourite, setIsFavourite] = useState(false);
  const [copyToast, setCopyToast] = useState(false);
  const [promotions, setPromotions] = useState([]);
  const [redeemedPromotionIds, setRedeemedPromotionIds] = useState([]);
  const [checkinMsg, setCheckinMsg] = useState(null);
  const [checkinBusy, setCheckinBusy] = useState(false);
  const [inquiryIntent, setInquiryIntent] = useState('general');
  const [inqMessage, setInqMessage] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [inqStatus, setInqStatus] = useState(null);
  const [inqSending, setInqSending] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [placeReviews, setPlaceReviews] = useState([]);
  const [placeReviewsLoading, setPlaceReviewsLoading] = useState(false);
  const [placeReviewsError, setPlaceReviewsError] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewBody, setReviewBody] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewMsg, setReviewMsg] = useState(null);
  const [reviewsOpen, setReviewsOpen] = useState(false);

  const myReview = useMemo(() => placeReviews.find((r) => r.isYours), [placeReviews]);

  useEffect(() => {
    if (myReview) {
      setReviewRating(myReview.rating);
      setReviewTitle(myReview.title || '');
      setReviewBody(myReview.review || '');
    } else if (user) {
      setReviewRating(5);
      setReviewTitle('');
      setReviewBody('');
    }
  }, [myReview?.id, myReview?.rating, myReview?.title, myReview?.review, user]);

  useEffect(() => {
    setReviewsOpen(false);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setPlaceReviewsLoading(true);
    setPlaceReviewsError(false);
    api.places
      .reviews(id)
      .then((r) => {
        if (!cancelled) setPlaceReviews(Array.isArray(r.reviews) ? r.reviews : []);
      })
      .catch(() => {
        if (!cancelled) {
          setPlaceReviews([]);
          setPlaceReviewsError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setPlaceReviewsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.places
      .get(id, { lang })
      .then((p) => {
        if (!cancelled) {
          setPlace(p);
          if (p?.name) document.title = `${p.name} | Visit Tripoli`;
        }
      })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => {
      cancelled = true;
      document.title = 'Visit Tripoli';
    };
  }, [id, lang]);

  const galleryUrls = useMemo(() => collectPlaceImageUrls(place), [place]);

  useEffect(() => {
    setGalleryIndex(0);
    setLightboxOpen(false);
  }, [id, place?.id]);

  useEffect(() => {
    if (!lightboxOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setLightboxOpen(false);
      if (galleryUrls.length < 2) return;
      if (e.key === 'ArrowLeft') {
        setLightboxIndex((i) => (i - 1 + galleryUrls.length) % galleryUrls.length);
      }
      if (e.key === 'ArrowRight') {
        setLightboxIndex((i) => (i + 1) % galleryUrls.length);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxOpen, galleryUrls.length]);

  useEffect(() => {
    if (!user) {
      setRedeemedPromotionIds([]);
      return undefined;
    }
    let cancelled = false;
    api.coupons
      .redeemed()
      .then((r) => {
        if (cancelled) return;
        const cids = Array.isArray(r.couponIds) ? r.couponIds.map((cid) => `coupon-${cid}`) : [];
        const pids = Array.isArray(r.placePromotionIds)
          ? r.placePromotionIds.map((id) => `promo-${id}`)
          : [];
        setRedeemedPromotionIds([...cids, ...pids]);
      })
      .catch(() => {
        if (!cancelled) setRedeemedPromotionIds([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (user?.email) setGuestEmail(user.email);
  }, [user?.email]);

  useEffect(() => {
    if (!id) {
      setPromotions([]);
      return;
    }
    let cancelled = false;
    api.places
      .promotions(id, { lang })
      .then((r) => {
        if (!cancelled) setPromotions(Array.isArray(r.promotions) ? r.promotions : []);
      })
      .catch(() => {
        if (!cancelled) setPromotions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [id, lang]);

  useEffect(() => {
    if (loading || !place) return;
    if (location.hash !== '#place-proposal') return;
    const el = document.getElementById('place-proposal');
    if (el) requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [loading, place, location.hash]);

  useEffect(() => {
    if (!user || !place) {
      setIsFavourite(false);
      return;
    }
    api.user
      .favourites()
      .then((res) => {
        const ids = new Set((Array.isArray(res.placeIds) ? res.placeIds : []).map(String));
        setIsFavourite(ids.has(String(place.id)));
      })
      .catch(() => setIsFavourite(false));
  }, [user, place]);

  const toggleFavourite = useCallback(() => {
    if (!user) {
      navigate('/login', { state: { from: 'place' } });
      return;
    }
    if (!place) return;
    const placeId = String(place.id);
    if (isFavourite) {
      api.user.removeFavourite(placeId).catch(() => {});
      setIsFavourite(false);
    } else {
      api.user.addFavourite(placeId).catch(() => {});
      setIsFavourite(true);
    }
  }, [user, place, isFavourite, navigate]);

  const handleShare = useCallback(() => {
    if (typeof navigator !== 'undefined' && navigator.share && place) {
      navigator.share({
        title: place.name,
        text: place.description || place.name,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(window.location.href).then(() => {
        setCopyToast(true);
        setTimeout(() => setCopyToast(false), 2000);
      }).catch(() => {});
    }
  }, [place]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleCheckIn = useCallback(() => {
    if (!place) return;
    if (!user) {
      navigate('/login', { state: { from: 'place' } });
      return;
    }
    setCheckinMsg(null);

    const run = (lat, lng) => {
      const body = {};
      if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
        body.latitude = lat;
        body.longitude = lng;
      }
      return api.places
        .checkin(place.id, body)
        .then((r) => {
          setCheckinMsg(
            r.alreadyCheckedInToday ? t('detail', 'checkInAlreadyToday') : t('detail', 'checkInSuccess')
          );
        })
        .catch((e) => {
          const code = e?.data?.code;
          if (code === 'LOCATION_REQUIRED') setCheckinMsg(t('detail', 'checkInNeedLocation'));
          else if (code === 'TOO_FAR') setCheckinMsg(t('detail', 'checkInTooFar'));
          else setCheckinMsg(e.message || t('detail', 'checkInFailed'));
        });
    };

    const needsGeo = placeHasGpsForCheckin(place);
    if (!needsGeo) {
      setCheckinBusy(true);
      run()
        .finally(() => setCheckinBusy(false));
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setCheckinMsg(t('detail', 'checkInNeedLocation'));
      return;
    }

    setCheckinBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        run(pos.coords.latitude, pos.coords.longitude).finally(() => setCheckinBusy(false));
      },
      () => {
        setCheckinBusy(false);
        setCheckinMsg(t('detail', 'checkInNeedLocation'));
      },
      { enableHighAccuracy: true, timeout: 18000, maximumAge: 0 }
    );
  }, [place, user, navigate, t]);

  const submitInquiry = useCallback(
    (e) => {
      e.preventDefault();
      if (!place) return;
      const msg = inqMessage.trim();
      if (msg.length < 3) return;
      const phone = guestPhone.trim();
      if ((phone.match(/\d/g) || []).length < 8) return;
      setInqSending(true);
      setInqStatus(null);
      const body = user
        ? {
            message: msg,
            intent: inquiryIntent,
            guestEmail: guestEmail.trim(),
            guestPhone: phone,
          }
        : {
            message: msg,
            intent: inquiryIntent,
            guestName: guestName.trim(),
            guestEmail: guestEmail.trim(),
            guestPhone: phone,
          };
      api.places
        .inquiry(place.id, body)
        .then(() => {
          setInqStatus('sent');
          setInqMessage('');
          setGuestName('');
          setGuestPhone('');
          if (user?.email) setGuestEmail(user.email);
          else setGuestEmail('');
        })
        .catch((err) => setInqStatus(err.message || 'Could not send'))
        .finally(() => setInqSending(false));
    },
    [place, user, inqMessage, guestName, guestEmail, guestPhone, inquiryIntent]
  );

  const submitSiteReview = useCallback(
    async (e) => {
      e.preventDefault();
      if (!user || !place || !id) return;
      const text = reviewBody.trim();
      if (text.length > 0 && text.length < 4) {
        setReviewMsg({ type: 'err', text: t('detail', 'reviewMinText') });
        return;
      }
      setReviewSubmitting(true);
      setReviewMsg(null);
      try {
        await api.places.submitReview(place.id, {
          rating: reviewRating,
          title: reviewTitle.trim() || undefined,
          review: text || undefined,
        });
        const [p, revRes] = await Promise.all([
          api.places.get(id, { lang }),
          api.places.reviews(id),
        ]);
        setPlace(p);
        setPlaceReviews(Array.isArray(revRes.reviews) ? revRes.reviews : []);
        setReviewMsg({ type: 'ok', text: t('detail', 'reviewThanks') });
      } catch (err) {
        const code = err?.data?.code;
        const msg =
          code === 'REVIEW_HIDDEN'
            ? t('detail', 'reviewHiddenByModeration')
            : err?.message || t('detail', 'reviewSubmitFailed');
        setReviewMsg({ type: 'err', text: msg });
      } finally {
        setReviewSubmitting(false);
      }
    },
    [user, place, id, reviewBody, reviewRating, reviewTitle, t, lang]
  );

  const deleteMyReview = useCallback(async () => {
    if (!user || !place || !id || !myReview) return;
    if (!window.confirm(t('detail', 'reviewDeleteConfirm'))) return;
    setReviewSubmitting(true);
    setReviewMsg(null);
    try {
      await api.places.deleteReview(place.id, myReview.id);
      const [p, revRes] = await Promise.all([
        api.places.get(id, { lang }),
        api.places.reviews(id),
      ]);
      setPlace(p);
      setPlaceReviews(Array.isArray(revRes.reviews) ? revRes.reviews : []);
      setReviewMsg({ type: 'ok', text: t('detail', 'reviewDeleted') });
    } catch (err) {
      setReviewMsg({ type: 'err', text: err?.message || t('detail', 'reviewSubmitFailed') });
    } finally {
      setReviewSubmitting(false);
    }
  }, [user, place, id, myReview, t, lang]);

  const openLightbox = useCallback(
    (index) => {
      const n = galleryUrls.length;
      if (n < 1) return;
      const i = Math.min(Math.max(0, index), n - 1);
      setLightboxIndex(i);
      setLightboxOpen(true);
    },
    [galleryUrls.length]
  );

  const stepGallery = useCallback(
    (delta) => {
      if (galleryUrls.length < 2) return;
      setGalleryIndex((i) => (i + delta + galleryUrls.length) % galleryUrls.length);
    },
    [galleryUrls.length]
  );

  const stepLightbox = useCallback(
    (delta) => {
      if (galleryUrls.length < 2) return;
      setLightboxIndex((i) => (i + delta + galleryUrls.length) % galleryUrls.length);
    },
    [galleryUrls.length]
  );

  const openPlaceOnMap = useCallback(() => {
    if (!place?.id) return;
    const returnTo = `${location.pathname}${location.search}${location.hash || ''}`;
    if (!user) {
      navigate('/login', { state: { from: returnTo } });
      return;
    }
    const pid = String(place.id);
    navigate('/map', {
      state: {
        tripPlaceIds: [pid],
        tripDays: [{ placeIds: [pid] }],
        tripName: place.name,
      },
    });
  }, [place, user, navigate, location.pathname, location.search, location.hash]);

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

  if (error || !place) {
    return (
      <div className="place-detail place-detail--error">
        <div className="place-detail-container">
          <Link to="/" className="place-detail-back">
            <Icon name="arrow_back" size={20} /> {t('detail', 'backToExplore')}
          </Link>
          <div className="place-detail-error">
            <p>{t('detail', 'placeNotFound')}</p>
            <p className="place-detail-error-sub">{error || ''}</p>
          </div>
        </div>
      </div>
    );
  }

  const heroUrl = galleryUrls[galleryIndex] || null;
  const hasMultiGallery = galleryUrls.length > 1;

  const hours = place.hours;
  const hoursStr = typeof hours === 'string' ? hours : Array.isArray(hours) ? hours.join(' · ') : hours;

  return (
    <div className="place-detail">
      <div className="place-detail-container">
        <nav className="place-detail-breadcrumb" aria-label="Breadcrumb">
          <ol className="place-detail-breadcrumb-list">
            <li><Link to="/">{t('nav', 'home')}</Link></li>
            <li><Link to="/">{t('detail', 'discoverTripoli')}</Link></li>
            <li aria-current="page">{place.name}</li>
          </ol>
        </nav>

        <Link to="/" className="place-detail-back">
          <Icon name="arrow_back" size={20} /> {t('detail', 'backToExplore')}
        </Link>

        <article className="place-detail-article">
          <header className={`place-detail-hero ${hasMultiGallery ? 'place-detail-hero--gallery' : ''}`}>
            {heroUrl && (
              <img
                key={heroUrl}
                className="place-detail-hero__img"
                alt=""
                loading="eager"
                decoding="async"
                fetchPriority="high"
                {...getDeliveryImgProps(heroUrl, 'detailHero')}
              />
            )}
            {!heroUrl && (
              <div className="place-detail-hero-fallback">
                <Icon name="place" size={48} />
                <span>{t('detail', 'noImage')}</span>
              </div>
            )}
            <div className="place-detail-hero-overlay" />
            {hasMultiGallery && (
              <>
                <div className="place-detail-hero-gallery-bar" aria-label={t('detail', 'photoGalleryLabel')}>
                  <span className="place-detail-hero-gallery-count">
                    {galleryIndex + 1} / {galleryUrls.length}
                  </span>
                  <button
                    type="button"
                    className="place-detail-hero-gallery-open"
                    onClick={() => openLightbox(galleryIndex)}
                  >
                    <Icon name="photo_library" size={20} aria-hidden />
                    {t('detail', 'viewAllPhotos')}
                  </button>
                </div>
                <button
                  type="button"
                  className="place-detail-hero-nav place-detail-hero-nav--prev"
                  onClick={(e) => {
                    e.stopPropagation();
                    stepGallery(-1);
                  }}
                  aria-label={t('detail', 'previousPhoto')}
                >
                  <Icon name="chevron_left" size={28} aria-hidden />
                </button>
                <button
                  type="button"
                  className="place-detail-hero-nav place-detail-hero-nav--next"
                  onClick={(e) => {
                    e.stopPropagation();
                    stepGallery(1);
                  }}
                  aria-label={t('detail', 'nextPhoto')}
                >
                  <Icon name="chevron_right" size={28} aria-hidden />
                </button>
              </>
            )}
            <div className="place-detail-hero-badge">{t('detail', 'officialInfo')}</div>
            <div className="place-detail-hero-bottom">
              {hasMultiGallery && (
                <div className="place-detail-hero-thumbs" role="tablist" aria-label={t('detail', 'photoGalleryLabel')}>
                  {galleryUrls.map((url, i) => (
                    <button
                      key={`${url}-${i}`}
                      type="button"
                      role="tab"
                      aria-selected={i === galleryIndex}
                      className={`place-detail-hero-thumb ${i === galleryIndex ? 'place-detail-hero-thumb--on' : ''}`}
                      onClick={() => setGalleryIndex(i)}
                    >
                      <img alt="" loading="lazy" decoding="async" {...getDeliveryImgProps(url, 'thumb')} />
                    </button>
                  ))}
                </div>
              )}
              <div className="place-detail-hero-content">
                <h1 className="place-detail-title">{place.name}</h1>
                {place.location && (
                  <p className="place-detail-location">
                    <Icon name="location_on" size={18} /> {place.location}
                  </p>
                )}
                <div className="place-detail-hero-meta">
                  {place.rating != null && (
                    <span className="place-detail-rating">
                      <Icon name="star" size={18} /> {Number(place.rating).toFixed(1)}
                      {place.reviewCount != null && (
                        <span className="place-detail-reviews"> ({place.reviewCount} {t('detail', 'reviewsCount')})</span>
                      )}
                    </span>
                  )}
                  {place.category && <span className="place-detail-category">{place.category}</span>}
                </div>
              </div>
            </div>
          </header>

          <div className="place-detail-actions">
            <button type="button" className="place-detail-btn place-detail-btn--primary" onClick={openPlaceOnMap}>
              <Icon name="map" size={20} /> {t('detail', 'viewOnMap')}
            </button>
            <Link to={discoverPlaceFeedPath(place.id)} className="place-detail-btn place-detail-btn--secondary">
              <Icon name="dynamic_feed" size={20} /> {t('detail', 'allPostsPage')}
            </Link>
            <button
              type="button"
              className={`place-detail-btn place-detail-btn--icon ${isFavourite ? 'place-detail-btn--active' : ''}`}
              onClick={toggleFavourite}
              aria-label={isFavourite ? t('home', 'removeFromFavourites') : t('home', 'addToFavourites')}
            >
              <Icon name={isFavourite ? 'favorite' : 'favorite_border'} size={22} />
              <span className="place-detail-btn-label">{t('detail', 'saveToMyPlaces')}</span>
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
            <InfoRow icon="schedule" label={t('detail', 'openingHours')} value={hoursStr} />
            <InfoRow icon="location_on" label={t('detail', 'location')} value={place.location} />
            <InfoRow icon="category" label={t('detail', 'category')} value={place.category} />
            <InfoRow icon="wb_sunny" label={t('detail', 'bestTimeToVisit')} value={place.bestTime} />
            <InfoRow icon="schedule" label={t('detail', 'duration')} value={place.duration} />
            <InfoRow icon="payments" label={t('detail', 'priceRange')} value={place.price} />
          </div>

          {place.description && (
            <section className="place-detail-section" aria-labelledby="place-description-heading">
              <h2 id="place-description-heading" className="place-detail-section-title">{t('detail', 'description')}</h2>
              <div className="place-detail-description">
                {place.description.split(/\n\n+/).map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            </section>
          )}

          {place.tags && (Array.isArray(place.tags) ? place.tags.length > 0 : place.tags) && (
            <section className="place-detail-section place-detail-tags">
              <div className="place-detail-tags-list">
                {(Array.isArray(place.tags) ? place.tags : [place.tags]).map((tag, i) => (
                  <span key={i} className="place-detail-tag">{tag}</span>
                ))}
              </div>
            </section>
          )}

          <section id="place-proposal" className="place-detail-section place-detail-engage" aria-labelledby="place-engage-heading">
              <h2 id="place-engage-heading" className="place-detail-section-title">
                {t('detail', 'engageTitle')}
              </h2>
              {promotions.length > 0 && (
                <div className="offer-card-scope">
                  <div className="ig-offer-list">
                    {promotions.map((pr, i) => (
                      <OfferCard
                        key={pr.id}
                        item={pr}
                        index={i}
                        showPlaceLink={false}
                        t={t}
                        user={user}
                        redeemedPromotionIds={redeemedPromotionIds}
                        onRedeemed={(promoId) =>
                          setRedeemedPromotionIds((prev) => (prev.includes(promoId) ? prev : [...prev, promoId]))
                        }
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="place-detail-engage-block place-detail-reviews-box">
                <button
                  type="button"
                  id="place-reviews-heading"
                  className="place-detail-reviews-toggle"
                  aria-expanded={reviewsOpen}
                  aria-controls="place-reviews-panel"
                  onClick={() => setReviewsOpen((o) => !o)}
                >
                  <span className="place-detail-reviews-toggle-main">
                    <span className="place-detail-reviews-toggle-title">{t('detail', 'engageReviewsTitle')}</span>
                    {place.rating != null && (
                      <span className="place-detail-review-summary place-detail-review-summary--inline">
                        <Icon name="star" size={18} aria-hidden />
                        <span>{Number(place.rating).toFixed(1)}</span>
                        {place.reviewCount != null && (
                          <span className="place-detail-review-count">
                            ({place.reviewCount} {t('detail', 'reviewsCount')})
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                  <Icon name={reviewsOpen ? 'expand_less' : 'expand_more'} size={28} className="place-detail-reviews-toggle-icon" />
                  <span className="place-detail-sr-only">
                    {reviewsOpen ? t('detail', 'reviewsToggleHide') : t('detail', 'reviewsToggleShow')}
                  </span>
                </button>
                {reviewsOpen && (
                  <div
                    id="place-reviews-panel"
                    className="place-detail-reviews-panel"
                    role="region"
                    aria-labelledby="place-reviews-heading"
                  >
                    <p className="place-detail-engage-hint">{t('detail', 'reviewSiteHint')}</p>

                    {placeReviewsLoading && (
                      <p className="place-detail-engage-hint" aria-live="polite">
                        {t('detail', 'loading')}
                      </p>
                    )}
                    {placeReviewsError && !placeReviewsLoading && (
                      <p className="place-detail-error-inline" role="alert">
                        {t('detail', 'reviewsLoadError')}
                      </p>
                    )}
                    {!placeReviewsLoading && !placeReviewsError && placeReviews.length === 0 && (
                      <p className="place-detail-engage-hint">{t('detail', 'reviewsEmpty')}</p>
                    )}
                    {placeReviews.length > 0 && (
                      <ul className="place-detail-reviews-list">
                        {placeReviews.map((rev) => (
                          <li key={rev.id} className="place-detail-review-item">
                            <div className="place-detail-review-item-head">
                              <span className="place-detail-review-item-author">{rev.authorName}</span>
                              <span className="place-detail-review-item-head-right">
                                <time className="place-detail-review-item-date" dateTime={rev.createdAt || ''}>
                                  {formatReviewDate(rev.createdAt, lang)}
                                </time>
                                {rev.isYours && (
                                  <button
                                    type="button"
                                    className="place-detail-review-delete"
                                    onClick={deleteMyReview}
                                    disabled={reviewSubmitting}
                                  >
                                    {t('detail', 'reviewDeleteMyReview')}
                                  </button>
                                )}
                              </span>
                            </div>
                            <div className="place-detail-review-item-stars" aria-label={`${rev.rating} of 5`}>
                              {Array.from({ length: 5 }, (_, si) => (
                                <Icon
                                  key={si}
                                  name="star"
                                  size={18}
                                  className={si < rev.rating ? 'place-detail-review-star--on' : 'place-detail-review-star--off'}
                                />
                              ))}
                            </div>
                            {rev.title ? <p className="place-detail-review-item-title">{rev.title}</p> : null}
                            {rev.review ? <p className="place-detail-review-item-text">{rev.review}</p> : null}
                          </li>
                        ))}
                      </ul>
                    )}

                    {user ? (
                      <form className="place-detail-review-form" onSubmit={submitSiteReview}>
                        {myReview && (
                          <p className="place-detail-engage-hint place-detail-review-editing-hint">{t('detail', 'reviewEditingYours')}</p>
                        )}
                        <p className="place-detail-form-label">{t('detail', 'reviewYourRating')}</p>
                        <div className="place-detail-star-input" role="radiogroup" aria-label={t('detail', 'reviewYourRating')}>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button
                              key={n}
                              type="button"
                              role="radio"
                              aria-checked={reviewRating === n}
                              className={`place-detail-star-btn ${n <= reviewRating ? 'place-detail-star-btn--on' : ''}`}
                              onClick={() => setReviewRating(n)}
                            >
                              <Icon name="star" size={26} aria-hidden />
                              <span className="place-detail-sr-only">{n}</span>
                            </button>
                          ))}
                        </div>
                        <label className="place-detail-review-field">
                          <span>{t('detail', 'reviewTitleOptional')}</span>
                          <input
                            type="text"
                            value={reviewTitle}
                            onChange={(e) => setReviewTitle(e.target.value)}
                            maxLength={200}
                            autoComplete="off"
                          />
                        </label>
                        <label className="place-detail-review-field">
                          <span>{t('detail', 'reviewTextLabel')}</span>
                          <span className="place-detail-field-hint">{t('detail', 'reviewTextOptional')}</span>
                          <textarea
                            value={reviewBody}
                            onChange={(e) => setReviewBody(e.target.value)}
                            rows={4}
                            maxLength={8000}
                          />
                        </label>
                        <button
                          type="submit"
                          className="place-detail-btn place-detail-btn--primary"
                          disabled={reviewSubmitting}
                        >
                          <Icon name="rate_review" size={20} aria-hidden />
                          {reviewSubmitting
                            ? t('detail', 'reviewUpdating')
                            : myReview
                              ? t('detail', 'reviewUpdate')
                              : t('detail', 'reviewSubmit')}
                        </button>
                        {reviewMsg?.type === 'ok' && (
                          <p className="place-detail-toast-inline" role="status">
                            {reviewMsg.text}
                          </p>
                        )}
                        {reviewMsg?.type === 'err' && (
                          <p className="place-detail-error-inline" role="alert">
                            {reviewMsg.text}
                          </p>
                        )}
                      </form>
                    ) : (
                      <p className="place-detail-engage-hint">
                        <Link to="/login" state={{ from: location.pathname }}>
                          {t('detail', 'reviewLoginPrompt')}
                        </Link>
                      </p>
                    )}
                  </div>
                )}
              </div>

              {user && (
                <div className="place-detail-engage-block place-detail-checkin">
                  <h3 className="place-detail-engage-subtitle">{t('detail', 'checkInTitle')}</h3>
                  <p className="place-detail-engage-hint">{t('detail', 'checkInHint')}</p>
                  <button
                    type="button"
                    className="place-detail-btn place-detail-btn--secondary"
                    onClick={handleCheckIn}
                    disabled={checkinBusy}
                  >
                    <Icon name="pin_drop" size={20} />{' '}
                    {checkinBusy ? t('detail', 'checkInGettingLocation') : t('detail', 'checkIn')}
                  </button>
                  {checkinMsg && <p className="place-detail-toast-inline" role="status">{checkinMsg}</p>}
                </div>
              )}
              <form className="place-detail-inquiry" onSubmit={submitInquiry}>
                <h3 className="place-detail-engage-subtitle">{t('detail', 'engageContactTitle')}</h3>
                <div className="place-detail-intent-tabs" role="tablist" aria-label={t('detail', 'engageContactTitle')}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={inquiryIntent === 'booking'}
                    className={`place-detail-intent-tab ${inquiryIntent === 'booking' ? 'place-detail-intent-tab--on' : ''}`}
                    onClick={() => setInquiryIntent('booking')}
                  >
                    {t('detail', 'intentBooking')}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={inquiryIntent === 'general'}
                    className={`place-detail-intent-tab ${inquiryIntent === 'general' ? 'place-detail-intent-tab--on' : ''}`}
                    onClick={() => setInquiryIntent('general')}
                  >
                    {t('detail', 'intentGeneral')}
                  </button>
                </div>
                <p className="place-detail-inquiry-lead">
                  {inquiryIntent === 'booking' ? t('detail', 'inquiryBookingLead') : t('detail', 'inquiryGeneralLead')}
                </p>
                {!user && (
                  <div className="place-detail-inquiry-row">
                    <label className="place-detail-inquiry-field">
                      <span>{t('detail', 'yourName')}</span>
                      <input
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        required={!user}
                        autoComplete="name"
                      />
                    </label>
                    <label className="place-detail-inquiry-field">
                      <span>{t('detail', 'yourEmail') !== 'yourEmail' ? t('detail', 'yourEmail') : 'Email'}</span>
                      <input
                        type="email"
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                        required={!user}
                        autoComplete="email"
                      />
                    </label>
                  </div>
                )}
                {user && (
                  <div className="place-detail-inquiry-row">
                    <label className="place-detail-inquiry-field">
                      <span>{t('detail', 'yourEmail') !== 'yourEmail' ? t('detail', 'yourEmail') : 'Email'}</span>
                      <input
                        type="email"
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                        required
                        autoComplete="email"
                      />
                    </label>
                    <label className="place-detail-inquiry-field">
                      <span>{t('detail', 'mobilePhone') !== 'mobilePhone' ? t('detail', 'mobilePhone') : 'Mobile'}</span>
                      <input
                        type="tel"
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value)}
                        required
                        autoComplete="tel"
                        inputMode="tel"
                      />
                    </label>
                  </div>
                )}
                {!user && (
                  <label className="place-detail-inquiry-field place-detail-inquiry-field--full">
                    <span>{t('detail', 'mobilePhone') !== 'mobilePhone' ? t('detail', 'mobilePhone') : 'Mobile phone'}</span>
                    <input
                      type="tel"
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      required
                      autoComplete="tel"
                      inputMode="tel"
                    />
                  </label>
                )}
                <label className="place-detail-inquiry-field place-detail-inquiry-field--full">
                  <span>{t('detail', 'message') !== 'message' ? t('detail', 'message') : 'Message'}</span>
                  <textarea
                    value={inqMessage}
                    onChange={(e) => setInqMessage(e.target.value)}
                    rows={4}
                    required
                    maxLength={8000}
                    placeholder={
                      inquiryIntent === 'booking'
                        ? t('detail', 'inquiryBookingPlaceholder')
                        : t('detail', 'inquiryGeneralPlaceholder')
                    }
                  />
                </label>
                <button
                  type="submit"
                  className="place-detail-btn place-detail-btn--primary"
                  disabled={
                    inqSending ||
                    inqMessage.trim().length < 3 ||
                    (guestPhone.trim().match(/\d/g) || []).length < 8
                  }
                >
                  {inqSending ? '…' : t('detail', 'sendMessage')}
                </button>
                {inqStatus === 'sent' && (
                  <p className="place-detail-toast-inline" role="status">
                    {t('detail', 'inquirySent')}
                  </p>
                )}
                {inqStatus && inqStatus !== 'sent' && <p className="place-detail-error-inline">{inqStatus}</p>}
              </form>
          </section>

          <footer className="place-detail-footer">
            <p className="place-detail-footer-notice">{t('detail', 'footerNotice')}</p>
          </footer>
          {copyToast && (
            <div className="place-detail-toast" role="status">
              {t('detail', 'linkCopied') || 'Link copied!'}
            </div>
          )}

          {lightboxOpen && galleryUrls.length > 0 && (
            <div
              className="place-detail-lightbox"
              role="dialog"
              aria-modal="true"
              aria-label={t('detail', 'photoGalleryLabel')}
              onClick={() => setLightboxOpen(false)}
            >
              <button
                type="button"
                className="place-detail-lightbox-close"
                onClick={() => setLightboxOpen(false)}
                aria-label={t('detail', 'closeGallery')}
              >
                <Icon name="close" size={28} aria-hidden />
              </button>
              {galleryUrls.length > 1 && (
                <>
                  <button
                    type="button"
                    className="place-detail-lightbox-nav place-detail-lightbox-nav--prev"
                    onClick={(e) => {
                      e.stopPropagation();
                      stepLightbox(-1);
                    }}
                    aria-label={t('detail', 'previousPhoto')}
                  >
                    <Icon name="chevron_left" size={36} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="place-detail-lightbox-nav place-detail-lightbox-nav--next"
                    onClick={(e) => {
                      e.stopPropagation();
                      stepLightbox(1);
                    }}
                    aria-label={t('detail', 'nextPhoto')}
                  >
                    <Icon name="chevron_right" size={36} aria-hidden />
                  </button>
                </>
              )}
              <div className="place-detail-lightbox-stage" onClick={(e) => e.stopPropagation()}>
                <img
                  src={galleryUrls[lightboxIndex]}
                  alt=""
                  className="place-detail-lightbox-img"
                />
                {galleryUrls.length > 1 && (
                  <p className="place-detail-lightbox-count">
                    {lightboxIndex + 1} / {galleryUrls.length}
                  </p>
                )}
              </div>
            </div>
          )}
        </article>
      </div>
    </div>
  );
}
