import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import api, { getPlaceImageUrl } from '../api/client';
import Icon from '../components/Icon';
import PlaceDetailMap from '../components/PlaceDetailMap';
import OfferCard from '../components/OfferCard';
import { getDeliveryImgProps } from '../utils/responsiveImages.js';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useFavourites } from '../context/FavouritesContext';
import { useToast } from '../context/ToastContext';
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
  const c = getPlaceCoordinates(place);
  return !!(c && Number.isFinite(c.lat) && Number.isFinite(c.lng));
}

function getPlaceCoordinates(place) {
  return place?.coordinates ||
    (place?.latitude != null && place?.longitude != null
      ? { lat: Number(place.latitude), lng: Number(place.longitude) }
      : null);
}



function titleizeTokens(value) {
  return String(value || '')
    .split(/[_-]+/)
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join(' ');
}


function normalizeHoursEntries(hours) {
  if (!hours || typeof hours !== 'object' || Array.isArray(hours)) return [];
  const labels = {
    mon: 'Mon',
    tue: 'Tue',
    wed: 'Wed',
    thu: 'Thu',
    fri: 'Fri',
    sat: 'Sat',
    sun: 'Sun',
  };
  return Object.entries(hours)
    .map(([key, value]) => ({
      key,
      label: labels[key] || titleizeTokens(key),
      value: String(value || '').trim(),
    }))
    .filter((item) => item.value);
}

