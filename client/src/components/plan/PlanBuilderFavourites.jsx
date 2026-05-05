import Icon from '../Icon';
import { PlanFavouriteCard } from './PlanPlaceCards';

export function PlanBuilderFavourites({ 
  builderSectionCollapsed, 
  toggleBuilderSection, 
  favouritePlaces, 
  favSearch, 
  setFavSearch, 
  filteredFavourites, 
  editDays, 
  addPlaceToDay, 
  t, 
  tourBuilderFavouritesRef 
}) {
  return (
    <section
      ref={tourBuilderFavouritesRef}
      className={`plan-unified-section plan-unified-section--favourites${builderSectionCollapsed.favourites ? ' plan-unified-section--collapsed' : ''}`}
      id="plan-favourites"
    >
      <div className="plan-section-head-toggle">
        <div className="plan-section-step">
          <span className="plan-step-num">3</span>
          <h2 className="plan-section-title" id="plan-favourites-label">{t('home', 'planFavouritesTitle')}</h2>
        </div>
        <button
          type="button"
          className="plan-builder-section-toggle"
          onClick={() => toggleBuilderSection('favourites')}
          aria-expanded={!builderSectionCollapsed.favourites}
          aria-controls="plan-favourites-body"
        >
          <Icon name={builderSectionCollapsed.favourites ? 'expand_more' : 'expand_less'} size={22} aria-hidden />
          <span>{builderSectionCollapsed.favourites ? t('home', 'planBuilderSectionShow') : t('home', 'planBuilderSectionHide')}</span>
        </button>
      </div>
      {!builderSectionCollapsed.favourites && (
        <div id="plan-favourites-body" className="plan-builder-section-body" role="region" aria-labelledby="plan-favourites-label">
          <p className="plan-section-sub">{t('home', 'planFavouritesSub')}</p>
          {favouritePlaces.length === 0 ? (
            <div className="plan-fav-empty">
              <Icon name="favorite_border" size={48} />
              <p>{t('home', 'planFavouritesEmptyHint')}</p>
            </div>
          ) : (
            <>
              <div className="plan-fav-search">
                <div className="plan-search-wrap plan-search-wrap--sm">
                  <Icon name="search" size={18} className="plan-search-icon" />
                  <input
                    type="search"
                    className="plan-search-input"
                    placeholder={t('home', 'planSearchFavourites')}
                    value={favSearch}
                    onChange={(e) => setFavSearch(e.target.value)}
                    aria-label={t('home', 'planSearchFavourites')}
                  />
                </div>
              </div>
              <div className="plan-fav-grid">
                {filteredFavourites.map((p) => (
                  <PlanFavouriteCard
                    key={p.id}
                    place={p}
                    dayCount={editDays.length}
                    onAddToDay={addPlaceToDay}
                    t={t}
                  />
                ))}
              </div>
              {filteredFavourites.length === 0 && (
                <p className="plan-empty-msg">{t('home', 'noSavedPlaces')}</p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
