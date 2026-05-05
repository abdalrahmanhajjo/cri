import { DateRangeCalendar } from '../Calendar';

export function PlanCreateForm({ 
  tourCreateFormRef, 
  handleCreateSubmit, 
  createName, 
  setCreateName, 
  setNameError, 
  nameError, 
  createDescription, 
  setCreateDescription, 
  applyCreateQuickPreset, 
  createStart, 
  setCreateStart, 
  createEnd, 
  setCreateEnd, 
  setDateError, 
  dateError, 
  tourCreateCalendarRef, 
  onCreateCalendarRangeChange, 
  tourCreateActionsRef, 
  saving, 
  handleCloseCreateForm, 
  t 
}) {
  return (
    <form ref={tourCreateFormRef} className="plan-create-form" onSubmit={handleCreateSubmit}>
      <h3 className="plan-form-title">{t('home', 'createTrip')}</h3>
      <label>
        <span className="plan-label">{t('home', 'tripName')}</span>
        <input 
          type="text" 
          value={createName} 
          onChange={(e) => { setCreateName(e.target.value); setNameError(''); }} 
          maxLength={200} 
          placeholder={t('home', 'tripNamePlaceholder')} 
          className="plan-input" 
          aria-invalid={!!nameError} 
        />
      </label>
      {nameError && <p className="plan-name-error" role="alert">{nameError}</p>}
      <label>
        <span className="plan-label">{t('home', 'tripNotesOptional')}</span>
        <textarea 
          value={createDescription} 
          onChange={(e) => setCreateDescription(e.target.value)} 
          className="plan-input plan-input--textarea" 
          rows={3} 
          maxLength={10000} 
          placeholder={t('home', 'tripNotesPlaceholder')} 
        />
      </label>
      <div className="plan-quick-dates plan-quick-dates--create" role="group" aria-label={t('home', 'planQuickDates')}>
        <button type="button" className="plan-quick-date-chip" onClick={() => applyCreateQuickPreset('today')}>{t('home', 'planQuickToday')}</button>
        <button type="button" className="plan-quick-date-chip" onClick={() => applyCreateQuickPreset('weekend')}>{t('home', 'planQuickWeekend')}</button>
        <button type="button" className="plan-quick-date-chip" onClick={() => applyCreateQuickPreset('week')}>{t('home', 'planQuickWeek')}</button>
      </div>
      <div className="plan-create-dates">
        <label>
          <span className="plan-label">{t('home', 'startDate')}</span>
          <input type="date" value={createStart} onChange={(e) => { setCreateStart(e.target.value); setDateError(null); }} className="plan-input" required />
        </label>
        <label>
          <span className="plan-label">{t('home', 'endDate')}</span>
          <input type="date" value={createEnd} onChange={(e) => { setCreateEnd(e.target.value); setDateError(null); }} className="plan-input" required />
        </label>
      </div>
      {dateError && <p className="plan-date-error" role="alert">{dateError}</p>}
      <div ref={tourCreateCalendarRef} className="plan-calendar-wrap">
        <DateRangeCalendar
          startDate={createStart || undefined}
          endDate={createEnd || undefined}
          onChange={onCreateCalendarRangeChange}
          hintStart={t('home', 'selectStartDate')}
          hintEnd={t('home', 'selectEndDate')}
        />
      </div>
      <div ref={tourCreateActionsRef} className="plan-form-actions">
        <button type="submit" className="vd-btn vd-btn--primary" disabled={saving}>
          {saving ? t('home', 'loading') : t('home', 'saveTrip')}
        </button>
        <button type="button" className="vd-btn vd-btn--secondary" onClick={handleCloseCreateForm}>
          {t('home', 'cancel')}
        </button>
      </div>
    </form>
  );
}
