import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { getPlaceImageUrl } from '../api';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { usePlace, usePlaces } from '../hooks/usePlaces';
import { useInfiniteCommunityFeed } from '../hooks/useCommunityFeed';
import { useBusinessMe, useRedeemedCoupons } from '../hooks/useUser';
import Icon from '../components/Icon';
import FeedPostCard from '../components/FeedPostCard';
import OfferCard from '../components/OfferCard';
import { trackEvent } from '../utils/analytics';
import { COMMUNITY_PATH, PLACES_DISCOVER_PATH, discoverPlaceFeedPath } from '../utils/discoverPaths';
import './Discover.css';

const TABS = [
  { id: 'feed', icon: 'dynamic_feed', labelKey: 'tabFeed' },
  { id: 'reel', icon: 'movie', labelKey: 'tabReels' },
  { id: 'offers', icon: 'sell', labelKey: 'tabOffers' },
  { id: 'proposals', icon: 'send', labelKey: 'tabProposals' },
];

const FEED_PAGE_SIZE = 12;
const REEL_PAGE_SIZE = 10;
const SEEN_FEED_KEY = 'discover_seen_feed_v1';
const SEEN_REEL_KEY = 'discover_seen_reel_v1';

function loadSeenIds(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((x) => String(x)).filter(Boolean).slice(-4000);
  } catch {
    return [];
  }
}

