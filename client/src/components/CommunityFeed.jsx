import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getImageUrl, fixImageUrlExtension, getPlaceImageUrl } from '../api/client';
import Icon from './Icon';
import { COMMUNITY_PATH, discoverPlaceFeedPath } from '../utils/discoverPaths';
import { isLikelyDirectStreamableVideo } from '../utils/feedVideoPlayback';
import { rawFeedImageUrls } from '../utils/feedPostImages';
import { getDeliveryImgProps } from '../utils/responsiveImages.js';
import { optimizeVideoPosterUrl } from '../utils/supabaseImage.js';

/** Reels / video items: explicit type, or legacy rows stored as `post` with video and no cover image (matches business portal). */
export function isCommunityFeedVideo(post) {
  const t = String(post?.type || '').toLowerCase();
  if (t === 'reel' || t === 'video') return true;
  const hasImage = rawFeedImageUrls(post).length > 0;
  const hasVideo = !!(post?.video_url && String(post.video_url).trim());
  return hasVideo && !hasImage;
}

/** Likes + comments (public counts) for ranking / mixing. */
export function communityFeedEngagementScore(post) {
  const likes = Number(post?.likes_count) || 0;
  const comments = Number(post?.comments_count) || 0;
  return likes + comments;
}

/**
 * From an API-ordered list (e.g. by popularity), pick up to four items alternating reels and posts
 * when both exist so the home section stays mixed.
 */
export function pickBestMixedFour(posts) {
  if (!Array.isArray(posts) || posts.length === 0) return [];
  const reels = posts.filter((p) => isCommunityFeedVideo(p));
  const stills = posts.filter((p) => !isCommunityFeedVideo(p));
  if (!reels.length) return stills.slice(0, 4);
  if (!stills.length) return reels.slice(0, 4);

  const out = [];
  let ri = 0;
  let si = 0;
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

/** Same alternating mix as `pickBestMixedFour`, capped at three tiles for a tighter home strip. */
export function pickBestMixedThree(posts) {
  const four = pickBestMixedFour(posts);
  return four.slice(0, 3);
}

function feedMediaUrl(url) {
  if (!url || typeof url !== 'string') return '';
  return getImageUrl(fixImageUrlExtension(url));
}

export function CommunityFeedCard({ post, t }) {
  const isVideo = isCommunityFeedVideo(post);
  const fullCap = post.caption != null ? String(post.caption) : '';
  const caption = fullCap.slice(0, 160);
  const placeId = post.place_id != null ? String(post.place_id) : '';
  const placeName = post.place_name != null ? String(post.place_name).trim() : '';
  const uploaderName =
    post.author_name != null && String(post.author_name).trim() ? String(post.author_name).trim() : '';
  const headlineShown = placeName;
  const showUploaderByline =
    Boolean(uploaderName) &&
    (!headlineShown ||
      uploaderName.localeCompare(String(headlineShown), undefined, { sensitivity: 'accent' }) !== 0);
  const firstRaw = rawFeedImageUrls(post)[0];
  const img = firstRaw ? feedMediaUrl(firstRaw) : '';
  const vid = post.video_url ? feedMediaUrl(post.video_url) : '';
  const showVideo = isVideo && vid && isLikelyDirectStreamableVideo(vid, post.video_url);
  const externalVideo = isVideo && post.video_url && !showVideo;
  const typeLower = String(post?.type || '').toLowerCase();
  const reelLabel =
    typeLower === 'reel' ? t('home', 'communityReel') : t('home', 'communityVideo');

  return (
    <article className="vd-community-feed-card" role="listitem">
      <div className="vd-community-feed-card-media">
        {showVideo ? (
          <video
            className="vd-community-feed-video"
            src={vid}
            muted
            loop
            playsInline
            autoPlay
            preload="auto"
            poster={img ? optimizeVideoPosterUrl(img) : undefined}
            aria-label={fullCap.slice(0, 120) || reelLabel}
          />
        ) : img ? (
          <img alt="" className="vd-community-feed-img" loading="lazy" decoding="async" {...getDeliveryImgProps(img, 'gridCard')} />
        ) : (
          <div className="vd-community-feed-placeholder" aria-hidden="true" />
        )}
        {externalVideo && (
          <a
            href={String(post.video_url).trim()}
            target="_blank"
            rel="noopener noreferrer"
            className="vd-community-feed-ext-link"
          >
            {t('home', 'communityWatchVideo')}
          </a>
        )}
        {isVideo && <span className="vd-community-feed-reel-badge">{reelLabel}</span>}
      </div>
      <div className="vd-community-feed-card-body">
        <div className="vd-community-feed-card-content">
          <p className="vd-community-feed-caption">
            {caption}
            {fullCap.length > 160 ? '…' : ''}
          </p>
        </div>
        <div className="vd-community-feed-glass-footer">
          <div className="vd-community-feed-meta">
            {placeId ? (
              <Link
                to={discoverPlaceFeedPath(placeId)}
                className="vd-community-feed-place-row"
                title={t('discover', 'feedVenueHubTitle')}
              >
                {(() => {
                  const av = post.place_image_url
                    ? getPlaceImageUrl(String(post.place_image_url).trim())
                    : null;
                  return av ? (
                    <img
                      alt=""
                      className="vd-community-feed-place-avatar"
                      width={28}
                      height={28}
                      loading="lazy"
                      decoding="async"
                      {...getDeliveryImgProps(av, 'thumb')}
                    />
                  ) : (
                    <span className="vd-community-feed-place-avatar vd-community-feed-place-avatar--icon" aria-hidden>
                      <Icon name="storefront" size={14} />
                    </span>
                  );
                })()}
                <span className="vd-community-feed-meta-titles">
                  {placeName ? <span className="vd-community-feed-author">{placeName}</span> : null}
                  {showUploaderByline ? (
                    <span className="vd-community-feed-uploader">{uploaderName}</span>
                  ) : null}
                </span>
              </Link>
            ) : placeName ? (
              <span className="vd-community-feed-meta-titles">
                <span className="vd-community-feed-author">{placeName}</span>
                {showUploaderByline ? (
                  <span className="vd-community-feed-uploader">{uploaderName}</span>
                ) : null}
              </span>
            ) : showUploaderByline ? (
              <span className="vd-community-feed-uploader vd-community-feed-uploader--solo">{uploaderName}</span>
            ) : null}
          </div>
          {placeId && (
            <Link to={`${COMMUNITY_PATH}#feed-post-${post.id}`} className="vd-community-feed-cta">
              {t('home', 'communityViewPost')}
              <Icon name="arrow_forward" size={16} className="vd-btn-arrow" />
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

export function CommunityFeedStrip({ posts, t, moreTo, layout = 'scroll' }) {
  const displayPosts = useMemo(() => {
    if (layout === 'bento') return pickBestMixedThree(posts);
    return posts;
  }, [posts, layout]);

  if (!displayPosts.length) return null;

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
