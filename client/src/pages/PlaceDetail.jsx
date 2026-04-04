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
  const safeArray = (arr) => (Array.isArray(arr) ? arr : []);
  const titleizeTokens = (s) => (s && typeof s === 'string' ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : s);

  const signatureDishes = safeArray(raw.signatureDishes).map((d) => ({
    name: String(d.name || ''),
    price: String(d.price || ''),
    description: String(d.description || ''),
    badge: String(d.badge || ''),
  })).filter(d => d.name);

  const menuSections = safeArray(raw.menuSections).map((s) => ({
    title: String(s.title || ''),
    note: String(s.note || ''),
    items: safeArray(s.items).map((it) => ({
      name: String(it.name || ''),
      price: String(it.price || ''),
      description: String(it.description || ''),
      badge: String(it.badge || ''),
    })).filter(it => it.name),
  })).filter(s => s.title || s.items.length > 0);

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
    socialMedia: {
      instagram: String(raw.instagram || raw.social_instagram || '').trim(),
      facebook: String(raw.facebook || raw.social_facebook || '').trim(),
      website: String(raw.website || raw.link || '').trim(),
    },
    signatureDishes,
    menuSections,
  };
}

function LiveStatus({ hours, t }) {
  if (!hours || typeof hours !== 'object' || Array.isArray(hours)) return null;
  const now = new Date();
  const dayName = now.toLocaleString('en-US', { weekday: 'long' });
  const todayHours = hours[dayName];
  if (!todayHours) return <span className="place-status place-status--unknown">{t('detail', 'statusUnknown') || 'Hours N/A'}</span>;

  try {
    const [startStr, endStr] = todayHours.split('–').map(s => s.trim());
    if (startStr && endStr) {
      const [startH, startM] = startStr.split(':').map(Number);
      const [endH, endM] = endStr.split(':').map(Number);
      const currentH = now.getHours();
      const currentM = now.getMinutes();
      const startTotal = startH * 60 + startM;
      const endTotal = endH * 60 + endM;
      const currentTotal = currentH * 60 + currentM;
      const isOpen = currentTotal >= startTotal && currentTotal < endTotal;
      return (
        <span className={`place-status ${isOpen ? 'place-status--open' : 'place-status--closed'}`}>
          {isOpen ? t('detail', 'openNow') : t('detail', 'closedNow')}
        </span>
      );
    }
  } catch (e) { return null; }
  return null;
}

