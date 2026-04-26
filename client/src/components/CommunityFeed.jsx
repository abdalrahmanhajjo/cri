import { useMemo, useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Link } from 'react-router-dom';
import { getImageUrl, fixImageUrlExtension, getPlaceImageUrl } from '../api/client';
import Icon from './Icon';
import { COMMUNITY_PATH, discoverPlaceFeedPath } from '../utils/discoverPaths';
import { isLikelyDirectStreamableVideo } from '../utils/feedVideoPlayback';
import { rawFeedImageUrls } from '../utils/feedPostImages';
import { getDeliveryImgProps } from '../utils/responsiveImages.js';
import { optimizeVideoPosterUrl } from '../utils/supabaseImage.js';

export function isCommunityFeedVideo(post) {
  const t = String(post?.type || '').toLowerCase();
  if (t === 'reel' || t === 'video') return true;
  const hasImage = rawFeedImageUrls(post).length > 0;
  const hasVideo = !!(post?.video_url && String(post.video_url).trim());
  return hasVideo && !hasImage;
}

export function communityFeedEngagementScore(post) {
  const likes = Number(post?.likes_count) || 0;
  const comments = Number(post?.comments_count) || 0;
  return likes + comments;
}

export function pickBestMixedFour(posts) {
  if (!Array.isArray(posts) || posts.length === 0) return [];
  const reels = posts.filter((p) => isCommunityFeedVideo(p));
  const stills = posts.filter((p) => !isCommunityFeedVideo(p));
  if (!reels.length) return stills.slice(0, 4);
  if (!stills.length) return reels.slice(0, 4);
  const out = [];
  let ri = 0, si = 0;
  let takeReel = communityFeedEngagementScore(reels[0]) >= communityFeedEngagementScore(stills[0]);
  while (out.length < 4 && (ri < reels.length || si < stills.length)) {
    if (takeReel) {
      if (ri < reels.length) out.push(reels[ri++]);
      else if (si < stills.length) out.push(stills[si++]);
    } else if (si < stills.length) out.push(stills[si++]);
    else if (ri < reels.length) out.push(reels[ri++]);
    takeReel = !takeReel;
  }
  return out;
}

export function pickBestMixedThree(posts) {
  return pickBestMixedFour(posts).slice(0, 3);
}

function feedMediaUrl(url) {
  if (!url || typeof url !== 'string') return '';
  return getImageUrl(fixImageUrlExtension(url));
}

function useMobile() {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 767 : false
  );
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e) => setMobile(e.matches);
    mq.addEventListener('change', handler);
    setMobile(mq.matches);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return mobile;
}

