import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { getPlaceImageUrl, API_ERROR_NETWORK } from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
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

/** Paginated feed (Instagram-style: small first page + infinite scroll). */
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

function discoverFetchError(err, t) {
  return err?.code === API_ERROR_NETWORK ? t('errors', 'networkError') : err?.message || t('discover', 'error');
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
  const [submittedInquiry, setSubmittedInquiry] = useState(null);
  const [replyLoading, setReplyLoading] = useState(false);
  const [replyData, setReplyData] = useState(null);
  const [replyError, setReplyError] = useState(null);

  useEffect(() => {
    if (user?.email) setGuestEmail(user.email);
  }, [user?.email]);

  useEffect(() => {
    setSubmittedInquiry(null);
    setReplyData(null);
    setReplyError(null);
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

  const searchTrim = searchQ.trim();
  const hasActiveSearch = searchTrim.length > 0;

  const selectedPlace = useMemo(
    () => places.find((p) => String(p.id) === selectedId),
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
      if (ref) setSubmittedInquiry({ placeId: selectedId, inquiryId: ref });
      setReplyData(null);
      setReplyError(null);
      setMessage('');
      if (!user) setGuestName('');
      /* Keep email & phone so guests can check replies with the same contact details. */
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

  async function checkVenueReply() {
    if (!submittedInquiry?.placeId || !submittedInquiry?.inquiryId) return;
    setReplyError(null);
    setReplyLoading(true);
    try {
      const emailForQuery = user
        ? undefined
        : guestEmail.trim().toLowerCase() || undefined;
      if (!user && !emailForQuery) {
        setReplyError(t('discover', 'proposalReplyNeedEmail'));
        setReplyLoading(false);
        return;
      }
      const data = await api.places.inquiryStatus(
        submittedInquiry.placeId,
        submittedInquiry.inquiryId,
        emailForQuery
      );
      setReplyData(data);
    } catch (err) {
      setReplyData(null);
      setReplyError(err?.message || t('discover', 'error'));
    } finally {
      setReplyLoading(false);
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
              aria-describedby={hasActiveSearch ? 'ig-proposal-search-status' : undefined}
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
          {hasActiveSearch && (
            <p id="ig-proposal-search-status" className="ig-proposal-search-meta" role="status">
              {filteredPlaces.length > 0
                ? t('discover', 'proposalSearchCount').replace('{count}', String(filteredPlaces.length))
                : t('discover', 'proposalSearchNoResults')}
            </p>
          )}
        </div>
        <div className="ig-proposal-pick-grid" role="listbox" aria-label={t('discover', 'proposalStepPlace')}>
          {filteredPlaces.length === 0 ? (
            <div className="ig-proposal-grid-empty">
              <Icon name="travel_explore" size={40} className="ig-proposal-grid-empty-icon" aria-hidden="true" />
              <p className="ig-proposal-grid-empty-text">
                {hasActiveSearch
                  ? t('discover', 'proposalSearchNoResults')
                  : t('discover', 'emptyProposals')}
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
            <button
              type="button"
              className="ig-proposal-change"
              onClick={() => setSelectedId('')}
            >
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
          <p className="ig-proposal-hint ig-proposal-hint--inline">{t('discover', 'proposalContactHint')}</p>
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
          {formError && (
            <p className="ig-proposal-error" role="alert">
              {formError}
            </p>
          )}
          {feedback && (
            <p className="ig-proposal-success" role="status">
              {feedback}
            </p>
          )}
          <button
            type="submit"
            className="ig-proposal-submit"
            disabled={sending || message.trim().length < 3 || !phoneOk()}
          >
            {sending ? t('discover', 'proposalSending') : t('discover', 'proposalSubmit')}
          </button>

          {submittedInquiry && (
            <div className="ig-proposal-reply-panel">
              <h3 className="ig-proposal-reply-title">{t('discover', 'proposalReplyTitle')}</h3>
              <p className="ig-proposal-reply-lead">{t('discover', 'proposalReplyHint')}</p>
              {!user && (
                <p className="ig-proposal-reply-email-note">{t('discover', 'proposalReplyEmailNote')}</p>
              )}
              <button
                type="button"
                className="ig-proposal-reply-btn"
                disabled={replyLoading}
                onClick={checkVenueReply}
              >
                {replyLoading ? t('discover', 'proposalReplyChecking') : t('discover', 'proposalCheckReply')}
              </button>
              {replyError && (
                <p className="ig-proposal-error" role="alert">
                  {replyError}
                </p>
              )}
              {replyData?.response && String(replyData.response).trim() && (
                <div className="ig-proposal-venue-reply">
                  <span className="ig-proposal-venue-reply-label">{t('discover', 'proposalVenueReply')}</span>
                  <p className="ig-proposal-venue-reply-text">{replyData.response}</p>
                </div>
              )}
              {replyData && replyData.status === 'open' && (!replyData.response || !String(replyData.response).trim()) && (
                <p className="ig-proposal-no-reply-yet">{t('discover', 'proposalNoReplyYet')}</p>
              )}
            </div>
          )}
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
        <Link to="/" className="ig-empty-btn ig-empty-btn--ghost">
          {t('discover', 'emptyCtaHome')}
        </Link>
        <Link to={PLACES_DISCOVER_PATH} className="ig-empty-btn">
          {t('discover', 'emptyCtaExplore')}
        </Link>
      </div>
    </div>
  );
}

export default function Discover() {
  const { placeId: placeScopeRouteParam } = useParams();
  const placeScopeId =
    placeScopeRouteParam != null && String(placeScopeRouteParam).trim() !== ''
      ? String(placeScopeRouteParam).trim()
      : null;
  const discoverBasePath = placeScopeId ? discoverPlaceFeedPath(placeScopeId) : COMMUNITY_PATH;

  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const [tab, setTab] = useState('feed');
  const [feedPosts, setFeedPosts] = useState([]);
  const [reels, setReels] = useState([]);
  const [feedNextOffset, setFeedNextOffset] = useState(0);
  const [feedHasMore, setFeedHasMore] = useState(true);
  const [feedLoadingMore, setFeedLoadingMore] = useState(false);
  const [reelNextOffset, setReelNextOffset] = useState(0);
  const [reelHasMore, setReelHasMore] = useState(true);
  const [reelLoadingMore, setReelLoadingMore] = useState(false);
  const [activeReelId, setActiveReelId] = useState(null);
  const [seenFeedIds, setSeenFeedIds] = useState(() => loadSeenIds(SEEN_FEED_KEY));
  const [seenReelIds, setSeenReelIds] = useState(() => loadSeenIds(SEEN_REEL_KEY));
  const feedSentinelRef = useRef(null);
  const reelSentinelRef = useRef(null);
  const [promotions, setPromotions] = useState([]);
  const [redeemedPromotionIds, setRedeemedPromotionIds] = useState([]);
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [placeScopeMeta, setPlaceScopeMeta] = useState(null);

  useEffect(() => {
    if (!placeScopeId) {
      setPlaceScopeMeta(null);
      return;
    }
    let cancelled = false;
    const langParam = lang === 'ar' ? 'ar' : lang === 'fr' ? 'fr' : 'en';
    api.places
      .get(placeScopeId, { lang: langParam })
      .then((p) => {
        if (!cancelled) setPlaceScopeMeta(p && p.id != null ? p : null);
      })
      .catch(() => {
        if (!cancelled) setPlaceScopeMeta(null);
      });
    return () => {
      cancelled = true;
    };
  }, [placeScopeId, lang]);

  const patchFeedPost = useCallback((id, patch) => {
    const sid = String(id);
    setFeedPosts((prev) => prev.map((p) => (String(p.id) === sid ? { ...p, ...patch } : p)));
  }, []);

  const patchReelPost = useCallback((id, patch) => {
    const sid = String(id);
    setReels((prev) => prev.map((p) => (String(p.id) === sid ? { ...p, ...patch } : p)));
  }, []);

  const removeFeedPost = useCallback((id) => {
    const sid = String(id);
    setFeedPosts((prev) => prev.filter((p) => String(p.id) !== sid));
  }, []);

  const removeReelPost = useCallback((id) => {
    const sid = String(id);
    setReels((prev) => prev.filter((p) => String(p.id) !== sid));
  }, []);

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
    } catch (_) {}
  }, [seenFeedIds]);

  useEffect(() => {
    try {
      localStorage.setItem(SEEN_REEL_KEY, JSON.stringify(seenReelIds));
    } catch (_) {}
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

  const loadMoreFeed = useCallback(async () => {
    if (!feedHasMore || feedLoadingMore) return;
    setFeedLoadingMore(true);
    setError(null);
    try {
      const r = await api.communityFeed({
        format: 'post',
        limit: FEED_PAGE_SIZE,
        offset: feedNextOffset,
        sort: 'recent',
        ...(placeScopeId ? { placeId: placeScopeId } : {}),
      });
      const list = Array.isArray(r.posts) ? r.posts : [];
      setFeedPosts((prev) => {
        const seen = new Set(prev.map((p) => String(p.id)));
        const out = [...prev];
        for (const p of list) {
          const id = String(p.id);
          if (!seen.has(id)) {
            seen.add(id);
            out.push(p);
          }
        }
        return out;
      });
      setFeedNextOffset((o) => o + list.length);
      const more =
        r.hasMore === true || (r.hasMore === undefined && list.length >= FEED_PAGE_SIZE);
      setFeedHasMore(list.length > 0 && more);
    } catch (err) {
      setError(discoverFetchError(err, t));
    } finally {
      setFeedLoadingMore(false);
    }
  }, [feedHasMore, feedLoadingMore, feedNextOffset, placeScopeId, t]);

  const loadMoreReels = useCallback(async () => {
    if (!reelHasMore || reelLoadingMore) return;
    setReelLoadingMore(true);
    setError(null);
    try {
      const r = await api.communityFeed({
        format: 'reel',
        limit: REEL_PAGE_SIZE,
        offset: reelNextOffset,
        sort: 'recent',
        ...(placeScopeId ? { placeId: placeScopeId } : {}),
      });
      const list = Array.isArray(r.posts) ? r.posts : [];
      setReels((prev) => {
        const seen = new Set(prev.map((p) => String(p.id)));
        const out = [...prev];
        for (const p of list) {
          const id = String(p.id);
          if (!seen.has(id)) {
            seen.add(id);
            out.push(p);
          }
        }
        return out;
      });
      setReelNextOffset((o) => o + list.length);
      const more =
        r.hasMore === true || (r.hasMore === undefined && list.length >= REEL_PAGE_SIZE);
      setReelHasMore(list.length > 0 && more);
    } catch (err) {
      setError(discoverFetchError(err, t));
    } finally {
      setReelLoadingMore(false);
    }
  }, [reelHasMore, reelLoadingMore, reelNextOffset, placeScopeId, t]);

  const [businessMe, setBusinessMe] = useState(null);

  useEffect(() => {
    if (!user) {
      setBusinessMe(null);
      return;
    }
    let cancelled = false;
    api.business
      .me()
      .then((data) => {
        if (!cancelled) setBusinessMe(data);
      })
      .catch(() => {
        if (!cancelled) setBusinessMe(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const showBusinessStudio =
    Boolean(user && businessMe && businessMe.isBusinessOwner && Number(businessMe.ownedPlaceCount) > 0);

  useEffect(() => {
    trackEvent(user, 'page_view', {
      page: placeScopeId ? 'community_place' : 'community',
      ...(placeScopeId ? { placeId: placeScopeId } : {}),
    });
  }, [user, placeScopeId]);

  useEffect(() => {
    const posts = tab === 'feed' ? orderedFeedPosts : orderedReels;
    if (loading || (tab !== 'feed' && tab !== 'reel') || posts.length === 0) return undefined;
    const hash = window.location.hash;
    if (!hash.startsWith('#feed-post-')) return undefined;
    const raw = hash.replace('#feed-post-', '');
    let cancelled = false;
    const raf = requestAnimationFrame(() => {
      if (cancelled) return;
      document.getElementById(`feed-post-${raw}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [loading, tab, orderedFeedPosts, orderedReels]);

  useEffect(() => {
    if (!user) {
      setRedeemedPromotionIds([]);
      return;
    }
    if (tab !== 'offers') return undefined;
    let cancelled = false;
    api.coupons
      .redeemed()
      .then((r) => {
        if (cancelled) return;
        const ids = Array.isArray(r.couponIds) ? r.couponIds.map((id) => `coupon-${id}`) : [];
        setRedeemedPromotionIds(ids);
      })
      .catch(() => {
        if (!cancelled) setRedeemedPromotionIds([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user, tab]);

  useEffect(() => {
    if (tab !== 'feed') return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setFeedPosts([]);
    setFeedNextOffset(0);
    setFeedHasMore(true);
    setFeedLoadingMore(false);
    api
      .communityFeed({
        format: 'post',
        limit: FEED_PAGE_SIZE,
        offset: 0,
        sort: 'recent',
        ...(placeScopeId ? { placeId: placeScopeId } : {}),
      })
      .then((r) => {
        if (cancelled) return;
        const list = Array.isArray(r.posts) ? r.posts : [];
        setFeedPosts(list);
        setFeedNextOffset(list.length);
        const more =
          r.hasMore === true || (r.hasMore === undefined && list.length >= FEED_PAGE_SIZE);
        setFeedHasMore(list.length > 0 && more);
      })
      .catch((err) => {
        if (!cancelled) setError(discoverFetchError(err, t));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, placeScopeId, t]);

  useEffect(() => {
    if (tab !== 'reel') return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setReels([]);
    setReelNextOffset(0);
    setReelHasMore(true);
    setReelLoadingMore(false);
    api
      .communityFeed({
        format: 'reel',
        limit: REEL_PAGE_SIZE,
        offset: 0,
        sort: 'recent',
        ...(placeScopeId ? { placeId: placeScopeId } : {}),
      })
      .then((r) => {
        if (cancelled) return;
        const list = Array.isArray(r.posts) ? r.posts : [];
        setReels(list);
        setReelNextOffset(list.length);
        const more =
          r.hasMore === true || (r.hasMore === undefined && list.length >= REEL_PAGE_SIZE);
        setReelHasMore(list.length > 0 && more);
      })
      .catch((err) => {
        if (!cancelled) setError(discoverFetchError(err, t));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, placeScopeId, t]);

  useEffect(() => {
    if (tab !== 'offers') return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .publicPromotions({ limit: 100 })
      .then((r) => {
        if (cancelled) return;
        let list = Array.isArray(r.promotions) ? r.promotions : [];
        if (placeScopeId) {
          list = list.filter((pr) => String(pr.placeId) === String(placeScopeId));
        }
        setPromotions(list);
      })
      .catch((err) => {
        if (!cancelled) setError(discoverFetchError(err, t));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, placeScopeId, t]);

  useEffect(() => {
    if (tab !== 'proposals' || !placeScopeId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const langParam = lang === 'ar' ? 'ar' : lang === 'fr' ? 'fr' : 'en';
    api.places
      .get(placeScopeId, { lang: langParam })
      .then((p) => {
        if (!cancelled) setPlaces(p && p.id != null ? [p] : []);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(discoverFetchError(err, t));
          setPlaces([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, placeScopeId, lang, t]);

  useEffect(() => {
    if (tab !== 'proposals' || placeScopeId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const langParam = lang === 'ar' ? 'ar' : lang === 'fr' ? 'fr' : 'en';
    api.places
      .list({ lang: langParam })
      .then((r) => {
        const list = r.popular || r.locations || [];
        if (!cancelled) setPlaces(Array.isArray(list) ? list.slice(0, 200) : []);
      })
      .catch((err) => {
        if (!cancelled) setError(discoverFetchError(err, t));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, placeScopeId, lang, t]);

  useEffect(() => {
    if (tab !== 'feed' || !feedHasMore || feedLoadingMore) return undefined;
    const el = feedSentinelRef.current;
    if (!el) return undefined;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMoreFeed();
      },
      { root: null, rootMargin: '400px', threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [tab, feedHasMore, feedLoadingMore, feedPosts.length, loadMoreFeed]);

  useEffect(() => {
    if (tab !== 'reel' || !reelHasMore || reelLoadingMore) return undefined;
    const el = reelSentinelRef.current;
    if (!el) return undefined;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMoreReels();
      },
      { root: null, rootMargin: '400px', threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [tab, reelHasMore, reelLoadingMore, reels.length, loadMoreReels]);

  useEffect(() => {
    if (tab !== 'feed' || orderedFeedPosts.length === 0) return undefined;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          const id = en.target.getAttribute('data-post-id');
          if (id) markFeedSeen(id);
        });
      },
      { threshold: 0.6 }
    );
    const nodes = document.querySelectorAll('[data-feed-kind="feed"][data-post-id]');
    nodes.forEach((n) => obs.observe(n));
    return () => obs.disconnect();
  }, [tab, orderedFeedPosts, markFeedSeen]);

  useEffect(() => {
    if (tab !== 'reel' || orderedReels.length === 0) return undefined;
    const obs = new IntersectionObserver(
      (entries) => {
        let bestId = null;
        let bestRatio = 0;
        entries.forEach((en) => {
          if (en.isIntersecting && en.intersectionRatio >= bestRatio) {
            bestRatio = en.intersectionRatio;
            bestId = en.target.getAttribute('data-post-id');
          }
          if (!en.isIntersecting) return;
          const id = en.target.getAttribute('data-post-id');
          if (id) markReelSeen(id);
        });
        setActiveReelId(bestRatio > 0 ? bestId : null);
      },
      { threshold: [0.2, 0.4, 0.6, 0.8] }
    );
    const nodes = document.querySelectorAll('[data-feed-kind="reel"][data-post-id]');
    nodes.forEach((n) => obs.observe(n));
    return () => obs.disconnect();
  }, [tab, orderedReels, markReelSeen]);

  useEffect(() => {
    if (tab !== 'reel') setActiveReelId(null);
  }, [tab]);

  const emptyFeed =
    !loading && !error && !feedLoadingMore && tab === 'feed' && orderedFeedPosts.length === 0;
  const emptyReels =
    !loading && !error && !reelLoadingMore && tab === 'reel' && orderedReels.length === 0;
  const emptyOffers = !loading && !error && tab === 'offers' && promotions.length === 0;
  const emptyPlaces = !loading && !error && tab === 'proposals' && places.length === 0;

  return (
    <div className="ig-discover">
      <h1 className="ig-discover-page-title-sr">
        {placeScopeId
          ? `${t('discover', 'brandTitle')} — ${placeScopeMeta?.name || placeScopeId}`
          : t('discover', 'brandTitle')}
      </h1>
      {placeScopeId ? (
        <div className="ig-discover-place-scope">
          <Link to={COMMUNITY_PATH} className="ig-discover-place-scope-back">
            <Icon name="arrow_back" size={20} aria-hidden />
            <span>{t('discover', 'placeScopeBack')}</span>
          </Link>
          <div className="ig-discover-place-scope-card">
            {(() => {
              const img = placeScopeMeta
                ? getPlaceImageUrl(
                    placeScopeMeta.image ||
                      (Array.isArray(placeScopeMeta.images) && placeScopeMeta.images[0])
                  )
                : null;
              return img ? (
                <img src={img} alt="" className="ig-discover-place-scope-avatar" width={56} height={56} />
              ) : (
                <span className="ig-discover-place-scope-avatar ig-discover-place-scope-avatar--fallback" aria-hidden>
                  <Icon name="storefront" size={28} />
                </span>
              );
            })()}
            <div className="ig-discover-place-scope-text">
              <p className="ig-discover-place-scope-kicker">{t('discover', 'placeScopeKicker')}</p>
              <h2 className="ig-discover-place-scope-title">
                {placeScopeMeta?.name != null && String(placeScopeMeta.name).trim()
                  ? String(placeScopeMeta.name).trim()
                  : t('discover', 'placeScopeFallbackTitle')}
              </h2>
              <p className="ig-discover-place-scope-sub">{t('discover', 'placeScopeSub')}</p>
              <Link to={`/place/${encodeURIComponent(placeScopeId)}`} className="ig-discover-place-scope-details">
                {t('discover', 'placeScopePlaceDetails')}
                <Icon name="chevron_right" size={18} aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      <div className="ig-discover-top">
        <nav className="ig-discover-tabs" role="tablist" aria-label={t('discover', 'brandTitle')}>
          {TABS.map(({ id, icon, labelKey }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`ig-discover-tab ${tab === id ? 'ig-discover-tab--active' : ''}`}
              onClick={() => setTab(id)}
            >
              <Icon name={icon} size={26} className="ig-discover-tab-icon" aria-hidden="true" />
              <span className="ig-discover-tab-label">{t('discover', labelKey)}</span>
            </button>
          ))}
        </nav>
        {showBusinessStudio && (tab === 'feed' || tab === 'reel') ? (
          <Link to="/business/places" className="ig-discover-business-cta ig-discover-business-cta--tabs">
            <Icon name="storefront" size={18} aria-hidden="true" />
            <span>{t('discover', 'feedBusinessStudioCta')}</span>
          </Link>
        ) : null}
      </div>

      <main
        className={`ig-discover-main ${
          tab === 'feed' || tab === 'reel' ? 'ig-discover-main--stage' : 'ig-discover-main--browse'
        }`}
      >
        {loading && (
          <div className="ig-discover-loading-wrap">
            <DiscoverSkeleton tab={tab} />
            <span className="ig-discover-loading-sr">{t('discover', 'loading')}</span>
          </div>
        )}

        {error && !loading && <div className="ig-discover-error">{error}</div>}

        {emptyFeed && <DiscoverEmpty icon="dynamic_feed" message={t('discover', 'emptyFeed')} t={t} />}
        {emptyReels && <DiscoverEmpty icon="movie" message={t('discover', 'emptyReels')} t={t} />}
        {emptyOffers && <DiscoverEmpty icon="sell" message={t('discover', 'emptyOffers')} t={t} />}
        {emptyPlaces && <DiscoverEmpty icon="send" message={t('discover', 'emptyProposals')} t={t} />}

        {!loading && !error && tab === 'feed' && orderedFeedPosts.length > 0 && (
          <>
            <div className="ig-feed-stack">
              {orderedFeedPosts.map((p, i) => (
                <div
                  key={p.id}
                  className="ig-feed-stagger"
                  style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
                  data-feed-kind="feed"
                  data-post-id={String(p.id)}
                >
                  <FeedPostCard
                    post={p}
                    user={user}
                    onPatch={patchFeedPost}
                    onRemove={removeFeedPost}
                    t={t}
                    discoverBasePath={discoverBasePath}
                  />
                </div>
              ))}
            </div>
            {feedHasMore ? <div ref={feedSentinelRef} className="ig-feed-sentinel" aria-hidden="true" /> : null}
            {feedLoadingMore ? (
              <div className="ig-feed-load-more" role="status" aria-live="polite">
                <span className="ig-feed-load-more-spinner" aria-hidden="true" />
                <span className="ig-discover-loading-sr">{t('discover', 'loading')}</span>
              </div>
            ) : null}
          </>
        )}

        {!loading && !error && tab === 'reel' && orderedReels.length > 0 && (
          <>
            <div className="ig-feed-stack">
              {orderedReels.map((p, i) => (
                <div
                  key={p.id}
                  className="ig-feed-stagger"
                  style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
                  data-feed-kind="reel"
                  data-post-id={String(p.id)}
                >
                  <FeedPostCard
                    post={p}
                    user={user}
                    onPatch={patchReelPost}
                    onRemove={removeReelPost}
                    t={t}
                    variant="reel"
                    discoverBasePath={discoverBasePath}
                    isActiveReel={activeReelId === String(p.id)}
                  />
                </div>
              ))}
            </div>
            {reelHasMore ? <div ref={reelSentinelRef} className="ig-feed-sentinel" aria-hidden="true" /> : null}
            {reelLoadingMore ? (
              <div className="ig-feed-load-more" role="status" aria-live="polite">
                <span className="ig-feed-load-more-spinner" aria-hidden="true" />
                <span className="ig-discover-loading-sr">{t('discover', 'loading')}</span>
              </div>
            ) : null}
          </>
        )}

        {!loading && !error && tab === 'offers' && promotions.length > 0 && (
          <div className="offer-card-scope">
            <div className="ig-offer-list">
              {promotions.map((pr, i) => (
                <OfferCard
                  key={pr.id}
                  item={pr}
                  index={i}
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

        {!loading && !error && tab === 'proposals' && places.length > 0 && (
          <div className="offer-card-scope ig-proposal-flow-wrap">
            <DiscoverProposalPanel places={places} t={t} user={user} />
          </div>
        )}
      </main>
    </div>
  );
}
