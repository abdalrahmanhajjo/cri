import Icon from '../Icon';
import { DateRangeCalendar } from '../Calendar';

export function PlanBuilderBasics({ 
  builderSectionCollapsed, 
  toggleBuilderSection, 
  handleCancelEdit, 
  editName, 
  setEditName, 
  setNameError, 
  nameError, 
  editDescription, 
  setEditDescription, 
  applyEditQuickPreset, 
  editStart, 
  setEditStart, 
  editEnd, 
  setEditEnd, 
  setDateError, 
  dateError, 
  editDays, 
  placeIdsFromDay, 
  showToast, 
  navigate, 
  onEditCalendarRangeChange, 
  t, 
  tourBuilderBasicsRef 
}) {
  return (
    <section
      ref={tourBuilderBasicsRef}
      className={`plan-unified-section plan-unified-section--basics${builderSectionCollapsed.basics ? ' plan-unified-section--collapsed' : ''}`}
      id="plan-basics"
    >
      <div className="plan-section-head-toggle">
        <div className="plan-section-step">
          <span className="plan-step-num">1</span>
          <h2 className="plan-section-title" id="plan-basics-label">{t('home', 'planStepBasics')}</h2>
        </div>
        <button
          type="button"
          className="plan-builder-section-toggle"
          onClick={() => toggleBuilderSection('basics')}
          aria-expanded={!builderSectionCollapsed.basics}
          aria-controls="plan-basics-body"
        >
          <Icon name={builderSectionCollapsed.basics ? 'expand_more' : 'expand_less'} size={22} aria-hidden />
          <span>{builderSectionCollapsed.basics ? t('home', 'planBuilderSectionShow') : t('home', 'planBuilderSectionHide')}</span>
        </button>
      </div>
      {!builderSectionCollapsed.basics && (
        <div id="plan-basics-body" className="plan-builder-section-body" role="region" aria-labelledby="plan-basics-label">
          <div className="plan-unified-basics">
            <button type="button" className="plan-builder-back" onClick={handleCancelEdit} aria-label={t('home', 'cancel')}>
              <Icon name="arrow_back" size={22} /> {t('home', 'cancel')}
            </button>
            <div className="plan-unified-basics-form">
              <input
                type="text"
                className="plan-builder-title"
                value={editName}
                maxLength={200}
                onChange={(e) => { setEditName(e.target.value); setNameError(''); }}
                placeholder={t('home', 'tripNamePlaceholder')}
                aria-label={t('home', 'tripName')}
                aria-invalid={!!nameError}
              />
              {nameError && <p className="plan-name-error" role="alert">{nameError}</p>}
              <p className="plan-label plan-notes-label">{t('home', 'tripNotesOptional')}</p>
              <textarea
                className="plan-notes-input"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder={t('home', 'tripNotesPlaceholder')}
                rows={3}
                maxLength={10000}
                aria-label={t('home', 'tripNotesOptional')}
              />
              <div className="plan-quick-dates" role="group" aria-label={t('home', 'planQuickDates')}>
                <button type="button" className="plan-quick-date-chip" onClick={() => applyEditQuickPreset('today')}>{t('home', 'planQuickToday')}</button>
                <button type="button" className="plan-quick-date-chip" onClick={() => applyEditQuickPreset('weekend')}>{t('home', 'planQuickWeekend')}</button>
                <button type="button" className="plan-quick-date-chip" onClick={() => applyEditQuickPreset('week')}>{t('home', 'planQuickWeek')}</button>
              </div>
              <div className="plan-builder-dates">
                <label>
                  <span className="plan-label">{t('home', 'startDate')}</span>
                  <input type="date" value={editStart} onChange={(e) => { setEditStart(e.target.value); setDateError(null); }} aria-invalid={!!dateError} />
                </label>
                <label>
                  <span className="plan-label">{t('home', 'endDate')}</span>
                  <input type="date" value={editEnd} onChange={(e) => { setEditEnd(e.target.value); setDateError(null); }} aria-invalid={!!dateError} />
                </label>
              </div>
            </div>
            {editDays.some((d) => placeIdsFromDay(d).length > 0) && (
              <button
                type="button"
                className="plan-builder-map-btn"
                onClick={() => {
                  showToast(t('home', 'planToastOpenMap'), 'info');
                  navigate('/map', {
                    state: {
                      tripPlaceIds: editDays.flatMap((d) => placeIdsFromDay(d)),
                      tripDays: editDays,
                      tripName: editName || t('home', 'planTitle'),
                      tripStartDate: editStart || '',
                    },
                  });
                }}
              >
                <Icon name="map" size={20} /> {t('detail', 'viewOnMap')}
              </button>
            )}
          </div>
          {dateError && <p className="plan-date-error" role="alert">{dateError}</p>}
          <div className="plan-calendar-wrap">
            <DateRangeCalendar
              startDate={editStart || undefined}
              endDate={editEnd || undefined}
              onChange={onEditCalendarRangeChange}
              hintStart={t('home', 'selectStartDate')}
              hintEnd={t('home', 'selectEndDate')}
            />
          </div>
        </div>
      )}
    </section>
  );
}