function normalizeHoursEntries(hours) {
  if (!hours || typeof hours !== 'object' || Array.isArray(hours)) return [];
  const labels = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
  return Object.entries(hours)
    .map(([key, value]) => ({
      key,
      label: labels[key] || key.charAt(0).toUpperCase() + key.slice(1),
      value: String(value || '').trim(),
    }))
    .filter((item) => item.value);
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
  const [promotions, setPromotions] = useState([]);
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
  const [diningTab, setDiningTab] = useState('overview');
  const [activeImageUrl, setActiveImageUrl] = useState(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.1 }
    );

    const revealElements = document.querySelectorAll('.place-detail-reveal');
    revealElements.forEach((el) => observer.observe(el));

    return () => {
      revealElements.forEach((el) => observer.unobserve(el));
    };
  }, [place, diningTab]);

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
  }, [myReview, user]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setPlaceReviewsLoading(true);
    api.places.reviews(id)
      .then((r) => { if (!cancelled) setPlaceReviews(Array.isArray(r.reviews) ? r.reviews : []); })
      .catch(() => { if (!cancelled) setPlaceReviewsError(true); })
      .finally(() => { if (!cancelled) setPlaceReviewsLoading(false); });
    
    setLoading(true);
    api.places.get(id, { lang })
      .then((p) => { 
        if (!cancelled) {
          setPlace(p);
          if (p?.name) document.title = `${p.name} | Visit Tripoli`;
          if (p?.images?.length > 0) setActiveImageUrl(p.images[0]);
          else if (p?.image) setActiveImageUrl(p.image);
        }
      })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    api.places.promotions(id, { lang })
      .then((r) => { if (!cancelled) setPromotions(Array.isArray(r.promotions) ? r.promotions : []); })
      .catch(() => {});

    return () => { cancelled = true; document.title = 'Visit Tripoli'; };
  }, [id, lang]);

  useEffect(() => {
    if (!user || !place) { setIsFavourite(false); return; }
    api.user.favourites()
      .then((res) => {
        const ids = new Set((Array.isArray(res.placeIds) ? res.placeIds : []).map(String));
        setIsFavourite(ids.has(String(place.id)));
      })
      .catch(() => setIsFavourite(false));
  }, [user, place]);

  const galleryUrls = useMemo(() => collectPlaceImageUrls(place), [place]);
  const diningSummary = useMemo(() => (place ? buildDiningSummary(place) : { cuisines: [], bestFor: [], features: [] }), [place]);
  const diningProfile = useMemo(() => (place ? normalizeDiningProfile(place) : {}), [place]);

  const toggleFavourite = useCallback(() => {
    if (!user) { navigate('/login', { state: { from: 'place' } }); return; }
    if (!place) return;
    const action = isFavourite ? api.user.removeFavourite : api.user.addFavourite;
    action(String(place.id))
      .then(() => {
        setIsFavourite(!isFavourite);
        showToast(isFavourite ? t('feedback', 'favouriteRemoved') : t('feedback', 'favouriteAdded'), 'success');
      })
      .catch(() => showToast(t('feedback', 'favouriteUpdateFailed'), 'error'));
  }, [user, place, isFavourite, navigate, showToast, t]);

  const handleShare = useCallback(() => {
    if (navigator.share && place) {
      navigator.share({ title: place.name, text: place.description || place.name, url: window.location.href }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href)
        .then(() => showToast(t('feedback', 'linkCopied'), 'success'))
        .catch(() => showToast(t('feedback', 'actionFailed'), 'error'));
    }
  }, [place, showToast, t]);

  const openPlaceOnMap = useCallback(() => {
    if (!place?.id) return;
    if (!user) { navigate('/login', { state: { from: location.pathname } }); return; }
    const pid = String(place.id);
    navigate('/map', { state: { tripPlaceIds: [pid], tripDays: [{ placeIds: [pid] }], tripName: place.name } });
  }, [place, user, navigate, location.pathname]);

  if (loading) return <div className="place-detail-app-loading"><div className="spinner" /></div>;
  if (error || !place) return <div className="place-detail-app-error">Place not found</div>;

  const isDining = isDiningPlace(place);
  const diningTabs = [
    { id: 'overview', label: t('detail', 'diningTabOverview') || 'Overview' },
    { id: 'menu', label: isDining ? (t('detail', 'diningTabMenu') || 'Menu') : (t('detail', 'guide') || 'Guide') },
    { id: 'reviews', label: t('detail', 'diningTabReviews') || 'Reviews' },
    { id: 'contact', label: t('detail', 'diningTabContact') || 'Contact' },
  ];

  return (
    <div className="place-detail-app">
      <header className="place-detail-app-hero">
        <div className="place-detail-app-hero-media">
          {activeImageUrl ? (
            <img src={activeImageUrl} alt={place.name} className="place-detail-app-hero-img" {...getDeliveryImgProps(activeImageUrl, 'detailHero')} />
          ) : (
            <div className="place-detail-app-hero-fallback"><Icon name="camera" size={40} /></div>
          )}
          <div className="place-detail-app-hero-overlay" />
          <Link to="/" className="place-detail-app-back-btn"><Icon name="arrow_back" size={24} /></Link>
          <div className="place-detail-app-hero-actions">
            <button type="button" className={`place-detail-app-hero-action ${isFavourite ? 'on' : ''}`} onClick={toggleFavourite}>
              <Icon name={isFavourite ? 'favorite' : 'favorite_border'} size={24} />
            </button>
            <button type="button" className="place-detail-app-hero-action" onClick={handleShare}><Icon name="share" size={24} /></button>
          </div>

          {galleryUrls.length > 1 && (
            <div className="place-detail-app-hero-gallery">
              {galleryUrls.map((url, i) => (
                <div 
                  key={i} 
                  className={`place-detail-app-hero-thumb ${activeImageUrl === url ? 'active' : ''}`}
                  onClick={() => setActiveImageUrl(url)}
                >
                  <img src={url} alt={`${place.name} ${i + 1}`} />
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="place-detail-app-info-card">
          <div className="place-detail-app-info-header">
            <h1 className="place-detail-app-name">{place.name}</h1>
            <LiveStatus hours={place.hours} t={t} />
          </div>
          <div className="place-detail-app-meta">
            {place.rating > 0 && <div className="place-detail-app-rating"><Icon name="star" size={16} /><span>{place.rating}</span></div>}
            <div className="place-detail-app-dot" />
            <span className="place-detail-app-cuisines">
              {isDining 
                ? diningSummary.cuisines.slice(0, 2).join(', ') 
                : (place.category || t('detail', 'landmark'))}
            </span>
            {place.price && <><div className="place-detail-app-dot" /><span className="place-detail-app-price">{place.price}</span></>}
          </div>

          <div className="place-detail-app-quick-stats">
            {place.bestTime && (
              <div className="place-detail-app-stat-item">
                <Icon name="schedule" size={16} />
                <span>{place.bestTime}</span>
              </div>
            )}
            {place.duration && (
              <div className="place-detail-app-stat-item">
                <Icon name="timer" size={16} />
                <span>{place.duration}</span>
              </div>
            )}
            {!isDining && (
              <div className="place-detail-app-stat-item">
                <Icon name="payments" size={16} />
                <span>{place.price || t('detail', 'freeEntry')}</span>
              </div>
            )}
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
            {place.insiderTip && (
              <div className="place-detail-app-insider-tip">
                <Icon name="lightbulb" size={24} />
                <div className="content">
                  <h4>{t('detail', 'insiderTip') || 'Insider Tip'}</h4>
                  <p>{place.insiderTip}</p>
                </div>
              </div>
            )}

            <section className="place-detail-app-section">
              <h3>{t('detail', 'description') || 'About'}</h3>
              <p>{place.description}</p>
              
              <div className="place-detail-app-amenities-grid">
                {(place.features?.amenities || diningSummary.features).slice(0, 6).map(f => (
                  <div key={f} className="place-detail-app-amenity">
                    <Icon name={f.toLowerCase().includes('wifi') ? 'wifi' : f.toLowerCase().includes('parking') ? 'local_parking' : 'check_circle'} size={18} />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </section>

            {diningProfile.coupons?.length > 0 && (
              <section className="place-detail-app-section coupons-section">
                <h3>{t('detail', 'exclusiveOffers') || 'Exclusive Offers'}</h3>
                <div className="place-detail-app-coupons">
                  {diningProfile.coupons.map(coupon => (
                    <div key={coupon.id} className="place-detail-app-coupon">
                      <div className="coupon-info">
                        <span className="code">{coupon.code}</span>
                        <p className="desc">{coupon.description}</p>
                      </div>
                      <button 
                        className="copy-btn" 
                        onClick={() => {
                          navigator.clipboard.writeText(coupon.code);
                          showToast(t('feedback', 'linkCopied'), 'success');
                        }}
                      >
                        <Icon name="content_copy" size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
            
            <section className="place-detail-app-section place-detail-reveal delay-2">
              <h3>{t('detail', 'hours') || 'Opening Hours'}</h3>
              <div className="place-detail-app-hours-card">
                <div className="place-detail-app-hours-header">
                  <span className="current-day">
                    <Icon name="clock" size={16} /> {new Date().toLocaleDateString('en-US', { weekday: 'long' })}
                  </span>
                </div>
                <div className="place-detail-app-hours-list">
                  {Object.entries(place.hours || {}).map(([day, time]) => {
                    const isToday = new Date().toLocaleDateString('en-US', { weekday: 'long' }) === day;
                    return (
                      <div key={day} className={`place-detail-app-hour-row ${isToday ? 'is-today' : ''}`}>
                        <span className="day">{day}</span>
                        <span className="time">{time}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="place-detail-app-section place-detail-reveal delay-3">
              <h3>{t('detail', 'location') || 'Location'}</h3>
              <div className="place-detail-app-location-card">
                <div className="place-detail-app-location-info">
                  <div className="place-detail-app-address-text">
                    <Icon name="location" size={20} style={{ marginRight: '8px', verticalAlign: 'middle', color: '#27ae60' }} />
                    {place.location}
                  </div>
                  <button className="place-detail-app-map-btn" onClick={openPlaceOnMap}>
                    <Icon name="directions" size={22} /> {t('detail', 'getDirections') || 'Get Directions'}
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}

        {diningTab === 'menu' && (
          <div className="place-detail-app-menu">
            {isDining ? (
              diningProfile.menuSections?.length > 0 ? (
                diningProfile.menuSections.map(section => (
                  <section key={section.title} className="place-detail-app-menu-section">
                    <h4>{section.title}</h4>
                    <div className="place-detail-app-menu-items">
                      {section.items.map(item => (
                        <div key={item.name} className="place-detail-app-menu-item">
                          {item.image && (
                            <div className="item-media">
                              <img src={item.image} alt={item.name} />
                              {item.badge && <span className="item-badge">{item.badge}</span>}
                            </div>
                          )}
                          <div className="info">
                            <div className="name-row">
                              <span className="name">{item.name}</span>
                              {!item.image && item.badge && <span className="item-badge-inline">{item.badge}</span>}
                            </div>
                            <span className="desc">{item.description}</span>
                            <span className="price">{item.price}</span>
                          </div>
                          <button className="place-detail-app-add-btn"><Icon name="add" size={20} /></button>
                        </div>
                      ))}
                    </div>
                  </section>
                ))
              ) : (
                <div className="place-detail-app-empty">{t('detail', 'menuEmpty') || 'Menu not available yet'}</div>
              )
            ) : (
              <div className="place-detail-app-overview">
                 <section className="place-detail-app-section">
                    <h3>{t('detail', 'visitorGuide') || 'Visitor Guide'}</h3>
                    <p>{place.description}</p>
                    {place.tags && (
                      <div className="place-detail-app-tags" style={{ marginTop: '12px' }}>
                        {place.tags.map(tag => <span key={tag} className="place-detail-app-tag">{tag}</span>)}
                      </div>
                    )}
                 </section>
              </div>
            )}
          </div>
        )}

        {diningTab === 'reviews' && (
          <div className="place-detail-app-reviews">
            <div className="reviews-header">
              <h3>{t('detail', 'reviews') || 'Reviews'}</h3>
              <button className="write-review-btn" onClick={() => user ? null : navigate('/login')}>{t('detail', 'writeReview') || 'Write a Review'}</button>
            </div>

            {(place.ratingDistribution || diningProfile.ratingDistribution) && (
              <div className="place-detail-app-rating-summary">
                <div className="total-rating">
                  <span className="big-num">{place.rating?.toFixed(1) || '0.0'}</span>
                  <div className="stars-row">
                    {Array.from({ length: 5 }, (_, i) => <Icon key={i} name="star" size={18} className={i < Math.round(place.rating) ? 'on' : 'off'} />)}
                  </div>
                  <span className="count">{place.reviewCount} {t('detail', 'reviewsCount')}</span>
                </div>
                <div className="distribution-bars">
                  {[5, 4, 3, 2, 1].map(stars => {
                    const dist = place.ratingDistribution || diningProfile.ratingDistribution || {};
                    const count = dist[stars] || 0;
                    const pct = place.reviewCount > 0 ? (count / place.reviewCount) * 100 : 0;
                    return (
                      <div key={stars} className="dist-row">
                        <span className="star-label">{stars}</span>
                        <div className="bar-bg"><div className="bar-fill" style={{ width: `${pct}%` }} /></div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="place-detail-app-reviews-list">
              {placeReviews.map(rev => (
                <div key={rev.id} className="place-detail-app-review-card">
                  <div className="header">
                    <div className="user-info">
                      <div className="avatar">{rev.authorName?.charAt(0)}</div>
                      <strong>{rev.authorName}</strong>
                    </div>
                    <div className="stars">
                      {Array.from({ length: 5 }, (_, i) => <Icon key={i} name="star" size={14} className={i < rev.rating ? 'on' : 'off'} />)}
                    </div>
                  </div>
                  <p>{rev.review}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {diningTab === 'contact' && (
          <div className="place-detail-app-contact">
            <div className="contact-ctas">
              {(isDining || diningProfile.contactPhone) && (
                <a href={`tel:${diningProfile.contactPhone || ''}`} className="contact-cta-btn primary">
                  <Icon name="call" size={22} />
                  <span>{t('detail', 'callNow') || 'Call Now'}</span>
                </a>
              )}
              <button className="contact-cta-btn secondary" onClick={openPlaceOnMap}>
                <Icon name="directions" size={22} />
                <span>{t('detail', 'getDirections') || 'Get Directions'}</span>
              </button>
            </div>

            <div className="contact-card">
              <Icon name="location_on" size={24} />
              <div>
                <h4>{t('detail', 'location') || 'Location'}</h4>
                <p>{place.location}</p>
              </div>
            </div>

            {diningProfile.socialMedia?.website && (
              <div className="contact-card">
                <Icon name="language" size={24} />
                <div>
                  <h4>{t('detail', 'website')}</h4>
                  <p>{diningProfile.socialMedia.website}</p>
                </div>
              </div>
            )}

            <div className="contact-socials-grid">
              {diningProfile.socialMedia?.instagram && (
                <a href={diningProfile.socialMedia.instagram} target="_blank" rel="noopener noreferrer" className="social-card instagram">
                  <Icon name="instagram" size={24} />
                  <span>Instagram</span>
                </a>
              )}
              {diningProfile.socialMedia?.facebook && (
                <a href={diningProfile.socialMedia.facebook} target="_blank" rel="noopener noreferrer" className="social-card facebook">
                  <Icon name="facebook" size={24} />
                  <span>Facebook</span>
                </a>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