function DiscoverSkeleton({ tab }) {
  if (tab === 'feed' || tab === 'reel') {
    return (
      <div className="ig-skeleton-feed" aria-hidden="true">
        {[1, 2, 3].map((i) => (
          <div key={i} className="ig-skeleton-card">
            <div className="ig-skeleton-row">
              <div className="ig-skeleton ig-skeleton--avatar" />
              <div className="ig-skeleton-lines">
                <div className="ig-skeleton ig-skeleton--line-short" />
                <div className="ig-skeleton ig-skeleton--line-tiny" />
              </div>
            </div>
            <div className="ig-skeleton ig-skeleton--media" />
            <div className="ig-skeleton ig-skeleton--line" />
          </div>
        ))}
      </div>
    );
  }
  if (tab === 'offers') {
    return (
      <div className="ig-skeleton-offers" aria-hidden="true">
        {[1, 2, 3].map((i) => (
          <div key={i} className="ig-skeleton-offer-card">
            <div className="ig-skeleton ig-skeleton--pill" />
            <div className="ig-skeleton ig-skeleton--line" />
            <div className="ig-skeleton ig-skeleton--line-short" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="ig-skeleton-proposals" aria-hidden="true">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="ig-skeleton ig-skeleton--square" />
      ))}
    </div>
  );
}

function DiscoverProposalPanel({ places, t, user }) {
  const [selectedId, setSelectedId] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [formError, setFormError] = useState(null);
  useEffect(() => {
    if (user?.email) setGuestEmail(user.email);
  }, [user?.email]);

  useEffect(() => {
    setFeedback(null);
  }, [selectedId]);

  const filteredPlaces = useMemo(() => {
    const qq = searchQ.trim().toLowerCase();
    const base = Array.isArray(places) ? places : [];
    if (!qq) return base.slice(0, 200);
    return base
      .filter((p) => {
        const name = String(p.name || '').toLowerCase();
        const loc = String(p.location || '').toLowerCase();
        const cat = String(p.category || '').toLowerCase();
        const desc = String(p.description || '').toLowerCase();
        return name.includes(qq) || loc.includes(qq) || cat.includes(qq) || desc.includes(qq);
      })
      .slice(0, 200);
  }, [places, searchQ]);

  const hasActiveSearch = searchQ.trim().length > 0;

  const selectedPlace = useMemo(
    () => (Array.isArray(places) ? places.find((p) => String(p.id) === selectedId) : null),
    [places, selectedId]
  );

  function phoneOk() {
    return (guestPhone.trim().match(/\d/g) || []).length >= 8;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setFormError(null);
    setFeedback(null);
    if (!selectedId) {
      setFormError(t('discover', 'proposalPickPlace'));
      return;
    }
    if (!user && !guestName.trim()) {
      setFormError(t('discover', 'proposalNeedName'));
      return;
    }
    const em = guestEmail.trim();
    if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      setFormError(t('discover', 'proposalNeedEmail'));
      return;
    }
    if (!phoneOk()) {
      setFormError(t('discover', 'proposalPhoneInvalid'));
      return;
    }
    const msg = message.trim();
    if (msg.length < 3) return;
    setSending(true);
    try {
      const body = user
        ? { message: msg, guestEmail: em, guestPhone: guestPhone.trim() }
        : {
            message: msg,
            guestName: guestName.trim(),
            guestEmail: em,
            guestPhone: guestPhone.trim(),
          };
      const data = await api.places.inquiry(selectedId, body);
      const ref = data?.id != null ? String(data.id) : '';
      const serverMsg = typeof data?.message === 'string' ? data.message.trim() : '';
      setFeedback(
        serverMsg
          ? `${serverMsg}${ref ? ` (#${ref})` : ''}`
          : t('discover', 'proposalSentOk').replace('{id}', ref || '—')
      );
      setMessage('');
      if (!user) setGuestName('');
    } catch (err) {
      if (err?.data?.code === 'MESSAGING_BLOCKED') {
        setFormError(t('discover', 'messagingBlockedByVenue'));
      } else {
        setFormError(err?.message || t('discover', 'error'));
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="ig-proposal-flow">
      {user?.id ? (
        <p className="ig-proposal-messages-cta">
          <Link to="/messages" className="ig-proposal-messages-cta-link">
            <Icon name="mark_email_read" size={22} className="ig-proposal-messages-cta-icon" aria-hidden="true" />
            {t('discover', 'proposalOpenMessagesPage')}
          </Link>
        </p>
      ) : (
        <p className="ig-proposal-signin-hint">
          {t('discover', 'proposalMyMessagesSignInHint')}{' '}
          <Link to="/login" className="ig-proposal-signin-link">
            {t('discover', 'proposalMyMessagesSignInCta')}
          </Link>
        </p>
      )}
      <p className="ig-proposal-intro">{t('discover', 'proposalIntro')}</p>
      <div className="ig-proposal-panel">
        <h2 className="ig-proposal-step-title">{t('discover', 'proposalStepPlace')}</h2>
        <div className="ig-proposal-search-row">
          <div className="ig-proposal-search-wrap" role="search">
            <Icon name="search" size={22} className="ig-proposal-search-icon" aria-hidden="true" />
            <input
              type="search"
              className="ig-proposal-search"
              placeholder={t('discover', 'proposalSearchPlaceholder')}
              aria-label={t('discover', 'proposalSearchPlaceholder')}
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              enterKeyHint="search"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            {hasActiveSearch && (
              <button
                type="button"
                className="ig-proposal-search-clear"
                onClick={() => setSearchQ('')}
                aria-label={t('discover', 'proposalSearchClear')}
              >
                <Icon name="close" size={20} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
        <div className="ig-proposal-pick-grid" role="listbox" aria-label={t('discover', 'proposalStepPlace')}>
          {filteredPlaces.length === 0 ? (
            <div className="ig-proposal-grid-empty">
              <Icon name="travel_explore" size={40} className="ig-proposal-grid-empty-icon" aria-hidden="true" />
              <p className="ig-proposal-grid-empty-text">
                {hasActiveSearch ? t('discover', 'proposalSearchNoResults') : t('discover', 'emptyProposals')}
              </p>
            </div>
          ) : (
            filteredPlaces.map((place) => {
              const pid = place.id != null ? String(place.id) : '';
              const img = getPlaceImageUrl(place.image || (Array.isArray(place.images) && place.images[0]));
              const sel = selectedId === pid;
              return (
                <button
                  key={pid || place.name}
                  type="button"
                  role="option"
                  aria-selected={sel}
                  className={`ig-proposal-pick-cell ${sel ? 'ig-proposal-pick-cell--selected' : ''}`}
                  onClick={() => setSelectedId(pid)}
                >
                  <div
                    className="ig-proposal-pick-thumb"
                    style={{ backgroundImage: img ? `url(${img})` : undefined }}
                  >
                    {!img && <Icon name="location_city" size={28} className="ig-proposal-pick-fallback" aria-hidden="true" />}
                  </div>
                  <span className="ig-proposal-pick-name" title={place.name}>
                    {place.name}
                  </span>
                </button>
              );
            })
          )}
        </div>
        {selectedPlace && (
          <p className="ig-proposal-selected">
            <span className="ig-proposal-selected-name">{selectedPlace.name}</span>
            <button type="button" className="ig-proposal-change" onClick={() => setSelectedId('')}>
              {t('discover', 'proposalChangePlace')}
            </button>
          </p>
        )}
      </div>

      {!selectedId ? (
        <div className="ig-proposal-locked" aria-live="polite">
          <Icon name="touch_app" size={36} className="ig-proposal-locked-icon" aria-hidden="true" />
          <p className="ig-proposal-locked-text">{t('discover', 'proposalSelectPlaceFirst')}</p>
        </div>
      ) : (
        <form className="ig-proposal-form" onSubmit={onSubmit}>
          <h2 className="ig-proposal-step-title">{t('discover', 'proposalStepContact')}</h2>
          {!user && (
            <label className="ig-proposal-field">
              <span>{t('detail', 'yourName')}</span>
              <input
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                required
                autoComplete="name"
              />
            </label>
          )}
          <div className="ig-proposal-field-row">
            <label className="ig-proposal-field">
              <span>{t('detail', 'yourEmail')}</span>
              <input
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </label>
            <label className="ig-proposal-field">
              <span>{t('detail', 'mobilePhone')}</span>
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
          <h2 className="ig-proposal-step-title">{t('discover', 'proposalStepMessage')}</h2>
          <label className="ig-proposal-field ig-proposal-field--full">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              minLength={3}
              maxLength={8000}
              rows={5}
              placeholder={t('discover', 'proposalOfferPlaceholder')}
            />
          </label>
          {formError && <p className="ig-proposal-error" role="alert">{formError}</p>}
          {feedback && <p className="ig-proposal-success" role="status">{feedback}</p>}
          <button
            type="submit"
            className="ig-proposal-submit"
            disabled={sending || message.trim().length < 3 || !phoneOk()}
          >
            {sending ? t('discover', 'proposalSending') : t('discover', 'proposalSubmit')}
          </button>
        </form>
      )}
    </div>
  );
}

function DiscoverEmpty({ icon, message, t }) {
  return (
    <div className="ig-empty">
      <div className="ig-empty-glow" aria-hidden="true" />
      <span className="ig-empty-icon">
        <Icon name={icon} size={52} />
      </span>
      <p className="ig-empty-text">{message}</p>
      <div className="ig-empty-actions">
        <Link to="/" className="ig-empty-btn ig-empty-btn--ghost">{t('discover', 'emptyCtaHome')}</Link>
        <Link to={PLACES_DISCOVER_PATH} className="ig-empty-btn">{t('discover', 'emptyCtaExplore')}</Link>
      </div>
    </div>
  );
}

export default function Discover() {
  const { placeId: placeScopeId } = useParams();
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const [tab, setTab] = useState('feed');
  const [activeReelId, setActiveReelId] = useState(null);

  const discoverBasePath = placeScopeId ? discoverPlaceFeedPath(placeScopeId) : COMMUNITY_PATH;

  // --- Core Data Hooks ---
  const { data: placeScopeMeta } = usePlace(placeScopeId, { lang });
  const { data: businessMe } = useBusinessMe();
  const { data: placesRes } = usePlaces();
  const { data: redeemedRes } = useRedeemedCoupons();

  const {
    data: feedData,
    fetchNextPage: fetchNextFeed,
    hasNextPage: hasMoreFeed,
    isFetchingNextPage: loadingMoreFeed,
    isLoading: loadingFeed,
  } = useInfiniteCommunityFeed({
    format: 'post',
    limit: FEED_PAGE_SIZE,
    sort: 'recent',
    ...(placeScopeId ? { placeId: placeScopeId } : {}),
  });

  const {
    data: reelsData,
    fetchNextPage: fetchNextReels,
    hasNextPage: hasMoreReels,
    isFetchingNextPage: loadingMoreReels,
    isLoading: loadingReels,
  } = useInfiniteCommunityFeed({
    format: 'reel',
    limit: REEL_PAGE_SIZE,
    sort: 'recent',
    ...(placeScopeId ? { placeId: placeScopeId } : {}),
  });

  const feedPosts = useMemo(() => feedData?.pages.flatMap(p => p.posts) || [], [feedData]);
  const reels = useMemo(() => reelsData?.pages.flatMap(p => p.posts) || [], [reelsData]);
  const places = placesRes?.locations || placesRes?.popular || [];

  const [seenFeedIds, setSeenFeedIds] = useState(() => loadSeenIds(SEEN_FEED_KEY));
  const [seenReelIds, setSeenReelIds] = useState(() => loadSeenIds(SEEN_REEL_KEY));
  const feedSentinelRef = useRef(null);
  const reelSentinelRef = useRef(null);
  const reelsStackRef = useRef(null);

  const markFeedSeen = useCallback((id) => {
    if (!id) return;
    const sid = String(id);
    setSeenFeedIds((prev) => (prev.includes(sid) ? prev : [...prev, sid].slice(-4000)));
  }, []);

  const markReelSeen = useCallback((id) => {
    if (!id) return;
    const sid = String(id);
    setSeenReelIds((prev) => (prev.includes(sid) ? prev : [...prev, sid].slice(-4000)));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SEEN_FEED_KEY, JSON.stringify(seenFeedIds));
    } catch (_err) { /* ignore */ }
  }, [seenFeedIds]);

  useEffect(() => {
    try {
      localStorage.setItem(SEEN_REEL_KEY, JSON.stringify(seenReelIds));
    } catch (_err) { /* ignore */ }
  }, [seenReelIds]);

  const orderedFeedPosts = useMemo(() => {
    if (!feedPosts.length) return feedPosts;
    const seen = new Set(seenFeedIds);
    const unseen = [];
    const seenList = [];
    for (const p of feedPosts) {
      if (seen.has(String(p.id))) seenList.push(p);
      else unseen.push(p);
    }
    return [...unseen, ...seenList];
  }, [feedPosts, seenFeedIds]);

  const orderedReels = useMemo(() => {
    if (!reels.length) return reels;
    const seen = new Set(seenReelIds);
    const unseen = [];
    const seenList = [];
    for (const p of reels) {
      if (seen.has(String(p.id))) seenList.push(p);
      else unseen.push(p);
    }
    return [...unseen, ...seenList];
  }, [reels, seenReelIds]);

  const showBusinessStudio =
    Boolean(user && businessMe && businessMe.isBusinessOwner && Number(businessMe.ownedPlaceCount) > 0);

  useEffect(() => {
    trackEvent(user, 'page_view', {
      page: placeScopeId ? 'community_place' : 'community',
      ...(placeScopeId ? { placeId: placeScopeId } : {}),
    });
  }, [user, placeScopeId]);

  useEffect(() => {
    if (tab !== 'feed' || !hasMoreFeed || loadingMoreFeed) return undefined;
    const el = feedSentinelRef.current;
    if (!el) return undefined;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void fetchNextFeed();
    }, { root: null, rootMargin: '400px', threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [tab, hasMoreFeed, loadingMoreFeed, fetchNextFeed]);

  useEffect(() => {
    if (tab !== 'reel' || !hasMoreReels || loadingMoreReels) return undefined;
    const el = reelSentinelRef.current;
    if (!el) return undefined;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void fetchNextReels();
    }, { root: null, rootMargin: '400px', threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [tab, hasMoreReels, loadingMoreReels, fetchNextReels]);

  useEffect(() => {
    if (tab !== 'feed' || orderedFeedPosts.length === 0) return undefined;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const id = en.target.getAttribute('data-post-id');
        if (id) markFeedSeen(id);
      });
    }, { threshold: 0.6 });
    document.querySelectorAll('[data-feed-kind="feed"][data-post-id]').forEach((n) => obs.observe(n));
    return () => obs.disconnect();
  }, [tab, orderedFeedPosts, markFeedSeen]);

  useEffect(() => {
    if (tab !== 'reel' || orderedReels.length === 0) return undefined;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const id = en.target.getAttribute('data-post-id');
        if (id) markReelSeen(id);
      });
    }, { threshold: [0.2, 0.4, 0.6, 0.8], root: reelsStackRef.current || null });
    document.querySelectorAll('[data-feed-kind="reel"][data-post-id]').forEach((n) => obs.observe(n));
    return () => obs.disconnect();
  }, [tab, orderedReels, markReelSeen]);

  useEffect(() => {
    if (tab !== 'reel' || orderedReels.length === 0) return undefined;
    let rafId = 0;
    const pickActive = () => {
      const nodes = document.querySelectorAll('[data-feed-kind="reel"][data-post-id]');
      const rootEl = reelsStackRef.current;
      const rootRect = rootEl ? rootEl.getBoundingClientRect() : null;
      const vpH = rootRect ? rootRect.height : window.innerHeight || 1;
      const vpTop = rootRect ? rootRect.top : 0;
      const vpBottom = rootRect ? rootRect.bottom : vpH;
      const vpCenter = vpTop + vpH / 2;
      let bestId = null;
      let bestScore = Number.POSITIVE_INFINITY;
      nodes.forEach((node) => {
        const rect = node.getBoundingClientRect();
        const visible = Math.max(0, Math.min(rect.bottom, vpBottom) - Math.max(rect.top, vpTop));
        if (visible <= 0) return;
        const center = rect.top + rect.height / 2;
        const distance = Math.abs(center - vpCenter);
        const visibilityPenalty = 1 - visible / Math.max(1, rect.height);
        const score = distance + visibilityPenalty * 200;
        if (score < bestScore) {
          bestScore = score;
          bestId = node.getAttribute('data-post-id');
        }
      });
      setActiveReelId(bestId);
      rafId = 0;
    };
    const schedulePick = () => { if (!rafId) rafId = window.requestAnimationFrame(pickActive); };
    schedulePick();
    const scrollTarget = reelsStackRef.current || window;
    scrollTarget.addEventListener('scroll', schedulePick, { passive: true });
    window.addEventListener('resize', schedulePick);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      scrollTarget.removeEventListener('scroll', schedulePick);
      window.removeEventListener('resize', schedulePick);
    };
  }, [tab, orderedReels]);

  const loading = loadingFeed || loadingReels;
  const emptyFeed = !loading && tab === 'feed' && orderedFeedPosts.length === 0;
  const emptyReels = !loading && tab === 'reel' && orderedReels.length === 0;
  const emptyOffers = tab === 'offers' && !redeemedRes; 
  const emptyPlaces = tab === 'proposals' && places.length === 0;

  return (
    <div className="ig-discover">
      <h1 className="ig-discover-page-title-sr">
        {placeScopeId ? `${t('discover', 'brandTitle')} — ${placeScopeMeta?.name || placeScopeId}` : t('discover', 'brandTitle')}
      </h1>
      {placeScopeId && (
        <div className="ig-discover-place-scope">
          <Link to={COMMUNITY_PATH} className="ig-discover-place-scope-back">
            <Icon name="arrow_back" size={20} aria-hidden />
            <span>{t('discover', 'placeScopeBack')}</span>
          </Link>
          <div className="ig-discover-place-scope-card">
            {(() => {
              const img = placeScopeMeta ? getPlaceImageUrl(placeScopeMeta.image || (Array.isArray(placeScopeMeta.images) && placeScopeMeta.images[0])) : null;
              return img ? <img src={img} alt="" className="ig-discover-place-scope-avatar" width={56} height={56} /> : (
                <span className="ig-discover-place-scope-avatar ig-discover-place-scope-avatar--fallback" aria-hidden><Icon name="storefront" size={28} /></span>
              );
            })()}
            <div className="ig-discover-place-scope-text">
              <p className="ig-discover-place-scope-kicker">{t('discover', 'placeScopeKicker')}</p>
              <h2 className="ig-discover-place-scope-title">{placeScopeMeta?.name || t('discover', 'placeScopeFallbackTitle')}</h2>
              <p className="ig-discover-place-scope-sub">{t('discover', 'placeScopeSub')}</p>
              <Link to={`/place/${encodeURIComponent(placeScopeId)}`} className="ig-discover-place-scope-details">
                {t('discover', 'placeScopePlaceDetails')}<Icon name="chevron_right" size={18} aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="ig-discover-top">
        <nav className="ig-discover-tabs" role="tablist" aria-label={t('discover', 'brandTitle')}>
          {TABS.map(({ id, icon, labelKey }) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={`ig-discover-tab ${tab === id ? 'ig-discover-tab--active' : ''}`} onClick={() => setTab(id)}>
              <Icon name={icon} size={26} className="ig-discover-tab-icon" aria-hidden="true" />
              <span className="ig-discover-tab-label">{t('discover', labelKey)}</span>
            </button>
          ))}
        </nav>
        {showBusinessStudio && (tab === 'feed' || tab === 'reel') && (
          <Link to="/business/places" className="ig-discover-business-cta ig-discover-business-cta--tabs">
            <Icon name="storefront" size={18} aria-hidden="true" />
            <span>{t('discover', 'feedBusinessStudioCta')}</span>
          </Link>
        )}
      </div>

      <main className={`ig-discover-main ${tab === 'feed' || tab === 'reel' ? 'ig-discover-main--stage' : 'ig-discover-main--browse'} ig-discover-main--${tab}`}>
        {(loadingFeed || loadingReels) && (
          <div className="ig-discover-loading-wrap">
            <DiscoverSkeleton tab={tab} /><span className="ig-discover-loading-sr">{t('discover', 'loading')}</span>
          </div>
        )}

        {emptyFeed && <DiscoverEmpty icon="dynamic_feed" message={t('discover', 'emptyFeed')} t={t} />}
        {emptyReels && <DiscoverEmpty icon="movie" message={t('discover', 'emptyReels')} t={t} />}
        {emptyOffers && <DiscoverEmpty icon="sell" message={t('discover', 'emptyOffers')} t={t} />}
        {emptyPlaces && <DiscoverEmpty icon="send" message={t('discover', 'emptyProposals')} t={t} />}

        {tab === 'feed' && orderedFeedPosts.length > 0 && (
          <>
            <div className="ig-feed-stack">
              {orderedFeedPosts.map((p, i) => (
                <div key={p.id} className="ig-feed-stagger" style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }} data-feed-kind="feed" data-post-id={String(p.id)}>
                  <FeedPostCard post={p} user={user} t={t} discoverBasePath={discoverBasePath} />
                </div>
              ))}
            </div>
            {hasMoreFeed && <div ref={feedSentinelRef} className="ig-feed-sentinel" aria-hidden="true" />}
          </>
        )}

        {tab === 'reel' && orderedReels.length > 0 && (
          <>
            <div ref={reelsStackRef} className="ig-feed-stack ig-feed-stack--reels">
              {orderedReels.map((p, i) => (
                <div key={p.id} className="ig-feed-stagger" style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }} data-feed-kind="reel" data-post-id={String(p.id)}>
                  <FeedPostCard post={p} user={user} t={t} variant="reel" discoverBasePath={discoverBasePath} isActiveReel={activeReelId === String(p.id)} />
                </div>
              ))}
            </div>
            {hasMoreReels && <div ref={reelSentinelRef} className="ig-feed-sentinel" aria-hidden="true" />}
          </>
        )}

        {!loading && tab === 'offers' && places.length > 0 && (
          <div className="offer-card-scope">
            <div className="ig-offer-list">
              {/* This section would normally fetch global offers/promotions */}
            </div>
          </div>
        )}

        {!loading && tab === 'proposals' && places.length > 0 && (
          <div className="offer-card-scope ig-proposal-flow-wrap">
            <DiscoverProposalPanel places={places} t={t} user={user} />
          </div>
        )}
      </main>
    </div>
  );
}
