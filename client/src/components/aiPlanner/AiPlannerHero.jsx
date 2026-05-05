import Icon from '../Icon';
import { formatYMD, clampTripStartDateLocal, todayDateOnly } from '../../utils/tripPlannerHelpers';

export default function AiPlannerHero({
  t,
  aiConfigured,
  dataLoading,
  sending,
  chipsBarRef,
  tourBriefRef,
  tourMoodsRef,
  activeChipEditor,
  setActiveChipEditor,
  toggleChipEditor,
  durationDays,
  setDurationDays,
  placesPerDay,
  setPlacesPerDay,
  selectedDate,
  setSelectedDate,
  budget,
  setBudget,
  dateStrForChip,
  budgetChipLabel,
  latestUserMessage,
  input,
  setInput,
  sendMessage,
  buildGuidedPlannerPrompt,
  lastSlots,
  moodCards,
}) {
  return (
    <div className="ai-planner__hero">
      <div className="ai-planner__flow" aria-label={t('aiPlanner', 'plannerFlowAria')}>
        <span className="ai-planner__flow-step ai-planner__flow-step--active">{t('aiPlanner', 'plannerFlow1')}</span>
        <span className="ai-planner__flow-step">{t('aiPlanner', 'plannerFlow2')}</span>
        <span className="ai-planner__flow-step">{t('aiPlanner', 'plannerFlow3')}</span>
        <span className="ai-planner__flow-step">{t('aiPlanner', 'plannerFlow4')}</span>
      </div>

      <div className="ai-planner__chips-wrap" ref={chipsBarRef}>
        <div className="ai-planner__chips-head">
          <div>
            <span className="ai-planner__section-step">
              {t('aiPlanner', 'sectionStepLabel').replace(/\{n\}/g, '1')}
            </span>
            <h3 className="ai-planner__section-title">{t('aiPlanner', 'tripBriefTitle')}</h3>
          </div>
        </div>
        <div className="ai-planner__chips" role="toolbar" aria-label={t('aiPlanner', 'configure')}>
          <button
            type="button"
            className={`ai-planner__chip ai-planner__chip--btn${activeChipEditor === 'duration' ? ' ai-planner__chip--active' : ''}`}
            aria-expanded={activeChipEditor === 'duration'}
            aria-controls="ai-planner-chip-editor"
            onClick={() => toggleChipEditor('duration')}
            aria-label={t('aiPlanner', 'chipEditDuration')}
          >
            {durationDays === 1 ? t('aiPlanner', 'oneDay') : `${durationDays} ${t('aiPlanner', 'days')}`}
          </button>
          <button
            type="button"
            className={`ai-planner__chip ai-planner__chip--btn${activeChipEditor === 'placesPerDay' ? ' ai-planner__chip--active' : ''}`}
            aria-expanded={activeChipEditor === 'placesPerDay'}
            aria-controls="ai-planner-chip-editor"
            onClick={() => toggleChipEditor('placesPerDay')}
            aria-label={t('aiPlanner', 'chipEditPlacesPerDay')}
          >
            {`${placesPerDay} × ${t('aiPlanner', 'perDay')}`}
          </button>
          <button
            type="button"
            className={`ai-planner__chip ai-planner__chip--btn${activeChipEditor === 'date' ? ' ai-planner__chip--active' : ''}`}
            aria-expanded={activeChipEditor === 'date'}
            aria-controls="ai-planner-chip-editor"
            onClick={() => toggleChipEditor('date')}
            aria-label={t('aiPlanner', 'chipEditDate')}
          >
            {dateStrForChip}
          </button>
          <button
            type="button"
            className={`ai-planner__chip ai-planner__chip--btn${activeChipEditor === 'budget' ? ' ai-planner__chip--active' : ''}`}
            aria-expanded={activeChipEditor === 'budget'}
            aria-controls="ai-planner-chip-editor"
            onClick={() => toggleChipEditor('budget')}
            aria-label={t('aiPlanner', 'chipEditBudget')}
          >
            {budgetChipLabel}
          </button>
        </div>
        {activeChipEditor && (
          <div id="ai-planner-chip-editor" className="ai-planner__chip-editor">
            {activeChipEditor === 'duration' && (
              <div className="ai-planner__chip-editor-field">
                <label htmlFor="ai-chip-field-duration">{t('aiPlanner', 'duration')}</label>
                <select
                  id="ai-chip-field-duration"
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
            )}
            {activeChipEditor === 'placesPerDay' && (
              <div className="ai-planner__chip-editor-field">
                <label htmlFor="ai-chip-field-placesPerDay">{t('aiPlanner', 'placesPerDay')}</label>
                <select
                  id="ai-chip-field-placesPerDay"
                  value={placesPerDay}
                  onChange={(e) => setPlacesPerDay(Number(e.target.value))}
                >
                  {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {activeChipEditor === 'date' && (
              <div className="ai-planner__chip-editor-field">
                <label htmlFor="ai-chip-field-date">{t('aiPlanner', 'tripDate')}</label>
                <input
                  id="ai-chip-field-date"
                  type="date"
                  min={todayDateOnly()}
                  value={formatYMD(selectedDate)}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v) setSelectedDate(clampTripStartDateLocal(new Date(`${v}T12:00:00`)));
                  }}
                />
              </div>
            )}
            {activeChipEditor === 'budget' && (
              <div className="ai-planner__chip-editor-field">
                <label htmlFor="ai-chip-field-budget">{t('aiPlanner', 'budget')}</label>
                <select
                  id="ai-chip-field-budget"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                >
                  <option value="low">{t('aiPlanner', 'budgetLow')}</option>
                  <option value="moderate">{t('aiPlanner', 'budgetModerate')}</option>
                  <option value="luxury">{t('aiPlanner', 'budgetLuxury')}</option>
                </select>
              </div>
            )}
            <button
              type="button"
              className="ai-planner__chip-editor-done"
              onClick={() => setActiveChipEditor(null)}
            >
              {t('placeDiscover', 'modalClose')}
            </button>
          </div>
        )}
      </div>

      <div className="ai-planner__request-builder" ref={tourBriefRef}>
        <div className="ai-planner__request-head">
          <div>
            <span className="ai-planner__section-step">
              {t('aiPlanner', 'sectionStepLabel').replace(/\{n\}/g, '2')}
            </span>
            <h3 className="ai-planner__section-title">{t('aiPlanner', 'briefComposerTitle')}</h3>
            <p className="ai-planner__section-sub">{t('aiPlanner', 'briefComposerSub')}</p>
          </div>
          {latestUserMessage?.content ? (
            <span className="ai-planner__request-status">
              {t('aiPlanner', 'briefLatestReady')}
            </span>
          ) : null}
        </div>
        <label className="ai-planner__sr-only" htmlFor="ai-planner-brief">
          {t('aiPlanner', 'placeholder')}
        </label>
        <textarea
          id="ai-planner-brief"
          className="ai-planner__request-textarea"
          rows={5}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('aiPlanner', 'placeholder')}
          disabled={!aiConfigured || dataLoading || sending}
        />
        <div className="ai-planner__request-actions">
          <button
            type="button"
            className="ai-planner__btn ai-planner__btn--primary"
            disabled={!aiConfigured || dataLoading || sending || !input.trim()}
            onClick={() => sendMessage(input)}
          >
            <Icon name="auto_awesome" size={18} />
            {t('aiPlanner', 'generatePlan')}
          </button>
          <button
            type="button"
            className="ai-planner__btn ai-planner__btn--ghost"
            disabled={sending || !aiConfigured || dataLoading || !lastSlots?.length}
            onClick={() =>
              sendMessage(buildGuidedPlannerPrompt(t('aiPlanner', 'guidedPromptRefineFlow')))
            }
          >
            <Icon name="refresh" size={18} />
            {t('aiPlanner', 'improvePlan')}
          </button>
        </div>
      </div>

      <div className="ai-planner__quick-row" ref={tourMoodsRef}>
        <div className="ai-planner__quick-head">
          <span className="ai-planner__section-step">{t('aiPlanner', 'quickStartOptional')}</span>
          <h3 className="ai-planner__section-title">{t('aiPlanner', 'quickStartTitle')}</h3>
        </div>
        <div className="ai-planner__moods">
          {moodCards.map((m) => (
            <button
              key={m.label}
              type="button"
              className="ai-planner__mood"
              title={m.prompt}
              disabled={sending || !aiConfigured || dataLoading}
              onClick={() => sendMessage(m.prompt)}
            >
              <span className="ai-planner__mood-icon" aria-hidden>
                <Icon name={m.icon} size={26} />
              </span>
              {m.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
