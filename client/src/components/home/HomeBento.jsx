import { Link } from 'react-router-dom';
import Icon from '../Icon';
import {
  isDefaultCityHeroPath,
  getBentoHeroImgProps,
} from '../../utils/bentoHeroImage';
import { cityHeroWebpSrcSet, CITY_HERO_SIZES } from '../../constants/cityHero';
import { COMMUNITY_PATH, PLACES_DISCOVER_PATH } from '../../utils/discoverPaths';
import { supabaseOptimizeForThumbnail } from '../../utils/supabaseImage.js';
import { bentoCssUrl } from '../../config/homeBentoVisuals';

/** Simple utility to render **text** as <strong>. */
function renderTextWithBold(text) {
  if (!text) return null;
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

export default function HomeBento({
  t,
  heroTitle,
  heroTagline,
  bentoV,
  showBentoAvatarStack,
  bentoAvatarSlots,
  bentoAvatarLinkLabel,
  placeCountStr,
  categoryCountStr,
  appStoreHref,
  playStoreHref,
}) {
  return (
    <section id="download-app" className="vd-home-bento">
      <div className="vd-container vd-home-bento-inner">
        <div className="vd-home-bento-grid">
          <div className="vd-bento-hero-why-bundle">
            <div className="vd-bento-card vd-bento-hero-main">
              {isDefaultCityHeroPath(bentoV.hero) ? (
                <picture>
                  <source media="(max-width: 767px)" srcSet="/oscar-niemeyer-arch.jpg" />
                  <source media="(min-width: 768px)" srcSet="/oscar-niemeyer-arch-wide.jpg" />
                  <source type="image/webp" srcSet={cityHeroWebpSrcSet()} sizes={CITY_HERO_SIZES} />
                  <img
                    className="vd-bento-hero-main-photo"
                    alt=""
                    draggable={false}
                    {...getBentoHeroImgProps(bentoV.hero)}
                  />
                </picture>
              ) : (
                <img
                  className="vd-bento-hero-main-photo"
                  alt=""
                  draggable={false}
                  {...getBentoHeroImgProps(bentoV.hero)}
                />
              )}
              <div className="vd-bento-hero-main-scrim" aria-hidden="true" />
              <div className="vd-bento-hero-main-content">
                <div className="vd-bento-hero-copy">
                  <h1 className="vd-bento-hero-title">{heroTitle}</h1>
                  <p className="vd-bento-hero-tagline">{heroTagline}</p>
                </div>
                <div className="vd-bento-hero-meta">
                  <div className="vd-bento-hero-ctas">
                    <Link to="/plan" className="vd-bento-btn vd-bento-btn--primary">
                      {t('home', 'webTripPlannerCta')}
                      <Icon name="arrow_forward" className="vd-btn-arrow" size={20} />
                    </Link>
                  </div>
                  {showBentoAvatarStack && (
                    <div
                      className="vd-bento-avatar-stack"
                      role="group"
                      aria-label={t('home', 'bentoAvatarStackAria')}
                    >
                      {bentoAvatarSlots.map((slot, i) => {
                        const to = slot.placeId ? `/place/${slot.placeId}` : COMMUNITY_PATH;
                        const key = slot.placeId ? `bento-av-${slot.placeId}` : `bento-av-${i}`;
                        return (
                          <Link
                            key={key}
                            to={to}
                            className="vd-bento-avatar"
                            aria-label={bentoAvatarLinkLabel(slot)}
                            style={
                              slot.href
                                ? { backgroundImage: bentoCssUrl(supabaseOptimizeForThumbnail(slot.href, 120)) }
                                : undefined
                            }
                          >
                            {!slot.href && <Icon name="travel_explore" size={22} aria-hidden />}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="vd-bento-card vd-bento-why-intro">
              <div className="vd-bento-why-intro-top">
                <h2 className="vd-bento-why-intro-title">{t('home', 'whyVisitTitle')}</h2>
              </div>
              <p className="vd-bento-why-intro-sub">{t('home', 'whyVisitSub')}</p>
              <div className="vd-bento-why-intro-footer">
                <Link to={PLACES_DISCOVER_PATH} className="vd-bento-why-intro-link">
                  <span>{t('home', 'seeAllWays')}</span>
                  <Icon name="arrow_forward" size={20} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>

          <div className="vd-bento-card vd-bento-hero-side vd-bento-web-hub">
            <div className="vd-bento-web-hub-inner">
              <p className="vd-bento-web-hub-kicker">{t('home', 'useWebCta')}</p>
              <div className="vd-bento-web-hub-header">
                <div className="vd-bento-web-hub-titles">
                  <p className="vd-bento-web-hub-name">{t('home', 'bentoWebHubTitle')}</p>
                  <p className="vd-bento-web-hub-sub">{t('home', 'bentoWebHubSub')}</p>
                </div>
              </div>
              <ul className="vd-bento-web-hub-facts">
                <li>{renderTextWithBold(t('home', 'bentoWebHubFact1'))}</li>
                <li>{renderTextWithBold(t('home', 'bentoWebHubFact2'))}</li>
                <li>{renderTextWithBold(t('home', 'bentoWebHubFact3'))}</li>
              </ul>
              <p className="vd-bento-web-hub-footnote">{t('home', 'bentoWebHubFootnote')}</p>
              <Link to="/plan" className="vd-bento-web-hub-cta">
                <span className="vd-bento-web-hub-cta-label">{t('home', 'bentoWebHubCta')}</span>
                <Icon name="arrow_forward" size={20} aria-hidden="true" />
              </Link>
            </div>
          </div>

          <div
            id="why"
            className="vd-bento-card vd-bento-mosaic"
            style={{ '--bento-mosaic-img': bentoCssUrl(bentoV.mosaic) }}
          >
            <div className="vd-bento-mosaic-bg" aria-hidden="true" />
            <div className="vd-bento-mosaic-top">
              <Link
                to={COMMUNITY_PATH}
                className="vd-bento-mosaic-snap vd-bento-mosaic-snap--phone"
                aria-label={`${t('home', 'bentoMosaicSnapAria')}: ${placeCountStr} ${t('home', 'bentoMosaicSnapPlacesUnit')}, ${categoryCountStr} ${t('home', 'bentoMosaicSnapCategoriesUnit')}`}
              >
                <span className="vd-bento-mosaic-snap-glow" aria-hidden="true" />
                <span className="vd-bento-mosaic-snap-body">
                  <span className="vd-bento-mosaic-snap-line">
                    <strong className="vd-bento-mosaic-snap-n">{placeCountStr}</strong>
                    <span className="vd-bento-mosaic-snap-u">{t('home', 'bentoMosaicSnapPlacesUnit')}</span>
                    <span className="vd-bento-mosaic-snap-sep" aria-hidden="true">
                      ·
                    </span>
                    <strong className="vd-bento-mosaic-snap-n">{categoryCountStr}</strong>
                    <span className="vd-bento-mosaic-snap-u">{t('home', 'bentoMosaicSnapCategoriesUnit')}</span>
                  </span>
                  <span className="vd-bento-mosaic-snap-sub">{t('home', 'bentoMosaicSnapSub')}</span>
                </span>
                <span className="vd-bento-mosaic-snap-arrow" aria-hidden="true">
                  <Icon name="arrow_forward" size={18} />
                </span>
              </Link>
              <div className="vd-bento-stat-grid vd-bento-mosaic-stats-desktop">
                <Link
                  to={COMMUNITY_PATH}
                  className="vd-bento-stat vd-bento-stat--dark vd-bento-stat--link"
                  aria-label={`${placeCountStr} ${t('home', 'bentoStatPlaces')}`}
                >
                  <strong className="vd-bento-stat-num">{placeCountStr}</strong>
                  <span className="vd-bento-stat-label">{t('home', 'bentoStatPlaces')}</span>
                </Link>
                <Link
                  to={PLACES_DISCOVER_PATH}
                  className="vd-bento-stat vd-bento-stat--light vd-bento-stat--link"
                  aria-label={`${categoryCountStr} ${t('home', 'bentoStatCategories')}`}
                >
                  <strong className="vd-bento-stat-num">{categoryCountStr}</strong>
                  <span className="vd-bento-stat-label">{t('home', 'bentoStatCategories')}</span>
                  <span className="vd-bento-stat-cta" aria-hidden="true">
                    <Icon name="arrow_forward" size={16} />
                  </span>
                </Link>
              </div>
            </div>

            <div className="vd-bento-mosaic-panel">
              <p className="vd-bento-panel-kicker vd-bento-panel-kicker--desktop">{t('home', 'bentoMosaicKicker')}</p>
              <div className="vd-bento-mosaic-panel-grid">
                <div className="vd-bento-mosaic-panel-copy">
                  <p className="vd-bento-panel-note vd-bento-panel-note--desktop">{t('home', 'bentoSiteGuideAppNote')}</p>
                  <p className="vd-bento-panel-lead-short">{t('home', 'bentoSiteGuideLeadShort')}</p>
                </div>
                <div className="vd-bento-mosaic-panel-apps">
                  <p className="vd-bento-panel-badges-label">{t('home', 'bentoSiteGuideAppStoreLabel')}</p>
                  <div className="vd-bento-panel-badges">
                    <a
                      href={appStoreHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="vd-download-app-badge vd-download-app-badge--apple"
                      aria-label={t('home', 'getOnAppStore')}
                    >
                      <Icon name="phone_iphone" size={20} />
                      <span>{t('home', 'getOnAppStore')}</span>
                    </a>
                    <a
                      href={playStoreHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="vd-download-app-badge vd-download-app-badge--google"
                      aria-label={t('home', 'getOnGooglePlay')}
                    >
                      <Icon name="android" size={22} />
                      <span>{t('home', 'getOnGooglePlay')}</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="vd-bento-mosaic-footer">
              <Link to={PLACES_DISCOVER_PATH} className="vd-bento-mosaic-cta">
                {t('home', 'seeAllWays')}
                <Icon name="arrow_forward" className="vd-btn-arrow" size={16} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
