import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import api from '../api/client';
import Icon from '../components/Icon';
import OfferCard from '../components/OfferCard';
import { getPlaceImageUrl } from '../api/client';
import { getDeliveryImgProps } from '../utils/responsiveImages.js';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
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
  const c =
    place?.coordinates ||
    (place?.latitude != null && place?.longitude != null
      ? { lat: Number(place.latitude), lng: Number(place.longitude) }
      : null);
  return !!(c && Number.isFinite(c.lat) && Number.isFinite(c.lng));
}

function isDiningPlace(place) {
  const hay = [
    place?.category,
    place?.categoryId,
    ...(Array.isArray(place?.tags) ? place.tags : place?.tags ? [place.tags] : []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return /(restaurant|food|dining|cafe|café|coffee|bakery|sweet|dessert|cuisine|breakfast|lunch|dinner)/.test(hay);
}

function pickDiningTags(tags, matcher, limit = 4) {
  const list = Array.isArray(tags) ? tags : tags ? [tags] : [];
  const seen = new Set();
  return list
    .map((tag) => String(tag || '').trim())
    .filter(Boolean)
    .filter((tag) => {
      const key = tag.toLowerCase();
      if (!matcher.test(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function titleizeTokens(value) {
  return String(value || '')
    .split(/[_-]+/)
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join(' ');
}

function buildDiningSummary(place) {
  const tags = Array.isArray(place?.tags) ? place.tags : place?.tags ? [place.tags] : [];
  const diningProfile = place?.diningProfile && typeof place.diningProfile === 'object' ? place.diningProfile : {};
  const cuisines = [
    ...pickDiningTags(tags, /(lebanese|mediterranean|seafood|dessert|sweets|bakery|coffee|breakfast|grill|mezza|traditional|patisserie|cocktail)/, 5),
    ...(Array.isArray(diningProfile.cuisines) ? diningProfile.cuisines.map(titleizeTokens) : []),
  ]
    .filter((v, i, arr) => arr.findIndex((x) => String(x).toLowerCase() === String(v).toLowerCase()) === i)
    .slice(0, 5);

  const bestFor = [
    ...pickDiningTags(tags, /(breakfast|brunch|lunch|dinner|dessert|coffee|date night|family|quick bite|late night|mana2ish|knefe|baklava)/, 5),
    ...(Array.isArray(diningProfile.bestFor) ? diningProfile.bestFor.map(titleizeTokens) : []),
  ]
    .filter((v, i, arr) => arr.findIndex((x) => String(x).toLowerCase() === String(v).toLowerCase()) === i)
    .slice(0, 5);

  const features = [
    ...(diningProfile.reservations ? ['Reservations'] : []),
    ...(diningProfile.delivery ? ['Delivery'] : []),
    ...(diningProfile.takeaway ? ['Takeaway'] : []),
    ...(diningProfile.outdoorSeating ? ['Outdoor seating'] : []),
    ...(diningProfile.familyFriendly ? ['Family friendly'] : []),
    ...(Array.isArray(diningProfile.paymentMethods) ? diningProfile.paymentMethods.map(titleizeTokens) : []),
  ].slice(0, 6);

  return { cuisines, bestFor, features };
}

function normalizeDiningProfile(place) {
  const raw = place?.diningProfile && typeof place.diningProfile === 'object' ? place.diningProfile : {};
  const safeArray = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);
  const signatureDishes = safeArray(raw.signatureDishes).map((item) =>
    typeof item === 'string'
      ? { name: item }
      : {
          name: String(item?.name || '').trim(),
          description: String(item?.description || '').trim(),
          price: String(item?.price || '').trim(),
          badge: String(item?.badge || '').trim(),
        }
  ).filter((item) => item.name);
  const menuSections = safeArray(raw.menuSections)
    .map((section) => ({
      title: String(section?.title || '').trim(),
      note: String(section?.note || '').trim(),
      items: safeArray(section?.items)
        .map((item) =>
          typeof item === 'string'
            ? { name: item }
            : {
                name: String(item?.name || '').trim(),
                description: String(item?.description || '').trim(),
                price: String(item?.price || '').trim(),
                badge: String(item?.badge || '').trim(),
              }
        )
        .filter((item) => item.name),
    }))
    .filter((section) => section.title || section.items.length > 0);

  return {
    atmosphere: String(raw.atmosphere || '').trim(),
    reservationNotes: String(raw.reservationNotes || '').trim(),
    menuNote: String(raw.menuNote || '').trim(),
    serviceModes: safeArray(raw.serviceModes).map(titleizeTokens),
    dietaryOptions: safeArray(raw.dietaryOptions).map(titleizeTokens),
    contactPhone: String(raw.contactPhone || raw.phone || '').trim(),
    contactEmail: String(raw.contactEmail || raw.email || '').trim(),
    contactAddress: String(raw.contactAddress || raw.address || '').trim(),
    contactNote: String(raw.contactNote || '').trim(),
    signatureDishes,
    menuSections,
  };
}

function translationOr(t, section, key, fallback) {
  const value = t(section, key);
  return value === key ? fallback : value;
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
  const { showToast } = useToast();
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
  const [diningTab, setDiningTab] = useState('overview');

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
    setDiningTab('overview');
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

  useEffect(() => {
    if (!place) return;
    setInquiryIntent(isDiningPlace(place) ? 'booking' : 'general');
  }, [place?.id, place?.category, place?.categoryId, place?.tags]);

  const toggleFavourite = useCallback(() => {
    if (!user) {
      navigate('/login', { state: { from: 'place' } });
      return;
    }
    if (!place) return;
    const placeId = String(place.id);
    if (isFavourite) {
      api.user
        .removeFavourite(placeId)
        .then(() => {
          setIsFavourite(false);
          showToast(t('feedback', 'favouriteRemoved'), 'success');
        })
        .catch(() => showToast(t('feedback', 'favouriteUpdateFailed'), 'error'));
    } else {
      api.user
        .addFavourite(placeId)
        .then(() => {
          setIsFavourite(true);
          showToast(t('feedback', 'favouriteAdded'), 'success');
        })
        .catch(() => showToast(t('feedback', 'favouriteUpdateFailed'), 'error'));
    }
  }, [user, place, isFavourite, navigate, showToast, t]);

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
          if (code === 'LOCATION_REQUIRED') setCheckinMsg(t('detail', 'checkInNeedLocation'));
          else if (code === 'TOO_FAR') setCheckinMsg(t('detail', 'checkInTooFar'));
          else setCheckinMsg(e.message || t('detail', 'checkInFailed'));
          showToast(t('feedback', 'actionFailed'), 'error');
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
          setInqStatus(err.message || 'Could not send');
          showToast(t('feedback', 'inquiryFailed'), 'error');
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
  const diningPlace = isDiningPlace(place);
  const diningSummary = buildDiningSummary(place);
  const diningProfile = normalizeDiningProfile(place);
  const hoursEntries = normalizeHoursEntries(place.hours);

  const hours = place.hours;
  const hoursStr =
    typeof hours === 'string'
      ? hours
      : Array.isArray(hours)
        ? hours.join(' - ')
        : hoursEntries.slice(0, 3).map((entry) => `${entry.label} ${entry.value}`).join(' - ');
  const diningGallery = galleryUrls.slice(0, 4);
  const diningSignals = [
    ...diningSummary.bestFor,
    ...diningSummary.features,
    ...diningProfile.serviceModes,
    ...diningProfile.dietaryOptions,
  ]
    .filter((item, index, arr) => arr.findIndex((x) => String(x).toLowerCase() === String(item).toLowerCase()) === index)
    .slice(0, 8);
  const diningFacts = [
    place.price ? { icon: 'payments', label: translationOr(t, 'detail', 'priceRange', 'Price range'), value: place.price } : null,
    hoursStr ? { icon: 'schedule', label: translationOr(t, 'detail', 'openingHours', 'Opening hours'), value: hoursStr } : null,
    place.location ? { icon: 'location_on', label: translationOr(t, 'detail', 'location', 'Location'), value: place.location } : null,
    place.rating != null
      ? {
          icon: 'star',
          label: translationOr(t, 'detail', 'reviewsCount', 'Reviews'),
          value: `${Number(place.rating).toFixed(1)}${place.reviewCount ? ` - ${place.reviewCount}` : ''}`,
        }
      : null,
  ].filter(Boolean);
  const diningTabs = [
    { id: 'overview', label: t('detail', 'diningTabOverview') },
    { id: 'menu', label: t('detail', 'diningTabMenu') },
    { id: 'reviews', label: t('detail', 'diningTabReviews') },
    { id: 'contact', label: t('detail', 'diningTabContact') },
  ];

  const isDining = isDiningPlace(place);

  const reviewsContent = (
    <div className="place-detail-reviews-panel place-detail-reviews-panel--embedded">
      <p className="place-detail-engage-hint">{t('detail', 'reviewSiteHint')}</p>

      {isDining && place.rating != null && (
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

              const contactContent = (
                <div className="place-detail-dining-contact-layout">
                  <article className="place-detail-dining-card place-detail-dining-card--contact-details" style={{ border: '2px solid rgba(0,0,0,0.05)', backgroundColor: 'transparent' }}>
                    <div className="place-detail-dining-card-icon" aria-hidden="true" style={{ backgroundColor: 'var(--te-primary)', color: '#fff' }}>
                      <Icon name="event_seat" size={24} />
                    </div>
                    <h3>{t('detail', 'diningBookingTitle') || 'Reservation & Booking'}</h3>
                    <p style={{ marginBottom: '24px' }}>{diningProfile.reservationNotes || t('detail', 'diningContactLead')}</p>
                    
                    <form className="place-detail-contact-form" onSubmit={submitInquiry} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {!user && (
                        <>
                          <label className="place-detail-review-field">
                            <span>{t('detail', 'inquiryName') || 'Your Name'}</span>
                            <input type="text" required value={guestName} onChange={e => setGuestName(e.target.value)} />
                          </label>
                          <label className="place-detail-review-field">
                            <span>{t('detail', 'inquiryEmail') || 'Email'}</span>
                            <input type="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} />
                          </label>
                        </>
                      )}
                      <label className="place-detail-review-field">
                        <span>{t('detail', 'inquiryPhone') || 'Phone'}</span>
                        <input type="tel" required value={guestPhone} onChange={e => setGuestPhone(e.target.value)} />
                      </label>
                      <label className="place-detail-review-field">
                        <span>{t('detail', 'inquiryMessage') || 'Special Requests / Notes'}</span>
                        <textarea required value={inqMessage} onChange={e => setInqMessage(e.target.value)} rows={3} />
                      </label>
                      <button type="submit" className="place-detail-btn place-detail-btn--primary" disabled={inqSending} style={{ marginTop: '8px' }}>
                        <Icon name="send" size={20} />
                        {inqSending ? t('detail', 'inquirySending') || 'Sending...' : t('detail', 'inquirySubmit') || 'Request Booking'}
                      </button>
                      {inqStatus === 'sent' && <p className="place-detail-toast-inline">{t('detail', 'inquirySent') || 'Your request was sent successfully!'}</p>}
                    </form>
                  </article>

                  <div className="place-detail-dining-grid">
                    <article className="place-detail-dining-card">
                      <div className="place-detail-dining-contact-list">
                        <div className="place-detail-dining-contact-row">
                          <Icon name="location_on" size={18} />
                          <span>{diningProfile.contactAddress || place.location || translationOr(t, 'detail', 'location', 'Location')}</span>
                        </div>
                        {diningProfile.contactPhone ? (
                          <div className="place-detail-dining-contact-row">
                            <Icon name="call" size={18} />
                            <a href={`tel:${diningProfile.contactPhone}`}>{diningProfile.contactPhone}</a>
                          </div>
                        ) : null}
                        {diningProfile.contactEmail ? (
                          <div className="place-detail-dining-contact-row">
                            <Icon name="mail" size={18} />
                            <a href={`mailto:${diningProfile.contactEmail}`}>{diningProfile.contactEmail}</a>
                          </div>
                        ) : null}
                      </div>
                      <div className="place-detail-dining-contact-actions" style={{ marginTop: '24px' }}>
                        <button type="button" className="place-detail-btn place-detail-btn--secondary" onClick={openPlaceOnMap} style={{ width: '100%', justifyContent: 'center' }}>
                          <Icon name="map" size={18} />
                          {t('detail', 'diningMapCta')}
                        </button>
                      </div>
                    </article>
                    
                    <article className="place-detail-dining-card">
                      <div className="place-detail-dining-card-icon" aria-hidden="true">
                        <Icon name="schedule" size={22} />
                      </div>
                      <h3>{t('detail', 'openingHours')}</h3>
                      <p>{hoursStr || t('detail', 'diningContactHoursFallback')}</p>
                    </article>
                  </div>
                </div>
              );

  if (isDining) {
    const totersHeroUrl = galleryUrls[0] || null;
    return (
      <div className="place-detail-app">
        <header className="place-detail-app-hero">
          <div className="place-detail-app-hero-media">
            {totersHeroUrl ? (
              <img src={totersHeroUrl} alt={place.name} className="place-detail-app-hero-img" {...getDeliveryImgProps(totersHeroUrl, 'detailHero')} />
            ) : (
              <div className="place-detail-app-hero-fallback"><Icon name="restaurant" size={40} /></div>
            )}
            <div className="place-detail-app-hero-overlay" />
            <Link to="/" className="place-detail-app-back-btn"><Icon name="arrow_back" size={24} /></Link>
            <div className="place-detail-app-hero-actions">
              <button type="button" className={`place-detail-app-hero-action ${isFavourite ? 'on' : ''}`} onClick={toggleFavourite}>
                <Icon name={isFavourite ? 'favorite' : 'favorite_border'} size={24} />
              </button>
              <button type="button" className="place-detail-app-hero-action" onClick={handleShare}><Icon name="share" size={24} /></button>
            </div>
          </div>
          
          <div className="place-detail-app-info-card">
            <div className="place-detail-app-info-header">
              <h1 className="place-detail-app-name">{place.name}</h1>
              <LiveStatus hours={place.hours} t={t} />
            </div>
            <div className="place-detail-app-meta">
              {place.rating != null && place.rating > 0 && <div className="place-detail-app-rating"><Icon name="star" size={16} /><span>{Number(place.rating).toFixed(1)}</span></div>}
              <div className="place-detail-app-dot" />
              <span className="place-detail-app-cuisines">{diningSummary.cuisines.slice(0, 2).join(', ')}</span>
              {place.price && <><div className="place-detail-app-dot" /><span className="place-detail-app-price">{place.price}</span></>}
            </div>
          </div>
        </header>

        <nav className="place-detail-app-tabs">
          <div className="place-detail-app-tabs-scroll">
            {diningTabs.map(tab => (
              <button key={tab.id} type="button" className={`place-detail-app-tab ${diningTab === tab.id ? 'active' : ''}`} onClick={() => setDiningTab(tab.id)}>
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        <main className="place-detail-app-main-content">
          {diningTab === 'overview' && (
            <div className="place-detail-app-overview">
              <section className="place-detail-app-section">
                <h3>{t('detail', 'description') || 'About'}</h3>
                <p>{place.description}</p>
                <div className="place-detail-app-tags">
                  {diningSummary.cuisines.map(c => <span key={c} className="place-detail-app-tag">{c}</span>)}
                  {diningSummary.features.map(f => <span key={f} className="place-detail-app-tag alt">{f}</span>)}
                </div>
              </section>
              
              <section className="place-detail-app-section hours-section">
                <h3>{t('detail', 'openingHours') || 'Opening Hours'}</h3>
                <div className="place-detail-app-hours">
                  {hoursEntries.map((e) => (
                    <div key={e.key} className="place-detail-app-hour-row">
                      <span className="day">{e.label}</span>
                      <span className="time">{e.value}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="place-detail-app-section">
                <h3>{t('detail', 'location') || 'Location'}</h3>
                <p className="place-detail-app-address">{place.location}</p>
                <button className="place-detail-app-map-btn" onClick={openPlaceOnMap}>
                  <Icon name="directions" size={18} /> {t('detail', 'viewOnMap') || 'View on Map'}
                </button>
              </section>
            </div>
          )}

          {diningTab === 'menu' && (
            <div className="place-detail-app-menu">
              {diningProfile.menuSections?.length > 0 ? (
                diningProfile.menuSections.map(section => (
                  <section key={section.title} className="place-detail-app-menu-section">
                    <h4>{section.title}</h4>
                    <div className="place-detail-app-menu-items">
                      {section.items.map(item => (
                        <div key={item.name} className="place-detail-app-menu-item">
                          <div className="info">
                            <span className="name">{item.name}</span>
                            <span className="desc">{item.description}</span>
                            <span className="price">{item.price}</span>
                          </div>
                          <button className="add-btn"><Icon name="add" size={20} /></button>
                        </div>
                      ))}
                    </div>
                  </section>
                ))
              ) : (
                <div className="place-detail-app-empty">{t('detail', 'menuEmpty') || 'Menu not available yet'}</div>
              )}
            </div>
          )}

          {diningTab === 'reviews' && reviewsContent}
          {diningTab === 'contact' && (
            <div className="place-detail-app-contact-blocks">
              <div className="place-detail-app-contact-group">
                {diningProfile.contactPhone && (
                  <a href={`tel:${diningProfile.contactPhone}`} className="place-detail-app-action-row">
                    <div className="action-icon call"><Icon name="call" size={24} /></div>
                    <div className="action-text">
                      <h4>{t('detail', 'callUs') || 'Call Restaurant'}</h4>
                      <span>{diningProfile.contactPhone}</span>
                    </div>
                    <Icon name="chevron_right" size={24} className="action-chevron" />
                  </a>
                )}
                <button type="button" onClick={openPlaceOnMap} className="place-detail-app-action-row">
                  <div className="action-icon map"><Icon name="directions" size={24} /></div>
                  <div className="action-text">
                    <h4>{t('detail', 'getDirections') || 'Get Directions'}</h4>
                    <span>{diningProfile.contactAddress || place.location || 'View on Map'}</span>
                  </div>
                  <Icon name="chevron_right" size={24} className="action-chevron" />
                </button>
                {diningProfile.socialMedia?.website && (
                  <a href={diningProfile.socialMedia.website} target="_blank" rel="noreferrer" className="place-detail-app-action-row">
                    <div className="action-icon web"><Icon name="language" size={24} /></div>
                    <div className="action-text">
                      <h4>{t('detail', 'website') || 'Website'}</h4>
                      <span>{t('detail', 'visitWebsite') || 'Visit Link'}</span>
                    </div>
                    <Icon name="chevron_right" size={24} className="action-chevron" />
                  </a>
                )}
                {diningProfile.socialMedia?.instagram && (
                  <a href={diningProfile.socialMedia.instagram} target="_blank" rel="noreferrer" className="place-detail-app-action-row">
                    <div className="action-icon insta"><Icon name="photo_camera" size={24} /></div>
                    <div className="action-text">
                      <h4>Instagram</h4>
                      <span>{t('detail', 'viewProfile') || 'View Profile'}</span>
                    </div>
                    <Icon name="chevron_right" size={24} className="action-chevron" />
                  </a>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

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

          {diningPlace && (
            <section className="place-detail-section place-detail-dining" aria-labelledby="place-dining-heading">
              <div className="place-detail-dining-shell">
                <div className="place-detail-dining-stage">
                  <div className="place-detail-dining-stage-media">
                    {heroUrl ? (
                      <img
                        alt={place.name || ''}
                        loading="lazy"
                        decoding="async"
                        className="place-detail-dining-stage-image"
                        {...getDeliveryImgProps(heroUrl, 'detailHero')}
                      />
                    ) : (
                      <div className="place-detail-dining-stage-fallback">
                        <Icon name="restaurant" size={34} />
                      </div>
                    )}
                    <div className="place-detail-dining-stage-scrim" aria-hidden="true" />
                    {diningGallery.length > 1 ? (
                      <div className="place-detail-dining-stage-thumbs" aria-label={translationOr(t, 'detail', 'gallery', 'Gallery')}>
                        {diningGallery.map((url, index) => (
                          <button
                            key={url}
                            type="button"
                            className={`place-detail-dining-stage-thumb ${galleryUrls[galleryIndex] === url ? 'place-detail-dining-stage-thumb--on' : ''}`}
                            onClick={() => setGalleryIndex(index)}
                            aria-label={`${translationOr(t, 'detail', 'preview', 'Preview')} ${index + 1}`}
                          >
                            <img alt="" loading="lazy" decoding="async" {...getDeliveryImgProps(url, 'thumb')} />
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="place-detail-dining-stage-panel">
                    <div className="place-detail-dining-head">
                      <div className="place-detail-dining-head-copy">
                        <span className="place-detail-dining-kicker">{t('detail', 'diningSectionEyebrow')}</span>
                        <h2 id="place-dining-heading" className="place-detail-section-title">
                          {t('detail', 'diningSectionTitle')}
                        </h2>
                        <p className="place-detail-dining-sub">{t('detail', 'diningSectionSub')}</p>
                      </div>
                    </div>

                    {diningFacts.length > 0 ? (
                      <div className="place-detail-dining-stage-facts">
                        {diningFacts.map((fact) => (
                          <article key={`${fact.label}-${fact.value}`} className="place-detail-dining-stage-fact">
                            <span className="place-detail-dining-stage-fact-icon" aria-hidden="true">
                              <Icon name={fact.icon} size={18} />
                            </span>
                            <div>
                              <span className="place-detail-dining-stage-fact-label">{fact.label}</span>
                              <strong className="place-detail-dining-stage-fact-value">{fact.value}</strong>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : null}

                    <div className="place-detail-dining-hero-rail">
                      {diningSignals.map((item) => (
                        <span key={item} className="place-detail-dining-hero-pill">{item}</span>
                      ))}
                    </div>
                  </div>
                </div>

              <div className="place-detail-dining-toolbar">
                <div className="place-detail-dining-tabs" role="tablist" aria-label={t('detail', 'diningSectionTitle')}>
                  {diningTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={diningTab === tab.id}
                      className={`place-detail-dining-tab ${diningTab === tab.id ? 'place-detail-dining-tab--on' : ''}`}
                      onClick={() => setDiningTab(tab.id)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div className="place-detail-dining-toolbar-actions">
                  <button
                    type="button"
                    className="place-detail-btn place-detail-btn--secondary place-detail-dining-cta"
                    onClick={() => {
                      const el = document.getElementById('place-proposal');
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                  >
                    <Icon name="chat" size={20} />
                    {t('detail', 'diningContactCta')}
                  </button>
                  <button
                    type="button"
                    className="place-detail-btn place-detail-btn--ghost place-detail-dining-cta"
                    onClick={openPlaceOnMap}
                  >
                    <Icon name="map" size={20} />
                    {t('detail', 'diningMapCta')}
                  </button>
                </div>
              </div>

              {diningTab === 'overview' && (
                <div className="place-detail-dining-grid">
                  <article className="place-detail-dining-card">
                    <div className="place-detail-dining-card-icon" aria-hidden="true">
                      <Icon name="menu_book" size={22} />
                    </div>
                    <h3>{t('detail', 'diningMenuTitle')}</h3>
                    <p>{diningProfile.menuNote || t('detail', 'diningMenuHint')}</p>
                    {diningSummary.cuisines.length > 0 && (
                      <div className="place-detail-dining-chip-list">
                        {diningSummary.cuisines.map((item) => (
                          <span key={item} className="place-detail-dining-chip">{item}</span>
                        ))}
                      </div>
                    )}
                  </article>

                  <article className="place-detail-dining-card">
                    <div className="place-detail-dining-card-icon" aria-hidden="true">
                      <Icon name="event_available" size={22} />
                    </div>
                    <h3>{t('detail', 'diningBookingTitle')}</h3>
                    <p>{place.price ? `${t('detail', 'priceRange')}: ${place.price}` : t('detail', 'diningBookingHint')}</p>
                    <div className="place-detail-dining-meta-list">
                      {hoursStr ? <span>{hoursStr}</span> : null}
                      {place.location ? <span>{place.location}</span> : null}
                    </div>
                  </article>

                  <article className="place-detail-dining-card">
                    <div className="place-detail-dining-card-icon" aria-hidden="true">
                      <Icon name="local_dining" size={22} />
                    </div>
                    <h3>{t('detail', 'diningBestForTitle')}</h3>
                    <p>{diningProfile.atmosphere || t('detail', 'diningBestForHint')}</p>
                    {([...diningSummary.bestFor, ...diningSummary.features, ...diningProfile.dietaryOptions].length > 0) && (
                      <div className="place-detail-dining-chip-list">
                        {[...diningSummary.bestFor, ...diningSummary.features, ...diningProfile.dietaryOptions].slice(0, 8).map((item) => (
                          <span key={item} className="place-detail-dining-chip">{item}</span>
                        ))}
                      </div>
                    )}
                  </article>
                </div>
              )}

              {diningTab === 'menu' && (
                <div className="place-detail-dining-menu">
                  {diningProfile.signatureDishes.length > 0 && (
                    <div className="place-detail-dining-featured">
                      <h3 className="place-detail-dining-panel-title">{t('detail', 'diningSignatureTitle')}</h3>
                      <div className="place-detail-dining-featured-grid">
                        {diningProfile.signatureDishes.map((dish) => (
                          <article key={`${dish.name}-${dish.price}`} className="place-detail-dining-dish">
                            <div className="place-detail-dining-dish-head">
                              <strong>{dish.name}</strong>
                              {dish.price ? <span>{dish.price}</span> : null}
                            </div>
                            {dish.badge ? <span className="place-detail-dining-dish-badge">{dish.badge}</span> : null}
                            {dish.description ? <p>{dish.description}</p> : null}
                          </article>
                        ))}
                      </div>
                    </div>
                  )}

                  {diningProfile.menuSections.length > 0 ? (
                    <div className="place-detail-dining-menu-sections">
                      {diningProfile.menuSections.map((section) => (
                        <section key={section.title || section.note} className="place-detail-dining-menu-section">
                          {section.title ? <h3 className="place-detail-dining-panel-title">{section.title}</h3> : null}
                          {section.note ? <p className="place-detail-dining-menu-note">{section.note}</p> : null}
                          <div className="place-detail-dining-menu-items">
                            {section.items.map((item) => (
                              <article key={`${section.title}-${item.name}-${item.price}`} className="place-detail-dining-menu-item">
                                <div className="place-detail-dining-menu-item-head">
                                  <strong>{item.name}</strong>
                                  {item.price ? <span>{item.price}</span> : null}
                                </div>
                                {item.badge ? <span className="place-detail-dining-dish-badge">{item.badge}</span> : null}
                                {item.description ? <p>{item.description}</p> : null}
                              </article>
                            ))}
                          </div>
                        </section>
                      ))}
                    </div>
                  ) : (
                    <div className="place-detail-dining-empty">
                      <Icon name="menu_book" size={30} />
                      <h3>{t('detail', 'diningMenuEmptyTitle')}</h3>
                      <p>{t('detail', 'diningMenuEmptyBody')}</p>
                    </div>
                  )}
                </div>
              )}

              {diningTab === 'reviews' && reviewsContent}

              {diningTab === 'contact' && contactContent}
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

              {!diningPlace && <div className="place-detail-engage-block place-detail-reviews-box">
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
              </div>}

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
