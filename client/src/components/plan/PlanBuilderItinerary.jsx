import Icon from '../Icon';
import { PlanDayView } from './PlanDayView';

export function PlanBuilderItinerary({ 
  builderSectionCollapsed, 
  toggleBuilderSection, 
  editDays, 
  editStart, 
  getDateForDay, 
  placeIdsFromDay, 
  optimizeDayOrder, 
  schedulingDayIndex, 
  groupedPlacesBySlot, 
  TIME_SLOTS, 
  timeSlotLabel, 
  updateSlotTime, 
  removePlaceFromDay, 
  hasUnsavedChanges, 
  handleSaveTrip, 
  handleCancelEdit, 
  saving, 
  editingTrip, 
  editingTripId, 
  beginDeleteTrip, 
  deletingTripId, 
  t, 
  tourBuilderSaveRef 
}) {
  return (
    <section
      className={`plan-unified-section plan-unified-section--itinerary${builderSectionCollapsed.itinerary ? ' plan-unified-section--collapsed' : ''}`}
      id="plan-itinerary"
    >
      <div className="plan-section-head-toggle">
        <div className="plan-section-step">
          <span className="plan-step-num">4</span>
          <h2 className="plan-section-title" id="plan-itinerary-label">{t('home', 'planStepItinerary')}</h2>
        </div>
        <button
          type="button"
          className="plan-builder-section-toggle"
          onClick={() => toggleBuilderSection('itinerary')}
          aria-expanded={!builderSectionCollapsed.itinerary}
          aria-controls="plan-itinerary-body"
        >
          <Icon name={builderSectionCollapsed.itinerary ? 'expand_more' : 'expand_less'} size={22} aria-hidden />
          <span>{builderSectionCollapsed.itinerary ? t('home', 'planBuilderSectionShow') : t('home', 'planBuilderSectionHide')}</span>
        </button>
      </div>
      {!builderSectionCollapsed.itinerary && (
        <div id="plan-itinerary-body" className="plan-builder-section-body" role="region" aria-labelledby="plan-itinerary-label">
          <div className="plan-days plan-days--unified">
            {editDays.map((day, i) => (
              <PlanDayView
                key={i}
                day={day}
                i={i}
                editStart={editStart}
                getDateForDay={getDateForDay}
                placeIdsFromDay={placeIdsFromDay}
                optimizeDayOrder={optimizeDayOrder}
                schedulingDayIndex={schedulingDayIndex}
                groupedPlacesBySlot={groupedPlacesBySlot}
                TIME_SLOTS={TIME_SLOTS}
                timeSlotLabel={timeSlotLabel}
                updateSlotTime={updateSlotTime}
                removePlaceFromDay={removePlaceFromDay}
                t={t}
              />
            ))}
          </div>
        </div>
      )}
      {hasUnsavedChanges ? (
        <p className="plan-unsaved-hint" role="status">
          {t('home', 'planUnsavedHint')}
        </p>
      ) : null}
      <div ref={tourBuilderSaveRef} className="plan-builder-actions">
        <button type="button" className="vd-btn vd-btn--primary" onClick={handleSaveTrip} disabled={saving}>
          {saving ? t('home', 'loading') : t('home', 'saveTrip')}
        </button>
        <button type="button" className="vd-btn vd-btn--secondary" onClick={handleCancelEdit}>
          {t('home', 'cancel')}
        </button>
        {editingTrip?.isHost !== false && (
          <button
            type="button"
            className="vd-btn plan-delete-btn plan-delete-btn--icon-only"
            onClick={() => beginDeleteTrip(editingTripId)}
            disabled={saving || deletingTripId === editingTripId}
            aria-busy={deletingTripId === editingTripId}
            aria-label={
              deletingTripId === editingTripId
                ? t('home', 'loading')
                : t('home', 'deleteTrip')
            }
          >
            <Icon name="delete" size={22} ariaHidden />
          </button>
        )}
      </div>
    </section>
  );
}
