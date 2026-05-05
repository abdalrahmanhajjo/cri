import { Link } from 'react-router-dom';
import Icon from '../Icon';
import { DateRangeCalendar } from '../Calendar';
import { PlanTripCard } from './PlanTripCard';

export function PlanTripList({ 
  trips, 
  showCreateForm, 
  t, 
  filteredSortedTrips, 
  tripFiltersActive, 
  clearTripListFilters, 
  tripFiltersOpen, 
  setTripFiltersOpen, 
  tripListSearch, 
  setTripListSearch, 
  tripFilterFrom, 
  setTripFilterFrom, 
  tripFilterTo, 
  setTripFilterTo, 
  applyTripFilterDatePreset, 
  tripFilterPhase, 
  setTripFilterPhase, 
  tripFilterStops, 
  setTripFilterStops, 
  navigate, 
  handleViewTripOnMap, 
  handleShareTrip, 
  handleDuplicateTrip, 
  beginDeleteTrip, 
  duplicatingId, 
  deletingTripId,
  placeIdsFromDay,
  formatPlanToast
}) {
  return (
    <section id="plan" style={{ scrollMarginTop: '100px' }}>
      <div className="plan-section-head">
        <h2 className="plan-section-title">{t('nav', 'myTrips')}</h2>
      </div>

      {trips.length > 0 && !showCreateForm && (
        <div className="plan-trips-filters" aria-label={t('home', 'tripsFilterTitle')}>
          <div className="plan-trips-filters-toolbar">
            <p className="plan-trips-filters-results">
              {formatPlanToast(t('home', 'tripsFilterShowing'), {
                shown: filteredSortedTrips.length,
                total: trips.length,
              })}
            </p>
            <div className="plan-trips-filters-toolbar-actions">
              {tripFiltersActive && (
                <button type="button" className="plan-trips-filter-clear vd-btn vd-btn--secondary" onClick={clearTripListFilters}>
                  {t('home', 'tripsFilterClearAll')}
                </button>
              )}
              <button
                type="button"
                className={`plan-trips-filters-toggle ${tripFiltersOpen ? 'plan-trips-filters-toggle--open' : ''}`}
                onClick={() => setTripFiltersOpen((o) => !o)}
                aria-expanded={tripFiltersOpen}
                aria-controls="plan-trips-filters-panel"
                id="plan-trips-filters-toggle"
              >
                <span>{tripFiltersOpen ? t('home', 'tripsFilterToggleHide') : t('home', 'tripsFilterToggleShow')}</span>
                <Icon name={tripFiltersOpen ? 'expand_less' : 'expand_more'} size={22} />
              </button>
            </div>
          </div>
          {tripFiltersOpen && (
            <div id="plan-trips-filters-panel" className="plan-trips-filters-panel" role="region" aria-labelledby="plan-trips-filters-toggle">
              <div className="plan-trips-filter-search" role="search">
                <Icon name="search" size={22} className="plan-trips-filter-search-icon" aria-hidden />
                <input
                  type="search"
                  className="plan-trips-filter-search-input"
                  value={tripListSearch}
                  onChange={(e) => setTripListSearch(e.target.value)}
                  placeholder={t('home', 'tripsFilterSearchPlaceholder')}
                  aria-label={t('home', 'tripsFilterSearchLabel')}
                />
              </div>
              <div className="plan-trips-filter-group">
                <span className="plan-trips-filter-label">{t('home', 'tripsFilterWhenLabel')}</span>
                <div className="plan-trips-filter-dates">
                  <label className="plan-trips-filter-date">
                    <input
                      type="date"
                      value={tripFilterFrom}
                      onChange={(e) => setTripFilterFrom(e.target.value)}
                      aria-label={t('home', 'tripsFilterFrom')}
                    />
                  </label>
                  <span className="plan-trips-filter-date-sep" aria-hidden>–</span>
                  <label className="plan-trips-filter-date">
                    <input
                      type="date"
                      value={tripFilterTo}
                      onChange={(e) => setTripFilterTo(e.target.value)}
                      aria-label={t('home', 'tripsFilterTo')}
                    />
                  </label>
                </div>
                <div className="plan-trips-filter-quick-chips" role="group" aria-label={t('home', 'tripsFilterQuickPresets')}>
                  <button type="button" className="plan-quick-date-chip" onClick={() => applyTripFilterDatePreset('this_month')}>
                    {t('home', 'tripsFilterPresetThisMonth')}
                  </button>
                  <button type="button" className="plan-quick-date-chip" onClick={() => applyTripFilterDatePreset('next_month')}>
                    {t('home', 'tripsFilterPresetNextMonth')}
                  </button>
                  <button type="button" className="plan-quick-date-chip" onClick={() => applyTripFilterDatePreset('next_30')}>
                    {t('home', 'tripsFilterPresetNext30')}
                  </button>
                  {(tripFilterFrom || tripFilterTo) && (
                    <button type="button" className="plan-quick-date-chip plan-quick-date-chip--ghost" onClick={() => applyTripFilterDatePreset('clear')}>
                      {t('home', 'tripsFilterClearDates')}
                    </button>
                  )}
                </div>
                <div className="plan-calendar-wrap plan-calendar-wrap--trips-filter">
                  <DateRangeCalendar
                    startDate={tripFilterFrom || undefined}
                    endDate={tripFilterTo || undefined}
                    onChange={(start, end) => {
                      setTripFilterFrom(start);
                      setTripFilterTo(end);
                    }}
                    showHint={false}
                  />
                </div>
              </div>
              <div className="plan-trips-filter-group">
                <span className="plan-trips-filter-label">{t('home', 'tripsFilterPhaseLabel')}</span>
                <div className="plan-trips-filter-pills" role="group">
                  {(['all', 'upcoming', 'ongoing', 'past']).map((key) => (
                    <button
                      key={key}
                      type="button"
                      className={`plan-trips-filter-pill ${tripFilterPhase === key ? 'plan-trips-filter-pill--active' : ''}`}
                      onClick={() => setTripFilterPhase(key)}
                      aria-pressed={tripFilterPhase === key}
                    >
                      {t('home', key === 'all' ? 'tripsFilterPhaseAll' : key === 'upcoming' ? 'tripsFilterPhaseUpcoming' : key === 'ongoing' ? 'tripsFilterPhaseOngoing' : 'tripsFilterPhasePast')}
                    </button>
                  ))}
                </div>
              </div>
              <div className="plan-trips-filter-group">
                <span className="plan-trips-filter-label">{t('home', 'tripsFilterStopsLabel')}</span>
                <div className="plan-trips-filter-pills" role="group">
                  {(['any', 'with', 'without']).map((key) => (
                    <button
                      key={key}
                      type="button"
                      className={`plan-trips-filter-pill ${tripFilterStops === key ? 'plan-trips-filter-pill--active' : ''}`}
                      onClick={() => setTripFilterStops(key)}
                      aria-pressed={tripFilterStops === key}
                    >
                      {t('home', key === 'any' ? 'tripsFilterStopsAny' : key === 'with' ? 'tripsFilterStopsWith' : 'tripsFilterStopsWithout')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {trips.length === 0 && !showCreateForm && (
        <div className="plan-empty">
          <p className="plan-empty-title">{t('home', 'planText')}</p>
          <p className="plan-empty-hint">{t('home', 'planEmptyHint')}</p>
          <div className="plan-empty-ctas">
            <Link to="/map" className="vd-btn vd-btn--primary">
              {t('home', 'viewMapCta')}
              <Icon name="arrow_forward" size={20} />
            </Link>
            <Link to="/favourites" className="vd-btn vd-btn--secondary">
              {t('nav', 'myFavourites')}
              <Icon name="arrow_forward" size={20} />
            </Link>
          </div>
        </div>
      )}

      {trips.length > 0 && !showCreateForm && filteredSortedTrips.length === 0 && (
        <p className="plan-trips-filter-empty" role="status">
          {t('home', 'tripsFilterNoResults')}
        </p>
      )}

      {trips.length > 0 && !showCreateForm && filteredSortedTrips.length > 0 && (
        <ul className="plan-trips-grid">
          {filteredSortedTrips.map((tr) => (
            <PlanTripCard
              key={tr.id}
              tr={tr}
              navigate={navigate}
              t={t}
              handleViewTripOnMap={handleViewTripOnMap}
              handleShareTrip={handleShareTrip}
              handleDuplicateTrip={handleDuplicateTrip}
              beginDeleteTrip={beginDeleteTrip}
              duplicatingId={duplicatingId}
              deletingTripId={deletingTripId}
              placeIdsFromDay={placeIdsFromDay}
            />
          ))}
        </ul>
      )}

      {trips.length > 0 && !showCreateForm && (
        <div className="plan-secondary-ctas">
          <Link to="/map" className="vd-btn vd-btn--secondary">{t('home', 'viewMapCta')} <Icon name="arrow_forward" size={20} /></Link>
          <Link to="/favourites" className="vd-btn vd-btn--secondary">{t('nav', 'myFavourites')} <Icon name="arrow_forward" size={20} /></Link>
        </div>
      )}
    </section>
  );
}
