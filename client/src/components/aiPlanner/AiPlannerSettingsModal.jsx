import { formatYMD, clampTripStartDateLocal, todayDateOnly } from '../../utils/tripPlannerHelpers';

export default function AiPlannerSettingsModal({
  t,
  settingsOpen,
  setSettingsOpen,
  selectedDate,
  setSelectedDate,
  durationDays,
  setDurationDays,
  placesPerDay,
  setPlacesPerDay,
  budget,
  setBudget,
  interestsList,
  interestIds,
  setInterestIds,
  plannerMemory,
  updatePlannerPersonalNote,
  clearPlannerLearnedMemory,
}) {
  if (!settingsOpen) return null;

  return (
    <>
      <div
        className="ai-planner-sheet-overlay"
        role="presentation"
        onClick={() => setSettingsOpen(false)}
      />
      <div className="ai-planner-sheet" role="dialog" aria-modal="true" aria-label={t('aiPlanner', 'configure')}>
        <h3>{t('aiPlanner', 'configure')}</h3>
        <div className="ai-planner-field">
          <label htmlFor="ai-trip-date">{t('aiPlanner', 'tripDate')}</label>
          <input
            id="ai-trip-date"
            type="date"
            min={todayDateOnly()}
            value={formatYMD(selectedDate)}
            onChange={(e) => {
              const v = e.target.value;
              if (v) setSelectedDate(clampTripStartDateLocal(new Date(`${v}T12:00:00`)));
            }}
          />
        </div>
        <div className="ai-planner-field">
          <label htmlFor="ai-duration">{t('aiPlanner', 'duration')}</label>
          <select
            id="ai-duration"
            value={durationDays}
            onChange={(e) => setDurationDays(Number(e.target.value))}
          >
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {n === 1 ? t('aiPlanner', 'oneDay') : `${n} ${t('aiPlanner', 'days')}`}
              </option>
            ))}
          </select>
        </div>
        <div className="ai-planner-field">
          <label htmlFor="ai-ppd">{t('aiPlanner', 'placesPerDay')}</label>
          <select
            id="ai-ppd"
            value={placesPerDay}
            onChange={(e) => setPlacesPerDay(Number(e.target.value))}
          >
            {[2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>
                {n} {t('aiPlanner', 'perDay')}
              </option>
            ))}
          </select>
        </div>
        <div className="ai-planner-field">
          <label htmlFor="ai-budget">{t('aiPlanner', 'budget')}</label>
          <select id="ai-budget" value={budget} onChange={(e) => setBudget(e.target.value)}>
            <option value="low">{t('aiPlanner', 'budgetLow')}</option>
            <option value="moderate">{t('aiPlanner', 'budgetModerate')}</option>
            <option value="luxury">{t('aiPlanner', 'budgetLuxury')}</option>
          </select>
        </div>
        <div className="ai-planner-field">
          <span id="ai-interests-label">{t('aiPlanner', 'interests')}</span>
          <div className="ai-planner-interests" role="group" aria-labelledby="ai-interests-label">
            {interestsList.map((it) => {
              const id = String(it.id);
              const on = interestIds.has(id);
              return (
                <button
                  key={id}
                  type="button"
                  className={`ai-planner-interest${on ? ' ai-planner-interest--on' : ''}`}
                  onClick={() => {
                    setInterestIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(id)) next.delete(id);
                      else next.add(id);
                      return next;
                    });
                  }}
                >
                  {it.name || id}
                </button>
              );
            })}
          </div>
        </div>
        <div className="ai-planner-field ai-planner-field--memory">
          <h4 className="ai-planner-field__section-title">{t('aiPlanner', 'visitorMemoryTitle')}</h4>
          <p className="ai-planner-field__help">{t('aiPlanner', 'visitorMemoryHelp')}</p>
          <label htmlFor="ai-planner-visitor-note">{t('aiPlanner', 'visitorMemoryLabel')}</label>
          <textarea
            id="ai-planner-visitor-note"
            className="ai-planner__memory-note"
            rows={4}
            value={plannerMemory.personalNote}
            onChange={(e) => updatePlannerPersonalNote(e.target.value)}
            maxLength={600}
            autoComplete="off"
          />
          <button
            type="button"
            className="ai-planner-memory-clear"
            onClick={clearPlannerLearnedMemory}
          >
            {t('aiPlanner', 'visitorMemoryClear')}
          </button>
        </div>
        <button type="button" className="ai-planner-sheet-close" onClick={() => setSettingsOpen(false)}>
          {t('placeDiscover', 'modalClose')}
        </button>
      </div>
    </>
  );
}
