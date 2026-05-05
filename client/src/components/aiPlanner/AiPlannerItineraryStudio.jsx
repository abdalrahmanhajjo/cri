import Icon from '../Icon';
import { normalizeSuggestedTime, getSlotConflictIndices } from '../../services/aiPlannerService';
import { slotsToTripDays } from '../../services/aiPlannerService';
import { buildDayGroupsForDisplay } from '../../utils/aiPlannerUIHelpers';

export default function AiPlannerItineraryStudio({
  t,
  message,
  messageIndex,
  editable,
  tourPlanRef,
  highlightFreshPlan,
  setHighlightFreshPlan,
  lastSlots,
  lastPlaces,
  placeById,
  durationDays,
  selectedDate,
  planChangelog,
  setPlanChangelog,
  scrollToPlanDaySection,
  routeOverviewRef,
  routeOverviewOpen,
  setRouteOverviewOpen,
  scrollToRouteOverview,
  navigate,
  copyItineraryFromSlots,
  dayHeaderLabel,
  planConflicts,
  patchSlotField,
  deleteSlotAt,
  aiConfigured,
  dataLoading,
  sending,
  setAiReplaceNote,
  setAiReplaceSheet,
  setPlaceSearch,
  setPlacePicker,
  tourSaveRef,
  applying,
  handleApplyTrip,
  planFeedback,
  setPlanFeedback,
  planFeedbackNote,
  setPlanFeedbackNote,
  planFeedbackNoteSent,
  setPlanFeedbackNoteSent,
  showToast,
  latestAssistantMessage,
  handleDeleteOverlapTrip,
  handleShiftOverlapDates,
}) {
  const i = messageIndex;
  const m = message;
  const conflictForMsg = getSlotConflictIndices(m.slots || []);

  return (
    <div>
      <div
        ref={tourPlanRef}
        className={`ai-planner__plan${
          highlightFreshPlan && lastSlots?.length ? ' ai-planner__plan--fresh' : ''
        }`}
        id={`ai-planner-plan-${i}-anchor`}
      >
        {highlightFreshPlan && lastSlots?.length > 0 ? (
          <div className="ai-planner__plan-alert" role="status" aria-live="polite">
            <div className="ai-planner__plan-alert-row">
              <span className="ai-planner__plan-alert-icon" aria-hidden>
                <Icon name="auto_awesome" size={22} />
              </span>
              <div className="ai-planner__plan-alert-copy">
                <p className="ai-planner__plan-alert-title">{t('aiPlanner', 'planUpdatedTitle')}</p>
                <p className="ai-planner__plan-alert-body">{t('aiPlanner', 'planUpdatedBody')}</p>
                {planChangelog?.length ? (
                  <div className="ai-planner__plan-changelog" aria-label={t('aiPlanner', 'planChangeTitle')}>
                    <p className="ai-planner__plan-changelog-title">{t('aiPlanner', 'planChangeTitle')}</p>
                    <ul className="ai-planner__plan-changelog-list">
                      {planChangelog.map((line, ci) => (
                        <li key={ci}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="ai-planner__plan-alert-actions">
              <button
                type="button"
                className="ai-planner__btn ai-planner__btn--primary"
                onClick={() => scrollToPlanDaySection(0)}
              >
                <Icon name="vertical_align_top" size={18} aria-hidden />
                {t('aiPlanner', 'planJumpToItinerary')}
              </button>
              <button
                type="button"
                className="ai-planner__btn ai-planner__btn--ghost"
                onClick={() => scrollToRouteOverview()}
              >
                <Icon name="view_list" size={18} aria-hidden />
                {t('aiPlanner', 'planOpenRouteOverview')}
              </button>
              <button
                type="button"
                className="ai-planner__btn ai-planner__btn--ghost"
                onClick={() => {
                  setHighlightFreshPlan(false);
                  setPlanChangelog(null);
                }}
              >
                {t('aiPlanner', 'planUpdatedDismiss')}
              </button>
            </div>
          </div>
        ) : null}

        {lastSlots?.length > 0 ? (
          <div
            ref={routeOverviewRef}
            id="ai-planner-route-overview"
            className="ai-planner__route-overview"
          >
            <div className="ai-planner__route-overview-toolbar">
              <button
                type="button"
                className="ai-planner__route-overview-toggle"
                aria-expanded={routeOverviewOpen}
                onClick={() => setRouteOverviewOpen((v) => !v)}
              >
                <Icon name="view_list" size={20} aria-hidden />
                <span>{t('aiPlanner', 'routeOverviewTitle')}</span>
                <Icon name={routeOverviewOpen ? 'expand_less' : 'expand_more'} size={20} aria-hidden />
              </button>
            <button
                type="button"
                className="ai-planner__route-overview-copy"
                onClick={() => {
                  const days = slotsToTripDays(lastSlots || [], durationDays, selectedDate || new Date());
                  navigate('/map', {
                    state: {
                      tripPlaceIds: lastPlaces?.map((p) => String(p.id)) || [],
                      tripDays: days,
                      tripName: t('aiPlanner', 'planUnsavedRoute'),
                    },
                  });
                }}
                title={t('home', 'viewMapCta')}
                aria-label={t('home', 'viewMapCta')}
              >
                <Icon name="map" size={20} aria-hidden />
              </button>
              <button
                type="button"
                className="ai-planner__route-overview-copy"
                onClick={() => copyItineraryFromSlots(m.slots)}
                title={t('aiPlanner', 'copyItinerary')}
                aria-label={t('aiPlanner', 'copyItinerary')}
              >
                <Icon name="content_copy" size={20} aria-hidden />
              </button>
            </div>
            {routeOverviewOpen ? (
              <>
                <p className="ai-planner__route-overview-hint">{t('aiPlanner', 'routeOverviewHint')}</p>
                <ul className="ai-planner__route-overview-list">
                  {buildDayGroupsForDisplay(m.slots, durationDays).map(({ dayIndex, items }) => (
                    <li key={dayIndex} className="ai-planner__route-overview-day">
                      <span className="ai-planner__route-overview-day-label">
                        {dayHeaderLabel(dayIndex)}
                      </span>
                      <span className="ai-planner__route-overview-stops" dir="ltr">
                        {items.length === 0
                          ? '—'
                          : items
                              .map(({ s }) => placeById[String(s.placeId)]?.name || String(s.placeId))
                              .join(' → ')}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        ) : null}

        <p className="ai-planner__plan-title">{t('aiPlanner', 'proposedPlan')}</p>
        {editable && (
          <>
            <p className="ai-planner__plan-sub">{t('aiPlanner', 'planEditHint')}</p>
            <p className="ai-planner__plan-sub ai-planner__plan-sub--muted">{t('aiPlanner', 'smartScheduleNote')}</p>
          </>
        )}
        {editable && planConflicts.size > 0 && (
          <p className="ai-planner__plan-warning" role="status">
            {t('aiPlanner', 'timeConflictBanner')}
          </p>
        )}
        <div className="ai-planner__plan-days">
          {buildDayGroupsForDisplay(m.slots, durationDays).map(({ dayIndex, items }) => (
            <div
              key={dayIndex}
              className="ai-planner__plan-day"
              id={`ai-planner-plan-${i}-day-${dayIndex}`}
            >
              <div className="ai-planner__plan-day-head">
                <span className="ai-planner__plan-day-title">{dayHeaderLabel(dayIndex)}</span>
                <span className="ai-planner__plan-day-count">{items.length}</span>
              </div>
              {items.length === 0 ? (
                <p className="ai-planner__plan-day-empty">{t('aiPlanner', 'planDayEmpty')}</p>
              ) : (
                <ul className="ai-planner__plan-stops">
                  {items.map(({ s, idx: slotIndex }) => {
                    const pl = placeById[s.placeId];
                    const rowConflict = conflictForMsg.has(slotIndex);
                    return (
                      <li
                        key={`${i}-${slotIndex}-${s.placeId}`}
                        className={`ai-planner__stop-card${
                          rowConflict ? ' ai-planner__stop-card--warn' : ''
                        }`}
                      >
                        <div className="ai-planner__stop-card__rail" aria-hidden />
                        <div className="ai-planner__stop-card__main">
                          <div className="ai-planner__stop-card__row1">
                            {editable ? (
                              <div className="ai-planner__stop-time-group">
                                <label
                                  className="ai-planner__sr-only"
                                  htmlFor={`ai-time-${i}-${slotIndex}`}
                                >
                                  {t('aiPlanner', 'changeTime')}
                                </label>
                                <input
                                  id={`ai-time-${i}-${slotIndex}`}
                                  type="time"
                                  className="ai-planner__stop-time-input"
                                  value={normalizeSuggestedTime(s.suggestedTime)}
                                  onChange={(e) =>
                                    patchSlotField(i, slotIndex, {
                                      suggestedTime: e.target.value,
                                    })
                                  }
                                />
                                {s.endTime && (
                                  <>
                                    <span className="ai-planner__time-separator" style={{ margin: '0 4px', color: 'var(--te-text-muted)' }}>–</span>
                                    <input
                                      aria-label={t('aiPlanner', 'endTime')}
                                      type="time"
                                      className="ai-planner__stop-time-input"
                                      value={normalizeSuggestedTime(s.endTime)}
                                      onChange={(e) =>
                                        patchSlotField(i, slotIndex, {
                                          endTime: e.target.value,
                                        })
                                      }
                                    />
                                  </>
                                )}
                                {durationDays > 1 && (
                                  <select
                                    className="ai-planner__stop-day-select"
                                    aria-label={t('aiPlanner', 'whichDay')}
                                    value={Math.min(
                                      durationDays - 1,
                                      Math.max(0, s.dayIndex ?? 0)
                                    )}
                                    onChange={(e) =>
                                      patchSlotField(i, slotIndex, {
                                        dayIndex: Number(e.target.value),
                                      })
                                    }
                                  >
                                    {Array.from({ length: durationDays }, (_, d) => (
                                      <option key={d} value={d}>
                                        {t('aiPlanner', 'dayLabel')} {d + 1}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            ) : (
                              <span className="ai-planner__stop-time-readonly">
                                {durationDays > 1 ? `D${(s.dayIndex ?? 0) + 1} · ` : ''}
                                {normalizeSuggestedTime(s.suggestedTime)}
                                {s.endTime ? ` – ${normalizeSuggestedTime(s.endTime)}` : ''}
                              </span>
                            )}
                            {editable && (
                              <div className="ai-planner__stop-actions">
                                <button
                                  type="button"
                                  className="ai-planner__icon-btn ai-planner__icon-btn--ai"
                                  aria-label={t('aiPlanner', 'aiReplaceWithAi')}
                                  disabled={!aiConfigured || dataLoading || sending}
                                  onClick={() => {
                                    setAiReplaceNote('');
                                    setAiReplaceSheet({ messageIndex: i, slotIndex });
                                  }}
                                >
                                  <Icon name="auto_awesome" size={20} />
                                </button>
                                <button
                                  type="button"
                                  className="ai-planner__icon-btn"
                                  aria-label={t('aiPlanner', 'editPlace')}
                                  onClick={() => {
                                    setPlaceSearch('');
                                    setPlacePicker({ messageIndex: i, slotIndex });
                                  }}
                                >
                                  <Icon name="edit" size={20} />
                                </button>
                                <button
                                  type="button"
                                  className="ai-planner__icon-btn ai-planner__icon-btn--danger"
                                  aria-label={t('aiPlanner', 'deleteStop')}
                                  onClick={() => deleteSlotAt(i, slotIndex)}
                                >
                                  <Icon name="delete" size={20} />
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="ai-planner__stop-name">
                            {pl?.name || s.placeId}
                          </div>
                          {editable && durationDays > 1 && (
                            <div className="ai-planner__stop-day-inline">
                              <label className="ai-planner__stop-day-inline-label" htmlFor={`ai-day-inline-${i}-${slotIndex}`}>
                                {t('aiPlanner', 'whichDay')}
                              </label>
                              <select
                                id={`ai-day-inline-${i}-${slotIndex}`}
                                className="ai-planner__stop-day-select ai-planner__stop-day-select--inline"
                                value={Math.min(durationDays - 1, Math.max(0, s.dayIndex ?? 0))}
                                onChange={(e) =>
                                  patchSlotField(i, slotIndex, {
                                    dayIndex: Number(e.target.value),
                                  })
                                }
                              >
                                {Array.from({ length: durationDays }, (_, d) => (
                                  <option key={d} value={d}>
                                    {t('aiPlanner', 'dayLabel')} {d + 1}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                          {pl?.category && (
                            <div className="ai-planner__stop-cat">{pl.category}</div>
                          )}
                          {s.reason && (
                            <div className="ai-planner__plan-reason">{s.reason}</div>
                          )}
                          {editable && rowConflict && (
                            <p className="ai-planner__stop-conflict">
                              {t('aiPlanner', 'timeConflictRow')}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>
        {editable && (
          <div className="ai-planner__plan-actions" ref={tourSaveRef}>
            <p className="ai-planner__plan-gap-hint">{t('aiPlanner', 'minGapHint')}</p>
            <button
              type="button"
              className="ai-planner__btn ai-planner__btn--primary"
              disabled={
                applying || planConflicts.size > 0 || !lastSlots?.length
              }
              title={
                planConflicts.size > 0
                  ? t('aiPlanner', 'saveBlockedConflicts')
                  : !lastSlots?.length
                    ? t('aiPlanner', 'saveNeedStops')
                    : undefined
              }
              onClick={handleApplyTrip}
            >
              {applying ? t('aiPlanner', 'applying') : t('aiPlanner', 'applyTrip')}
            </button>
            <div className="ai-planner__plan-feedback" role="group" aria-label={t('aiPlanner', 'planFeedbackPrompt')}>
              <span className="ai-planner__plan-feedback-prompt">{t('aiPlanner', 'planFeedbackPrompt')}</span>
              <div className="ai-planner__plan-feedback-btns">
                <button
                  type="button"
                  className={`ai-planner__plan-feedback-btn${planFeedback === 'up' ? ' ai-planner__plan-feedback-btn--active' : ''}`}
                  disabled={planFeedback != null}
                  aria-pressed={planFeedback === 'up'}
                  onClick={() => {
                    setPlanFeedback('up');
                    setPlanFeedbackNote('');
                    setPlanFeedbackNoteSent(false);
                    showToast(t('aiPlanner', 'planFeedbackThanks'), 'success');
                  }}
                >
                  <Icon name="thumb_up" size={20} aria-hidden />
                  <span className="ai-planner__sr-only">{t('aiPlanner', 'planFeedbackThanks')}</span>
                </button>
                <button
                  type="button"
                  className={`ai-planner__plan-feedback-btn${planFeedback === 'down' ? ' ai-planner__plan-feedback-btn--active' : ''}`}
                  disabled={planFeedback != null}
                  aria-pressed={planFeedback === 'down'}
                  onClick={() => {
                    setPlanFeedback('down');
                    showToast(t('aiPlanner', 'planFeedbackDownNote'), 'info');
                  }}
                >
                  <Icon name="thumb_down" size={20} aria-hidden />
                  <span className="ai-planner__sr-only">{t('aiPlanner', 'planFeedbackDownNote')}</span>
                </button>
              </div>
              {planFeedback === 'down' && !planFeedbackNoteSent ? (
                <div className="ai-planner__plan-feedback-detail">
                  <label htmlFor="ai-planner-feedback-note" className="ai-planner__plan-feedback-detail-label">
                    {t('aiPlanner', 'planFeedbackOptional')}
                  </label>
                  <textarea
                    id="ai-planner-feedback-note"
                    className="ai-planner__plan-feedback-textarea"
                    rows={3}
                    maxLength={600}
                    value={planFeedbackNote}
                    onChange={(e) => setPlanFeedbackNote(e.target.value)}
                    placeholder={t('aiPlanner', 'planFeedbackPlaceholder')}
                  />
                  <button
                    type="button"
                    className="ai-planner__btn ai-planner__btn--ghost ai-planner__plan-feedback-send-note"
                    disabled={!planFeedbackNote.trim()}
                    onClick={() => {
                      setPlanFeedbackNoteSent(true);
                      showToast(t('aiPlanner', 'planFeedbackNoteThanks'), 'success');
                    }}
                  >
                    {t('aiPlanner', 'planFeedbackSendNote')}
                  </button>
                </div>
              ) : null}
              {planFeedback === 'down' && planFeedbackNoteSent ? (
                <p className="ai-planner__plan-feedback-note-done">{t('aiPlanner', 'planFeedbackNoteThanks')}</p>
              ) : null}
            </div>
          </div>
        )}
      </div>
      {latestAssistantMessage?.overlapRange && (
        <div className="ai-planner__overlap-actions">
          <p className="ai-planner__overlap-hint">{t('aiPlanner', 'overlapActionsHint')}</p>
          {(latestAssistantMessage.overlapTrips || []).map((trip) => (
            <button
              key={trip.id}
              type="button"
              className="ai-planner__overlap-btn ai-planner__overlap-btn--danger"
              onClick={() => handleDeleteOverlapTrip(trip.id, i)}
            >
              {t('aiPlanner', 'overlapDeleteTrip').replace(
                /\{name\}/g,
                (trip.name && String(trip.name).trim()) || t('aiPlanner', 'unnamedTrip')
              )}
            </button>
          ))}
          <button
            type="button"
            className="ai-planner__overlap-btn"
            onClick={() => handleShiftOverlapDates(i)}
          >
            {t('aiPlanner', 'overlapShiftDates')}
          </button>
        </div>
      )}
    </div>
  );
}