/* ─── DESKTOP card (unchanged) ──────────────────────────── */
export function CommunityFeedCard({ post, t }) {
  const { lang } = useLanguage();
  const isVideo = isCommunityFeedVideo(post);
  const fullCap = post.caption != null ? String(post.caption) : '';
  const caption = fullCap.slice(0, 160);
  const placeId = post.place_id != null ? String(post.place_id) : '';
  const placeName = post.place_name != null ? String(post.place_name).trim() : '';
  const uploaderName =
    post.author_name != null && String(post.author_name).trim() ? String(post.author_name).trim() : '';
  const showUploaderByline = Boolean(uploaderName);
  const firstRaw = rawFeedImageUrls(post)[0];
  const img = firstRaw ? feedMediaUrl(firstRaw) : '';
  const vid = post.video_url ? feedMediaUrl(post.video_url) : '';
  const showVideo = isVideo && vid && isLikelyDirectStreamableVideo(vid, post.video_url);
  const externalVideo = isVideo && post.video_url && !showVideo;
  const typeLower = String(post?.type || '').toLowerCase();
  const reelLabel = typeLower === 'reel' ? t('home', 'communityReel') : t('home', 'communityVideo');

  return (
    <article className="vd-community-feed-card" role="listitem">
      <div className="vd-community-feed-card-media">
        {showVideo ? (
          <video className="vd-community-feed-video" src={vid} muted loop playsInline autoPlay preload="auto"
            poster={img ? optimizeVideoPosterUrl(img) : undefined}
            aria-label={fullCap.slice(0, 120) || reelLabel} />
        ) : img ? (
          <img alt="" className="vd-community-feed-img" loading="lazy" decoding="async" {...getDeliveryImgProps(img, 'gridCard')} />
        ) : (
          <div className="vd-community-feed-placeholder" aria-hidden="true" />
        )}
        {externalVideo && (
          <a href={String(post.video_url).trim()} target="_blank" rel="noopener noreferrer" className="vd-community-feed-ext-link">
            {t('home', 'communityWatchVideo')}
          </a>
        )}
        {isVideo && <span className="vd-community-feed-reel-badge">{reelLabel}</span>}
      </div>
      <div className="vd-community-feed-card-body">
        <div className="vd-community-feed-card-content">
          <p className="vd-community-feed-caption">
            {caption}{fullCap.length > 160 ? '…' : ''}
          </p>
        </div>
        <div className="vd-community-feed-glass-footer">
          <div className="vd-community-feed-meta">
            {placeId ? (
              <Link to={discoverPlaceFeedPath(placeId)} className="vd-community-feed-place-row" title={t('discover', 'feedVenueHubTitle')}>
                {(() => {
                  const av = post.place_image_url ? getPlaceImageUrl(String(post.place_image_url).trim()) : null;
                  return av ? (
                    <img alt="" className="vd-community-feed-place-avatar" width={28} height={28} loading="lazy" decoding="async" {...getDeliveryImgProps(av, 'thumb')} />
                  ) : (
                    <span className="vd-community-feed-place-avatar vd-community-feed-place-avatar--icon" aria-hidden>
                      <Icon name="storefront" size={14} />
                    </span>
                  );
                })()}
                <span className="vd-community-feed-meta-titles">
                  {placeName ? <span className="vd-community-feed-author">{placeName}</span> : null}
                  {showUploaderByline ? <span className="vd-community-feed-uploader">{uploaderName}</span> : null}
                </span>
              </Link>
            ) : placeName ? (
              <span className="vd-community-feed-meta-titles">
                <span className="vd-community-feed-author">{placeName}</span>
                {showUploaderByline ? <span className="vd-community-feed-uploader">{uploaderName}</span> : null}
              </span>
            ) : showUploaderByline ? (
              <span className="vd-community-feed-uploader vd-community-feed-uploader--solo">{uploaderName}</span>
            ) : null}
          </div>
          {placeId && (
            <Link to={`${COMMUNITY_PATH}#feed-post-${post.id}`} className="vd-community-feed-cta">
              {t('home', 'communityViewPost')}
              <Icon name={lang === "ar" ? "arrow_back" : "arrow_forward"} size={16} className="vd-btn-arrow" />
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

/* ─── MOBILE premium story card ─────────────────────────── */
function MobileStoryCard({ post, t }) {
  const { lang } = useLanguage();
  const isVideo = isCommunityFeedVideo(post);
  const fullCap = post.caption != null ? String(post.caption) : '';
  const caption = fullCap.slice(0, 90);
  const placeId = post.place_id != null ? String(post.place_id) : '';
  const placeName = post.place_name != null ? String(post.place_name).trim() : '';
  const uploaderName = post.author_name ? String(post.author_name).trim() : '';
  const firstRaw = rawFeedImageUrls(post)[0];
  const img = firstRaw ? feedMediaUrl(firstRaw) : '';
  const vid = post.video_url ? feedMediaUrl(post.video_url) : '';
  const showVideo = isVideo && vid && isLikelyDirectStreamableVideo(vid, post.video_url);
  const shortName = placeName || t('home', 'place'); // show full name, CSS handles overflow

  return (
    <article style={{
      width: '100%',
      height: '420px',
      borderRadius: '24px',
      overflow: 'hidden',
      position: 'relative',
      background: '#1e2936',
      boxShadow: '0 8px 28px rgba(0,0,0,0.16)',
      flexShrink: 0,
    }}>
      {/* Full-bleed background */}
      {showVideo ? (
        <video src={vid} muted loop playsInline autoPlay preload="auto"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : img ? (
        <img alt="" src={img} loading="lazy" decoding="async"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : null}

      {/* Soft bottom vignette — keeps top of image bright */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.5) 30%, rgba(0,0,0,0.08) 55%, transparent 100%)',
        pointerEvents: 'none',
      }} />

      {/* Reel badge */}
      {isVideo && (
        <div style={{
          position: 'absolute', top: '14px', left: '14px',
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.2)', borderRadius: '99px',
          padding: '4px 11px', color: '#fff', fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em',
        }}>▶ {t('home', 'communityReel')}</div>
      )}

      {/* Bottom content */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '0 14px 14px',
        display: 'flex', flexDirection: 'column', gap: '10px',
      }}>
        {/* Caption */}
        {caption && (
          <p style={{
            margin: 0, color: '#fff', fontSize: '14px', fontWeight: 700, lineHeight: 1.42,
            textShadow: '0 1px 6px rgba(0,0,0,0.65)',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {caption}{fullCap.length > 90 ? '…' : ''}
          </p>
        )}

        {/* Footer — transparent dark frosted glass */}
        <div style={{
          background: 'rgba(0,0,0,0.42)',
          backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)',
          borderRadius: '16px',
          padding: '12px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {shortName && (
              <span style={{
                display: 'block', color: '#f5f0e8', fontSize: '13px', fontWeight: 800,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                textAlign: lang === 'ar' ? 'right' : 'left',
                width: '100%'
              }}>{shortName}</span>
            )}
            {uploaderName && (
              <span style={{
                display: 'block', color: 'rgba(245,240,232,0.6)', fontSize: '11px',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', 
                marginTop: '2px', textAlign: lang === 'ar' ? 'right' : 'left',
                width: '100%'
              }}>{uploaderName}</span>
            )}
          </div>
          {placeId && (
            <Link to={`${COMMUNITY_PATH}#feed-post-${post.id}`} style={{
              flexShrink: 0,
              background: 'transparent',
              backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
              border: '1.5px solid rgba(255,255,255,0.5)',
              color: '#fff',
              padding: '8px 18px', borderRadius: '99px',
              fontSize: '12px', fontWeight: 800, textDecoration: 'none',
              boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
              whiteSpace: 'nowrap', letterSpacing: '0.01em',
              maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis'
            }}>
              {t('home', 'communityViewPost')} {lang === 'ar' ? '←' : '→'}
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

/* ─── CommunityFeedStrip ─────────────────────────────────── */
export function CommunityFeedStrip({ posts, t, moreTo, layout = 'scroll' }) {
  const isMobile = useMobile();
  const displayPosts = useMemo(() => {
    if (layout === 'bento') return pickBestMixedThree(posts);
    return posts;
  }, [posts, layout]);

  if (!displayPosts.length) return null;

  /* ── PHONE: Vertical premium stack ── */
  if (isMobile && layout === 'bento') {
    return (
      <section id="community" style={{ padding: '36px 0 48px' }}>
        {/* Header */}
        <div style={{
          padding: '0 20px 22px',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '12px',
        }}>
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '8px',
              fontSize: '10px', fontWeight: 800, letterSpacing: '0.13em',
              textTransform: 'uppercase', color: '#0d5c54',
            }}>
              <span style={{
                width: '7px', height: '7px', borderRadius: '50%',
                background: '#0d9488', flexShrink: 0,
                boxShadow: '0 0 0 3px rgba(13,148,136,0.2)',
              }} />
              {t('home', 'communityFeedLiveEyebrow')}
            </div>
            <h2 style={{
              margin: 0, fontFamily: 'var(--font-serif, Georgia, serif)',
              fontSize: '26px', fontWeight: 800, color: '#0f172a',
              letterSpacing: '-0.02em', lineHeight: 1.15,
            }}>
              {t('home', 'communityFeedTitle')}
            </h2>
            <p style={{ margin: '5px 0 0', fontSize: '13px', color: '#64748b', lineHeight: 1.4 }}>
              {t('home', 'communityFeedSub')}
            </p>
          </div>
          {moreTo && (
            <Link to={moreTo} style={{
              flexShrink: 0, padding: '8px 14px', borderRadius: '99px',
              background: 'rgba(13,92,84,0.07)', border: '1.5px solid rgba(13,92,84,0.18)',
              color: '#0d5c54', fontSize: '12px', fontWeight: 700, textDecoration: 'none',
            }}>
              {t('home', 'seeAll')} →
            </Link>
          )}
        </div>

        {/* Vertical stack */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '0 16px' }}>
          {displayPosts.map((p) => (
            <MobileStoryCard key={p.id} post={p} t={t} />
          ))}
        </div>
      </section>
    );
  }

  /* ── DESKTOP: Original layout ── */
  const listClass =
    layout === 'bento' ? 'vd-community-feed-grid vd-community-feed-grid--bento' : 'vd-community-feed-scroll';
  const isShowcase = layout === 'bento';

  return (
    <section
      id="community"
      className={`vd-section vd-community-feed${isShowcase ? ' vd-community-feed--showcase' : ''}`}
    >
      <div className="vd-container vd-community-feed__inner">
        <header
          className={`vd-top-picks-header vd-community-feed-header${isShowcase ? ' vd-community-feed-header--showcase vd-community-feed-header--showcase-compact' : ''}`}
        >
          <div className="vd-top-picks-header-row vd-community-feed-header-row">
            <div className="vd-top-picks-heading-text vd-community-feed-heading-text">
              <h2 className="vd-top-picks-title">{t('home', 'communityFeedTitle')}</h2>
              <p className="vd-top-picks-subtitle">{t('home', 'communityFeedSub')}</p>
            </div>
            {moreTo && (
              <Link to={moreTo} className="vd-community-feed-more">
                {t('discover', 'seeAllDiscover')}
                <Icon name="arrow_forward" size={18} />
              </Link>
            )}
          </div>
        </header>
        <div
          className={`${listClass}${isShowcase ? ' vd-community-feed-bento-shell vd-community-feed-grid--trio' : ''}`}
          role="list"
        >
          {displayPosts.map((p) => (
            <CommunityFeedCard key={p.id} post={p} t={t} />
          ))}
        </div>
      </div>
    </section>
  );
}