function LiveStatus({ hours, t }) {
  if (!hours || typeof hours !== 'object' || Array.isArray(hours)) return null;

  const weekdayMap = {
    Sunday: 'sun',
    Monday: 'mon',
    Tuesday: 'tue',
    Wednesday: 'wed',
    Thursday: 'thu',
    Friday: 'fri',
    Saturday: 'sat',
  };

  const now = new Date();
  const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });
  const dayKey = weekdayMap[weekday];
  const todayHoursRaw = (dayKey && hours[dayKey]) || hours[weekday] || '';
  const todayHours = String(todayHoursRaw || '').trim();

  if (!todayHours) {
    return (
      <span className="place-status place-status--unknown">
        {t('detail', 'statusUnknown') || 'Hours N/A'}
      </span>
    );
  }

  const rangeParts = todayHours.split(/\s*[–-]\s*/);
  if (rangeParts.length < 2) {
    return (
      <span className="place-status place-status--unknown">
        {todayHours}
      </span>
    );
  }

  const parseClock = (value) => {
    const match = String(value || '').trim().match(/^(\d{1,2})(?::(\d{2}))?$/);
    if (!match) return null;
    const hh = Number(match[1]);
    const mm = Number(match[2] || '0');
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
    return hh * 60 + mm;
  };

  const start = parseClock(rangeParts[0]);
  const end = parseClock(rangeParts[1]);
  if (start == null || end == null) {
    return (
      <span className="place-status place-status--unknown">
        {todayHours}
      </span>
    );
  }

  const current = now.getHours() * 60 + now.getMinutes();
  const closesNextDay = end <= start;
  const open =
    closesNextDay
      ? current >= start || current < end
      : current >= start && current < end;

  return (
    <span className={`place-status ${open ? 'place-status--open' : 'place-status--closed'}`}>
      {open ? (t('detail', 'openNow') || 'Open now') : (t('detail', 'closedNow') || 'Closed now')}
    </span>
  );
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
  const { isFavourite: isSavedPlace, isBusy: isFavouriteActionBusy, toggleFavourite: commitFavouriteToggle } =
    useFavourites();
  const { showToast } = useToast();
  const [place, setPlace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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

  const isFavourite = Boolean(place && user && isSavedPlace(place.id));
  const favouriteBusy = Boolean(place && isFavouriteActionBusy(place.id));

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
    if (!place) return;
    setInquiryIntent('general');
  }, [place?.id, place?.category, place?.categoryId, place?.tags]);

  const toggleFavourite = useCallback(async () => {
    if (!user) {
      navigate('/login', { state: { from: 'place' } });
      return;
    }
    if (!place || favouriteBusy) return;
    const placeId = String(place.id);
    const r = await commitFavouriteToggle(placeId);
    if (r.reason === 'auth') {
      navigate('/login', { state: { from: 'place' } });
      return;
    }
    if (!r.ok) {
      if (r.reason === 'busy') return;
      showToast(t('feedback', 'favouriteUpdateFailed'), 'error');
      return;
    }
    showToast(t('feedback', r.added ? 'favouriteAdded' : 'favouriteRemoved'), 'success');
  }, [user, place, favouriteBusy, commitFavouriteToggle, navigate, showToast, t]);

  const handleShare = useCallback(() => {
    if (typeof navigator !== 'undefined' && navigator.share && place) {
      navigator
        .share({
          title: place.name,
          text: place.description || place.name,
          url: window.location.href,
        })
        .then(() => showToast(t('feedback', 'tripShareOpened'), 'success'))
        .catch(() => {});
    } else {
      navigator.clipboard
        ?.writeText(window.location.href)
        .then(() => {
          setCopyToast(true);
          setTimeout(() => setCopyToast(false), 2000);
          showToast(t('feedback', 'linkCopied'), 'success');
        })
        .catch(() => showToast(t('feedback', 'actionFailed'), 'error'));
    }
  }, [place, showToast, t]);

  const handlePrint = useCallback(() => {
    showToast(t('feedback', 'printDialog'), 'info');
    window.print();
  }, [showToast, t]);

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
          showToast(
            r.alreadyCheckedInToday ? t('detail', 'checkInAlreadyToday') : t('feedback', 'checkInDone'),
            r.alreadyCheckedInToday ? 'info' : 'success'
          );
        })
        .catch((e) => {
          const code = e?.data?.code;
          if (code === 'LOCATION_REQUIRED') {
            setCheckinMsg(t('detail', 'checkInNeedLocation'));
            return;
          }
          if (code === 'TOO_FAR') {
            setCheckinMsg(t('detail', 'checkInTooFar'));
            return;
          }
          const msg = e.message || t('detail', 'checkInFailed');
          setCheckinMsg(msg);
          showToast(msg, 'error');
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
  }, [place, user, navigate, t, showToast]);

  const submitInquiry = useCallback(
    (e) => {
      e.preventDefault();
      if (!place) return;
      const msg = inqMessage.trim();
      if (msg.length < 3) return;
      const phone = guestPhone.trim();
      if ((phone.match(/\d/g) || []).length < 8) return;
      const em = guestEmail.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em) && !(user && !em)) {
        setInqStatus(t('discover', 'proposalNeedEmail'));
        showToast(t('discover', 'proposalNeedEmail'), 'error');
        return;
      }
      if (!user && guestName.trim().length < 2) {
        setInqStatus(t('discover', 'proposalNeedName'));
        showToast(t('discover', 'proposalNeedName'), 'error');
        return;
      }
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
          showToast(t('feedback', 'inquirySent'), 'success');
        })
        .catch((err) => {
          if (err?.data?.code === 'MESSAGING_BLOCKED') {
            setInqStatus(t('discover', 'messagingBlockedByVenue'));
            showToast(t('discover', 'messagingBlockedByVenue'), 'error');
          } else {
            setInqStatus(err.message || 'Could not send');
            showToast(t('feedback', 'inquiryFailed'), 'error');
          }
        })
        .finally(() => setInqSending(false));
    },
    [place, user, inqMessage, guestName, guestEmail, guestPhone, inquiryIntent, showToast, t]
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
        showToast(t('feedback', 'reviewSaved'), 'success');
      } catch (err) {
        const code = err?.data?.code;
        const msg =
          code === 'REVIEW_HIDDEN'
            ? t('detail', 'reviewHiddenByModeration')
            : err?.message || t('detail', 'reviewSubmitFailed');
        setReviewMsg({ type: 'err', text: msg });
        showToast(t('feedback', 'reviewFailed'), 'error');
      } finally {
        setReviewSubmitting(false);
      }
    },
    [user, place, id, reviewBody, reviewRating, reviewTitle, t, lang, showToast]
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
      showToast(t('feedback', 'reviewDeleted'), 'success');
    } catch (err) {
      setReviewMsg({ type: 'err', text: err?.message || t('detail', 'reviewSubmitFailed') });
      showToast(t('feedback', 'reviewFailed'), 'error');
    } finally {
      setReviewSubmitting(false);
    }
  }, [user, place, id, myReview, t, lang, showToast]);

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

  const mapCoords = useMemo(() => getPlaceCoordinates(place), [place]);

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
          <Link to="/discover" className="place-detail-back">
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
  const hoursEntries = normalizeHoursEntries(place.hours);

  const hours = place.hours;
  const hoursStr =
    typeof hours === 'string'
      ? hours
      : Array.isArray(hours)
        ? hours.join(' - ')
        : hoursEntries.slice(0, 3).map((entry) => `${entry.label} ${entry.value}`).join(' - ');

  const hasMapsKey =
    typeof import.meta !== 'undefined' && Boolean(import.meta.env?.VITE_GOOGLE_MAPS_API_KEY);

  const reviewsContent = (
    <div className="place-detail-reviews-panel place-detail-reviews-panel--embedded">
      <p className="place-detail-engage-hint">{t('detail', 'reviewSiteHint')}</p>

      {place.rating != null && (
        <div className="place-detail-app-rating-summary" style={{ padding: '24px', backgroundColor: 'var(--te-bg)', borderRadius: '16px', marginBottom: '24px', display: 'flex', gap: '32px', alignItems: 'center' }}>
          <div className="total-rating" style={{ textAlign: 'center' }}>
            <span className="big-num" style={{ fontSize: '3rem', fontWeight: 700 }}>{Number(place.rating).toFixed(1)}</span>
            <div className="stars-row" style={{ color: 'var(--te-primary)', display: 'flex', gap: '2px', justifyContent: 'center' }}>
              {Array.from({ length: 5 }, (_, i) => <Icon key={i} name="star" size={20} className={i < Math.round(place.rating) ? 'on' : 'off'} />)}
            </div>
            <span className="count" style={{ display: 'block', marginTop: '6px', fontSize: '0.85rem', color: 'var(--te-text-muted)' }}>
              {place.reviewCount} {t('detail', 'reviewsCount')}
            </span>
          </div>
          <div className="distribution-bars" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[5, 4, 3, 2, 1].map(stars => {
              const count = placeReviews.filter(r => r.rating === stars).length;
              const pct = placeReviews.length > 0 ? (count / placeReviews.length) * 100 : 0;
              return (
                <div key={stars} className="dist-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="star-label" style={{ fontSize: '0.85rem', fontWeight: 600, width: '12px' }}>{stars}</span>
                  <div className="bar-bg" style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.05)', height: '6px', borderRadius: '4px', overflow: 'hidden' }}>
                    <div className="bar-fill" style={{ width: `${pct}%`, backgroundColor: 'var(--te-primary)', height: '100%', borderRadius: '4px' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
  );




  return (
    <div className="place-detail">
      <div className="place-detail-container place-detail-shell">
        <nav className="place-detail-breadcrumb" aria-label="Breadcrumb">
          <ol className="place-detail-breadcrumb-list">
            <li><Link to="/">{t('nav', 'home')}</Link></li>
            <li><Link to="/discover">{t('nav', 'discoverPlaces')}</Link></li>
            <li aria-current="page">{place.name}</li>
          </ol>
        </nav>

        <Link to="/discover" className="place-detail-back">
          <Icon name="arrow_back" size={20} /> {t('detail', 'backToExplore')}
        </Link>
      </div>

      <article className="place-detail-article place-detail-article--bleed">
          <header className={`place-detail-hero place-detail-hero--fullbleed ${hasMultiGallery ? 'place-detail-hero--gallery' : ''}`}>
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

          <div className="place-detail-container place-detail-body">
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
              disabled={favouriteBusy}
              aria-busy={favouriteBusy}
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

          {mapCoords && hasMapsKey && Number.isFinite(mapCoords.lat) && Number.isFinite(mapCoords.lng) && (
            <section className="place-detail-section place-detail-map-section" aria-labelledby="place-map-heading">
              <h2 id="place-map-heading" className="place-detail-section-title">
                {t('detail', 'tourMapTab')}
              </h2>
              <div className="place-detail-map-wrap">
                <PlaceDetailMap lat={mapCoords.lat} lng={mapCoords.lng} title={place.name} t={t} />
              </div>
            </section>
          )}

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
                    role="region"
                    aria-labelledby="place-reviews-heading"
                  >
                    {reviewsContent}
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
              <div className="place-detail-chat">
                <div className="place-detail-chat__head">
                  <div className="place-detail-chat__avatar" aria-hidden="true">
                    <Icon name="chat" size={22} />
                  </div>
                  <div className="place-detail-chat__head-text">
                    <p className="place-detail-chat__label">{t('detail', 'engageContactTitle')}</p>
                    <p className="place-detail-chat__place">{place.name}</p>
                  </div>
                </div>
                <form className="place-detail-chat__form place-detail-inquiry" onSubmit={submitInquiry}>
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
                <div className="place-detail-chat__composer-actions">
                  <button
                    type="submit"
                    className="place-detail-btn place-detail-btn--primary place-detail-chat__send"
                    disabled={
                      inqSending ||
                      inqMessage.trim().length < 3 ||
                      (guestPhone.trim().match(/\d/g) || []).length < 8
                    }
                  >
                    {inqSending ? (
                      <span className="place-detail-chat__sending" aria-hidden="true">
                        …
                      </span>
                    ) : (
                      <>
                        <Icon name="send" size={18} aria-hidden="true" />
                        <span>{t('detail', 'sendMessage')}</span>
                      </>
                    )}
                  </button>
                </div>
                {inqStatus === 'sent' && (
                  <p className="place-detail-toast-inline" role="status">
                    {t('detail', 'inquirySent')}
                  </p>
                )}
                {inqStatus && inqStatus !== 'sent' && <p className="place-detail-error-inline">{inqStatus}</p>}
                </form>
              </div>
          </section>

          <footer className="place-detail-footer">
            <p className="place-detail-footer-notice">{t('detail', 'footerNotice')}</p>
          </footer>
          </div>
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
  );
}

