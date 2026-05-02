import { Link } from 'react-router-dom';
import Icon from '../Icon';
import {
  WAYS_CONFIG,
  groupPlacesByWay,
  countDirectoryCategoriesForWay,
  formatFindYourWayThemeTitle,
} from '../../utils/findYourWayGrouping';
import { discoverSearchUrl } from '../../utils/discoverPaths';

/** Latin digits for stat tiles (consistent with mixed-language UI). */
function formatDirectoryCount(n, lang) {
  const safe = Number.isFinite(n) ? Math.max(0, Math.floor(Number(n))) : 0;
  const locale = lang === 'fr' ? 'fr' : 'en';
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(safe);
}

/** How many distinct directory categories appear in a theme bucket (via listing metadata). */
function themeCategoryStats(bucket, categories) {
  const ids = new Set();
  for (const p of bucket || []) {
    const id = p.categoryId ?? p.category_id;
    if (id != null) ids.add(String(id));
  }
  const known = new Set((categories || []).map((c) => String(c.id)));
  let resolved = 0;
  ids.forEach((id) => {
    if (known.has(id)) resolved += 1;
  });
  return { categoryCount: resolved, listingCount: (bucket || []).length };
}

export default function BrowseThemesSection({
  t,
  lang,
  places = [],
  categories = [],
}) {
  const safeT = (ns, key) => (t && typeof t === 'function' ? t(ns, key) : key);
  const placesByWay = groupPlacesByWay(places, categories);
  const stepClass = ['vd-find-your-way-row--a', 'vd-find-your-way-row--b', 'vd-find-your-way-row--c', 'vd-find-your-way-row--d'];
  
  return (
    <section
      id="experience"
      className="vd-section vd-experience-tripoli vd-find-your-way vd-find-your-way--deck vd-find-your-way--map-themes"
      aria-labelledby="browse-map-themes-title"
    >
      <div className="vd-container">
        <header className="vd-find-your-way-header">
          <h2 id="browse-map-themes-title" className="vd-find-your-way-title">
            {safeT('home', 'findYourWayThemeDeckLabel')}
          </h2>
        </header>

        <div className="vd-find-your-way-deck" role="list">
          {WAYS_CONFIG.map((way, i) => {
            const bucket = placesByWay.get(way.wayKey) || [];
            const { categoryCount: categoriesWithListings, listingCount } = themeCategoryStats(bucket, categories);
            const directoryCategoryCount = countDirectoryCategoriesForWay(way.wayKey, categories);
            const categoryCount = Math.max(directoryCategoryCount, categoriesWithListings);
            const idx = String(i + 1).padStart(2, '0');
            const stagger = stepClass[i % stepClass.length];
            const asideNumber =
              categoryCount > 0
                ? formatDirectoryCount(categoryCount, lang)
                : listingCount > 0
                  ? formatDirectoryCount(listingCount, lang)
                  : null;
            const asideLabel =
              categoryCount > 0
                ? safeT('home', 'findYourWayCategoriesUnit')
                : listingCount > 0
                  ? safeT('home', 'findYourWayThemeEntriesLabel')
                  : null;
            const titleFromCategories = formatFindYourWayThemeTitle(
              way.wayKey,
              categories,
              lang,
              (n) => safeT('home', 'findYourWayThemeMore').split('{count}').join(String(n))
            );
            const rowTitle = titleFromCategories || safeT('home', way.titleKey);
            const discoverTo = way.discoverQ ? discoverSearchUrl(way.discoverQ) : discoverSearchUrl('');
            return (
              <Link
                key={way.wayKey}
                to={discoverTo}
                className={`vd-find-your-way-row ${stagger}`}
                role="listitem"
              >
                <span className="vd-find-your-way-row-index" aria-hidden="true">
                  {idx}
                </span>
                <span className="vd-find-your-way-row-glyph" aria-hidden="true">
                  <Icon name={way.icon} size={26} />
                </span>
                <div className="vd-find-your-way-row-copy">
                  <span className="vd-find-your-way-row-theme">{safeT('home', 'findYourWayRowKicker')}</span>
                  <h3 className="vd-find-your-way-row-title">{rowTitle}</h3>
                  <p className="vd-find-your-way-row-desc">{safeT('home', way.descKey)}</p>
                  <p className="vd-find-your-way-row-detail">{safeT('home', way.detailKey)}</p>
                </div>
                <div className="vd-find-your-way-row-aside">
                  {asideNumber != null ? (
                    <span className="vd-find-your-way-count">
                      <strong>{asideNumber}</strong>
                      <span className="vd-find-your-way-count-label">{asideLabel}</span>
                    </span>
                  ) : (
                    <span className="vd-find-your-way-count vd-find-your-way-count--empty">
                      {safeT('home', 'findYourWayComingSoon')}
                    </span>
                  )}
                  <span className="vd-find-your-way-row-chevron" aria-hidden="true">
                    <Icon name="arrow_forward" size={22} />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="vd-find-your-way-cta-wrap">
          <Link to={discoverSearchUrl('')} className="vd-find-your-way-cta">
            {safeT('home', 'seeAllWaysDiscover')}
            <Icon name="arrow_forward" size={20} />
          </Link>
        </div>
      </div>
    </section>
  );
}
