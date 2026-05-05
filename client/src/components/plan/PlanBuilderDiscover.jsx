import Icon from '../Icon';
import { PlanPlaceCard } from './PlanPlaceCards';

export function PlanBuilderDiscover({ 
  builderSectionCollapsed, 
  toggleBuilderSection, 
  placeSearch, 
  setPlaceSearch, 
  categoryFilterRef, 
  placeCategoryFilter, 
  categoryFilterOpen, 
  setCategoryFilterOpen, 
  showToast, 
  setPlaceCategoryFilter, 
  categories, 
  placeSections, 
  favouriteIds, 
  toggleFavourite, 
  isInBuilder, 
  editDays, 
  addPlaceToDay, 
  formatPlanToast, 
  t, 
  tourBuilderDiscoverRef 
}) {
  return (
    <section
      ref={tourBuilderDiscoverRef}
      className={`plan-unified-section plan-unified-section--discover${builderSectionCollapsed.discover ? ' plan-unified-section--collapsed' : ''}`}
      id="plan-discover"
    >
      <div className="plan-section-head-toggle">
        <div className="plan-section-step">
          <span className="plan-step-num">2</span>
          <h2 className="plan-section-title" id="plan-discover-label">{t('home', 'planStepDiscover')}</h2>
        </div>
        <button
          type="button"
          className="plan-builder-section-toggle"
          onClick={() => toggleBuilderSection('discover')}
          aria-expanded={!builderSectionCollapsed.discover}
          aria-controls="plan-discover-body"
        >
          <Icon name={builderSectionCollapsed.discover ? 'expand_more' : 'expand_less'} size={22} aria-hidden />
          <span>{builderSectionCollapsed.discover ? t('home', 'planBuilderSectionShow') : t('home', 'planBuilderSectionHide')}</span>
        </button>
      </div>
      {!builderSectionCollapsed.discover && (
        <div id="plan-discover-body" className="plan-builder-section-body" role="region" aria-labelledby="plan-discover-label">
          <p className="plan-section-sub">{t('home', 'planDiscoverSub')}</p>
          <div className="plan-discover-toolbar">
            <div className="plan-discover-toolbar-row">
              <div className="plan-search-wrap plan-search-wrap--grow">
                <Icon name="search" size={20} className="plan-search-icon" />
                <input
                  type="search"
                  className="plan-search-input"
                  placeholder={t('home', 'planSearchPlaces')}
                  value={placeSearch}
                  onChange={(e) => setPlaceSearch(e.target.value)}
                  aria-label={t('home', 'planSearchPlaces')}
                />
              </div>
              <div className="plan-category-filter" ref={categoryFilterRef}>
                <button
                  type="button"
                  className={`plan-category-filter-trigger ${placeCategoryFilter != null ? 'plan-category-filter-trigger--active' : ''} ${categoryFilterOpen ? 'plan-category-filter-trigger--open' : ''}`}
                  aria-expanded={categoryFilterOpen}
                  aria-haspopup="listbox"
                  aria-label={t('home', 'planCategoryFilterBtnAria')}
                  onClick={() => setCategoryFilterOpen((o) => !o)}
                >
                  <Icon name="filter_list" size={22} ariaHidden />
                </button>
                {categoryFilterOpen ? (
                  <div className="plan-category-filter-panel" role="listbox" aria-label={t('home', 'planCategoryFilterHeading')}>
                    <p className="plan-category-filter-panel-title">{t('home', 'planCategoryFilterHeading')}</p>
                    <div className="plan-category-pills plan-category-pills--panel">
                      <button
                        type="button"
                        role="option"
                        aria-selected={placeCategoryFilter == null}
                        className={`plan-category-pill ${!placeCategoryFilter ? 'plan-category-pill--active' : ''}`}
                        onClick={() => {
                          if (placeCategoryFilter != null) {
                            showToast(t('home', 'planToastCategoryAll'), 'info');
                          }
                          setPlaceCategoryFilter(null);
                          setCategoryFilterOpen(false);
                        }}
                      >
                        {t('home', 'planFilterAllCategories')}
                      </button>
                      {categories.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          role="option"
                          aria-selected={placeCategoryFilter === c.id}
                          className={`plan-category-pill ${placeCategoryFilter === c.id ? 'plan-category-pill--active' : ''}`}
                          onClick={() => {
                            const next = placeCategoryFilter === c.id ? null : c.id;
                            setPlaceCategoryFilter(next);
                            setCategoryFilterOpen(false);
                            if (next == null) {
                              showToast(t('home', 'planToastCategoryAll'), 'info');
                            } else {
                              showToast(
                                formatPlanToast(t('home', 'planToastCategoryFilter'), {
                                  label: c.name != null ? String(c.name) : String(c.id),
                                }),
                                'info'
                              );
                            }
                          }}
                        >
                          {c.name || c.id}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          <div className="plan-discover-by-category">
            {placeSections.map((sec) => (
              <div key={sec.id} className="plan-category-section" id={`plan-cat-${sec.id}`}>
                <h3 className="plan-category-section-title">{sec.name}</h3>
                <div className="plan-discover-grid">
                  {sec.places.map((p) => (
                    <PlanPlaceCard
                      key={p.id}
                      place={p}
                      isFavourite={favouriteIds.has(String(p.id))}
                      onToggleFavourite={toggleFavourite}
                      tripDayCount={isInBuilder ? editDays.length : 0}
                      onAddToTrip={isInBuilder ? addPlaceToDay : undefined}
                      t={t}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          {placeSections.length === 0 && (
            <p className="plan-empty-msg">{t('home', 'noSpots')}</p>
          )}
        </div>
      )}
    </section>
  );
}
