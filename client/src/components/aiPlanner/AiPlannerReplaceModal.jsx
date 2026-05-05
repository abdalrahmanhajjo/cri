export default function AiPlannerReplaceModal({
  t,
  aiReplaceSheet,
  setAiReplaceSheet,
  aiReplaceNote,
  setAiReplaceNote,
  sending,
  aiConfigured,
  dataLoading,
  runAiReplaceStop,
}) {
  if (!aiReplaceSheet) return null;

  return (
    <>
      <div
        className="ai-planner-sheet-overlay"
        role="presentation"
        onClick={() => {
          setAiReplaceSheet(null);
          setAiReplaceNote('');
        }}
      />
      <div
        className="ai-planner-sheet ai-planner-sheet--picker"
        role="dialog"
        aria-modal="true"
        aria-label={t('aiPlanner', 'aiReplaceSheetTitle')}
      >
        <h3>{t('aiPlanner', 'aiReplaceSheetTitle')}</h3>
        <p className="ai-planner__plan-sub">{t('aiPlanner', 'aiReplaceHint')}</p>
        <div className="ai-planner-field">
          <label htmlFor="ai-replace-note">{t('aiPlanner', 'aiReplaceOptionalLabel')}</label>
          <textarea
            id="ai-replace-note"
            className="ai-planner__replace-note"
            rows={3}
            value={aiReplaceNote}
            onChange={(e) => setAiReplaceNote(e.target.value)}
            placeholder={t('aiPlanner', 'aiReplacePlaceholder')}
            disabled={sending}
          />
        </div>
        <button
          type="button"
          className="ai-planner__btn ai-planner__btn--primary"
          disabled={sending || !aiConfigured || dataLoading}
          onClick={() => void runAiReplaceStop()}
        >
          {sending ? t('aiPlanner', 'aiReplaceRunning') : t('aiPlanner', 'aiReplaceRun')}
        </button>
        <button
          type="button"
          className="ai-planner-sheet-close"
          onClick={() => {
            setAiReplaceSheet(null);
            setAiReplaceNote('');
          }}
        >
          {t('aiPlanner', 'aiReplaceCancel')}
        </button>
      </div>
    </>
  );
}
