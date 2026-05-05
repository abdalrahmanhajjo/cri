import { useAiPlannerState } from '../hooks/useAiPlannerState';
import { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Icon from '../components/Icon';
import {
  chatForTripPlan,
  slotsToTripDays,
  AIPlannerApiError,
  normalizeSuggestedTime,
  getSlotConflictIndices,
  suggestedTimeToMinutes,
  inferTargetedReplaceSlotIndex,
} from '../services/aiPlannerService';
import {
  tripHasDateConflict,
  formatYMD,
  findOverlappingTrips,
  findNextNonOverlappingDateRange,
  clampTripStartDateLocal,
  todayDateOnly,
} from '../utils/tripPlannerHelpers';
import {
  loadPlannerMemory,
  savePlannerMemory,
  createEmptyPlannerMemory,
  recordSuccessfulPlan,
  buildUserFamiliarityBlock,
  sanitizePersonalNote,
  topMemoryCategoriesForRanker,
} from '../utils/aiPlannerUserMemory';
import { loadPlannerPrefs, savePlannerPrefs } from '../utils/aiPlannerPrefs';
import { savePlannerDraft, loadPlannerDraft, clearPlannerDraft } from '../utils/aiPlannerDraft';
import {
  isAiPlannerOnboardingDone,
  setAiPlannerOnboardingDone,
  clearAiPlannerOnboarding,
} from '../utils/aiPlannerOnboardingStorage';
import AiPlannerOnboarding from '../components/AiPlannerOnboarding';
import AiPlannerSettingsModal from '../components/aiPlanner/AiPlannerSettingsModal';
import AiPlannerPlacePickerModal from '../components/aiPlanner/AiPlannerPlacePickerModal';
import AiPlannerReplaceModal from '../components/aiPlanner/AiPlannerReplaceModal';
import AiPlannerHero from '../components/aiPlanner/AiPlannerHero';
import AiPlannerItineraryStudio from '../components/aiPlanner/AiPlannerItineraryStudio';
import './css/AiPlanner.css';

import {
  getTourEffectiveScrollY,
  setTourEffectiveScrollY,
  assistantReplyForPlanner,
  getTourMaxScrollY,
  apiBase,
  buildDayGroupsForDisplay,
  flattenSlotsOrdered,
  buildPlanChangelog,
  buildPlanItineraryPlainText,
  buildDraftPlanContextLine,
  inferTripSettingsFromUserText
} from '../utils/aiPlannerUIHelpers';

export default function AiPlanner() {
  const { t, lang } = useLanguage();
  const { settings } = useSiteSettings();
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const langParam = lang === 'ar' ? 'ar' : lang === 'fr' ? 'fr' : 'en';
  const plannerDisabled = settings.aiPlannerEnabled === false;
  const storageUserId = user?.id != null ? String(user.id) : 'anon';
  const messagesEndRef = useRef(null);
  const messagesScrollRef = useRef(null);
  const chipsBarRef = useRef(null);
  const [planDockDayActive, setPlanDockDayActive] = useState(0);
  const [navFabVisible, setNavFabVisible] = useState(false);

  const plannerState = useAiPlannerState({
    user, t, langParam, plannerDisabled, showToast, chipsBarRef
  });

  const {
    places,
    setPlaces,
    interestsList,
    setInterestsList,
    dataLoading,
    setDataLoading,
    aiConfigured,
    setAiConfigured,
    durationDays,
    setDurationDays,
    placesPerDay,
    setPlacesPerDay,
    budget,
    setBudget,
    selectedDate,
    setSelectedDate,
    interestIds,
    setInterestIds,
    plannerPrefsReady,
    setPlannerPrefsReady,
    settingsOpen,
    setSettingsOpen,
    messages,
    setMessages,
    input,
    setInput,
    sending,
    setSending,
    applying,
    setApplying,
    lastSlots,
    setLastSlots,
    lastPlaces,
    setLastPlaces,
    placePicker,
    setPlacePicker,
    placeSearch,
    setPlaceSearch,
    aiReplaceSheet,
    setAiReplaceSheet,
    aiReplaceNote,
    setAiReplaceNote,
    highlightFreshPlan,
    setHighlightFreshPlan,
    routeOverviewOpen,
    setRouteOverviewOpen,
    planFeedback,
    setPlanFeedback,
    planFeedbackNote,
    setPlanFeedbackNote,
    planFeedbackNoteSent,
    setPlanFeedbackNoteSent,
    planChangelog,
    setPlanChangelog,
    activeChipEditor,
    setActiveChipEditor,
    routeOverviewRef,
    tourSettingsBtnRef,
    tourBriefRef,
    tourMoodsRef,
    tourStudioRef,
    tourPlanRef,
    tourSaveRef,
    tourOpen,
    setTourOpen,
    tourStep,
    setTourStep,
    tourHighlightRect,
    setTourHighlightRect,
    timerSeconds,
    setTimerSeconds,
    plannerMemory,
    setPlannerMemory,
    profilePlannerHints,
    setProfilePlannerHints,
    saveNoteTimeoutRef,
    moodCards,
    placeById,
    interestIdsForPrefs,
    userFamiliarityBlock,
    learnedCategoryHints,
    updatePlannerPersonalNote,
    clearPlannerLearnedMemory,
    applyAiTripSettingsToState,
    interestNames,
    tripBriefSummary,
    buildGuidedPlannerPrompt,
    lastPlanMessageIndex,
    latestUserMessage,
    latestAssistantMessage,
    planConflicts,
    TOUR_STEP_COUNT,
    tourStepMeta,
    tourRefMap,
    syncTourHighlightForStep,
    finishTour,
    startTour,
    formatChangelogDay,
    clampSlot,
    patchSlotField,
    deleteSlotAt,
    conversationHistory,
    sendMessage,
    runAiReplaceStop,
    pushDateOverlapAssistantMessage,
    handleDeleteOverlapTrip,
    handleShiftOverlapDates,
    handleApplyTrip,
    dayHeaderLabel,
    scrollToRouteOverview,
    copyItineraryFromSlots,
    filteredPickerPlaces
  } = plannerState;

  const dateStrForChip = selectedDate.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const budgetChipLabel =
    budget === 'low'
      ? t('aiPlanner', 'budgetLow')
      : budget === 'luxury'
        ? t('aiPlanner', 'budgetLuxury')
        : t('aiPlanner', 'budgetModerate');

  const toggleChipEditor = useCallback((key) => {
    setActiveChipEditor((prev) => (prev === key ? null : key));
  }, []);

  const showPlanDayDock = lastSlots?.length > 0 && lastPlanMessageIndex >= 0;

  const scrollToPlanDaySection = useCallback(
    (dayIndex) => {
      const safe = Math.min(durationDays - 1, Math.max(0, dayIndex));
      const mi = lastPlanMessageIndex;
      if (mi < 0) return;
      const id =
        durationDays > 1 ? `ai-planner-plan-${mi}-day-${safe}` : `ai-planner-plan-${mi}-anchor`;
      requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      setPlanDockDayActive(safe);
    },
    [durationDays, lastPlanMessageIndex]
  );

  useEffect(() => {
    if (!showPlanDayDock || durationDays <= 1 || lastPlanMessageIndex < 0) return undefined;
    const mi = lastPlanMessageIndex;
    const nodes = Array.from({ length: durationDays }, (_, d) =>
      document.getElementById(`ai-planner-plan-${mi}-day-${d}`)
    ).filter(Boolean);
    if (nodes.length === 0) return undefined;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting && e.intersectionRatio > 0.06)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const top = visible[0];
        if (top?.target?.id) {
          const m = new RegExp(`^ai-planner-plan-${mi}-day-(\\d+)$`).exec(top.target.id);
          if (m) setPlanDockDayActive(Number(m[1], 10));
        }
      },
      { threshold: [0.08, 0.18, 0.35], rootMargin: '-10% 0px -48% 0px' }
    );
    nodes.forEach((n) => obs.observe(n));
    return () => obs.disconnect();
  }, [showPlanDayDock, durationDays, lastPlanMessageIndex, messages.length]);

  const dockBottomOffset = 0;
  /** Day-dock row (tabs + save) sits above composer; keep FAB fully above that band. */
  const AI_PLANNER_DAY_DOCK_STACK_PX = 88;
  const navFabBottomPx =
    dockBottomOffset + (showPlanDayDock ? AI_PLANNER_DAY_DOCK_STACK_PX : 0) + 14;

  useEffect(() => {
    const onScroll = () => setNavFabVisible(window.scrollY > 160);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToSiteNav = useCallback(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const behavior = reduce ? 'auto' : 'smooth';
    const el = document.getElementById('site-header');
    if (el) {
      el.scrollIntoView({ behavior, block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior });
    }
  }, []);

  if (plannerDisabled) return <Navigate to="/plan" replace />;

  return (
    <div className={`ai-planner${showPlanDayDock ? ' ai-planner--day-dock' : ''}`}>
      <header className="ai-planner__page-head">
        <Link to="/plan" className="ai-planner__back">
          <Icon name="arrow_back" size={22} /> {t('aiPlanner', 'back')}
        </Link>
        <h1 className="ai-planner__page-title">{t('aiPlanner', 'title')}</h1>
        <div className="ai-planner__page-actions">
          <button
            type="button"
            className="ai-planner__tour-btn"
            onClick={startTour}
            aria-label={t('aiPlanner', 'onboardingRestartAria')}
            title={t('aiPlanner', 'onboardingRestart')}
          >
            <Icon name="auto_awesome" size={22} aria-hidden />
          </button>
          <button
            type="button"
            className="ai-planner__settings"
            ref={tourSettingsBtnRef}
            onClick={() => {
              setActiveChipEditor(null);
              setSettingsOpen(true);
            }}
            aria-label={t('aiPlanner', 'configure')}
          >
            <Icon name="tune" size={22} />
          </button>
        </div>
      </header>

      {!aiConfigured && (
        <p className="ai-planner__banner" role="status">
          {t('aiPlanner', 'notConfigured')} {t('aiPlanner', 'notConfiguredHint')}
        </p>
      )}

      <AiPlannerHero
        t={t}
        aiConfigured={aiConfigured}
        dataLoading={dataLoading}
        sending={sending}
        chipsBarRef={chipsBarRef}
        tourBriefRef={tourBriefRef}
        tourMoodsRef={tourMoodsRef}
        activeChipEditor={activeChipEditor}
        setActiveChipEditor={setActiveChipEditor}
        toggleChipEditor={toggleChipEditor}
        durationDays={durationDays}
        setDurationDays={setDurationDays}
        placesPerDay={placesPerDay}
        setPlacesPerDay={setPlacesPerDay}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        budget={budget}
        setBudget={setBudget}
        dateStrForChip={dateStrForChip}
        budgetChipLabel={budgetChipLabel}
        latestUserMessage={latestUserMessage}
        input={input}
        setInput={setInput}
        sendMessage={sendMessage}
        buildGuidedPlannerPrompt={buildGuidedPlannerPrompt}
        lastSlots={lastSlots}
        moodCards={moodCards}
      />

      <div className="ai-planner__chat" ref={tourStudioRef}>
        <div className="ai-planner__workspace-head">
          <div>
            <span className="ai-planner__section-step">
              {t('aiPlanner', 'sectionStepLabel').replace(/\{n\}/g, '4')}
            </span>
            <h3 className="ai-planner__section-title">{t('aiPlanner', 'onboardingStudioTitle')}</h3>
            <p className="ai-planner__section-sub">{t('aiPlanner', 'studioSectionSub')}</p>
            <div className="ai-planner__brief-summary" aria-label={t('aiPlanner', 'tripBriefSummaryAria')}>
              {tripBriefSummary.map((item) => (
                <span key={item} className="ai-planner__brief-pill">
                  {item}
                </span>
              ))}
            </div>
          </div>
          {lastSlots?.length ? (
            <button
              type="button"
              className="ai-planner__btn ai-planner__btn--ghost"
              disabled={sending || !aiConfigured || dataLoading}
              onClick={() =>
                sendMessage(buildGuidedPlannerPrompt(t('aiPlanner', 'guidedPromptRefreshQuality')))
              }
            >
              <Icon name="refresh" size={18} />
              {t('aiPlanner', 'refreshPlan')}
            </button>
          ) : null}
        </div>
        <div ref={messagesScrollRef} className="ai-planner__messages">
          {dataLoading && (
            <div className="ai-planner__chat-loading" role="status" aria-live="polite">
              {t('aiPlanner', 'chatLoadingPlaces')}
            </div>
          )}
          {latestUserMessage?.content ? (
            <section className="ai-planner__workspace-panel">
              <div className="ai-planner__entry-label">{t('aiPlanner', 'workspaceBriefLabel')}</div>
              <div className="ai-planner__workspace-note">
                {latestUserMessage.content}
              </div>
            </section>
          ) : null}

          {latestAssistantMessage?.content &&
            (latestAssistantMessage.error ||
              !Array.isArray(latestAssistantMessage.slots) ||
              latestAssistantMessage.slots.length === 0) ? (
            <section className="ai-planner__workspace-panel">
              <div className="ai-planner__entry-label">
                {latestAssistantMessage.error
                  ? t('aiPlanner', 'workspaceIssueLabel')
                  : t('aiPlanner', 'workspaceSummaryLabel')}
              </div>
              <div
                className={`ai-planner__bubble ai-planner__bubble--assistant${latestAssistantMessage.error ? ' ai-planner__bubble--error' : ''
                  }`}
              >
                {latestAssistantMessage.content}
                {latestAssistantMessage.error && latestAssistantMessage.retryText && (
                  <div className="ai-planner__plan-actions" style={{ marginTop: 10 }}>
                    <button
                      type="button"
                      className="ai-planner__btn ai-planner__btn--ghost"
                      onClick={() => sendMessage(latestAssistantMessage.retryText)}
                    >
                      {t('aiPlanner', 'tryAgain')}
                    </button>
                  </div>
                )}
              </div>
            </section>
          ) : null}

          {lastPlanMessageIndex >= 0 && messages[lastPlanMessageIndex] && (() => {
            const m = messages[lastPlanMessageIndex];
            const i = lastPlanMessageIndex;
            const editable = true;
            const conflictForMsg = getSlotConflictIndices(m.slots || []);
            return (
              <AiPlannerItineraryStudio
                t={t}
                message={messages[lastPlanMessageIndex]}
                messageIndex={lastPlanMessageIndex}
                editable={true}
                tourPlanRef={tourPlanRef}
                highlightFreshPlan={highlightFreshPlan}
                setHighlightFreshPlan={setHighlightFreshPlan}
                lastSlots={lastSlots}
                lastPlaces={lastPlaces}
                placeById={placeById}
                durationDays={durationDays}
                selectedDate={selectedDate}
                planChangelog={planChangelog}
                setPlanChangelog={setPlanChangelog}
                scrollToPlanDaySection={scrollToPlanDaySection}
                routeOverviewRef={routeOverviewRef}
                routeOverviewOpen={routeOverviewOpen}
                setRouteOverviewOpen={setRouteOverviewOpen}
                scrollToRouteOverview={scrollToRouteOverview}
                navigate={navigate}
                copyItineraryFromSlots={copyItineraryFromSlots}
                dayHeaderLabel={dayHeaderLabel}
                planConflicts={planConflicts}
                patchSlotField={patchSlotField}
                deleteSlotAt={deleteSlotAt}
                aiConfigured={aiConfigured}
                dataLoading={dataLoading}
                sending={sending}
                setAiReplaceNote={setAiReplaceNote}
                setAiReplaceSheet={setAiReplaceSheet}
                setPlaceSearch={setPlaceSearch}
                setPlacePicker={setPlacePicker}
                tourSaveRef={tourSaveRef}
                applying={applying}
                handleApplyTrip={handleApplyTrip}
                planFeedback={planFeedback}
                setPlanFeedback={setPlanFeedback}
                planFeedbackNote={planFeedbackNote}
                setPlanFeedbackNote={setPlanFeedbackNote}
                planFeedbackNoteSent={planFeedbackNoteSent}
                setPlanFeedbackNoteSent={setPlanFeedbackNoteSent}
                showToast={showToast}
                latestAssistantMessage={latestAssistantMessage}
                handleDeleteOverlapTrip={handleDeleteOverlapTrip}
                handleShiftOverlapDates={handleShiftOverlapDates}
              />
            );
          })()}
          {sending && (
            <div className="ai-planner__thinking" role="status" aria-live="polite" aria-busy="true">
              <span className="ai-planner__thinking-icon" aria-hidden>
                <Icon name="auto_awesome" size={22} />
              </span>
              <div className="ai-planner__thinking-copy">
                <span className="ai-planner__thinking-head">{t('aiPlanner', 'thinkingHeadline')}</span>
                <span className="ai-planner__thinking-sub">{t('aiPlanner', 'thinkingSub')}</span>
                <div className="ai-planner__thinking-timer" aria-live="off">
                  <span className="ai-planner__timer-val">{Math.min(100, Math.round((timerSeconds / 23) * 100))}%</span>
                  <div className="ai-planner__timer-progress">
                    <div
                      className="ai-planner__timer-bar"
                      style={{ width: `${Math.min(100, (timerSeconds / 23) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {showPlanDayDock && (
        <div
          className="ai-planner__day-dock"
          style={{ bottom: dockBottomOffset }}
          role="region"
          aria-label={t('aiPlanner', 'dayDockAria')}
        >
          <div className="ai-planner__day-dock-tabs" role="tablist" aria-label={t('aiPlanner', 'dayDockTabsAria')}>
            {durationDays > 1 ? (
              Array.from({ length: durationDays }, (_, d) => (
                <button
                  key={d}
                  type="button"
                  role="tab"
                  aria-selected={planDockDayActive === d}
                  className={`ai-planner__day-dock-tab${planDockDayActive === d ? ' ai-planner__day-dock-tab--active' : ''}`}
                  onClick={() => scrollToPlanDaySection(d)}
                >
                  <span className="ai-planner__day-dock-tab-short">{t('aiPlanner', 'dayLabel')} {d + 1}</span>
                  <span className="ai-planner__day-dock-tab-long" aria-hidden>
                    {dayHeaderLabel(d)}
                  </span>
                </button>
              ))
            ) : (
              <button
                type="button"
                className="ai-planner__day-dock-tab ai-planner__day-dock-tab--solo"
                onClick={() => scrollToPlanDaySection(0)}
              >
                {t('aiPlanner', 'dayDockScrollPlan')}
              </button>
            )}
          </div>
          {lastPlanMessageIndex >= 0 && (
            <button
              type="button"
              className={`ai-planner__day-dock-apply${highlightFreshPlan && lastSlots?.length ? ' ai-planner__day-dock-apply--pulse' : ''
                }`}
              disabled={
                applying ||
                planConflicts.size > 0 ||
                !lastSlots?.length ||
                sending ||
                !aiConfigured
              }
              title={
                planConflicts.size > 0
                  ? t('aiPlanner', 'saveBlockedConflicts')
                  : !lastSlots?.length
                    ? t('aiPlanner', 'saveNeedStops')
                    : highlightFreshPlan
                      ? t('aiPlanner', 'planUpdatedBody')
                      : undefined
              }
              onClick={() => void handleApplyTrip()}
            >
              {applying ? t('aiPlanner', 'applying') : t('aiPlanner', 'applyTrip')}
            </button>
          )}
        </div>
      )}

      <AiPlannerSettingsModal
        t={t}
        settingsOpen={settingsOpen}
        setSettingsOpen={setSettingsOpen}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        durationDays={durationDays}
        setDurationDays={setDurationDays}
        placesPerDay={placesPerDay}
        setPlacesPerDay={setPlacesPerDay}
        budget={budget}
        setBudget={setBudget}
        interestsList={interestsList}
        interestIds={interestIds}
        setInterestIds={setInterestIds}
        plannerMemory={plannerMemory}
        updatePlannerPersonalNote={updatePlannerPersonalNote}
        clearPlannerLearnedMemory={clearPlannerLearnedMemory}
      />

      <AiPlannerPlacePickerModal
        t={t}
        placePicker={placePicker}
        setPlacePicker={setPlacePicker}
        placeSearch={placeSearch}
        setPlaceSearch={setPlaceSearch}
        filteredPickerPlaces={filteredPickerPlaces}
        patchSlotField={patchSlotField}
      />

      <AiPlannerReplaceModal
        t={t}
        aiReplaceSheet={aiReplaceSheet}
        setAiReplaceSheet={setAiReplaceSheet}
        aiReplaceNote={aiReplaceNote}
        setAiReplaceNote={setAiReplaceNote}
        sending={sending}
        aiConfigured={aiConfigured}
        dataLoading={dataLoading}
        runAiReplaceStop={runAiReplaceStop}
      />

      {navFabVisible && (
        <button
          type="button"
          className="ai-planner__nav-fab"
          style={{ bottom: `${navFabBottomPx}px` }}
          onClick={scrollToSiteNav}
          aria-label={t('aiPlanner', 'scrollToSiteNavAria')}
          title={t('aiPlanner', 'scrollToSiteNav')}
        >
          <Icon name="expand_less" size={24} aria-hidden />
        </button>
      )}

      {tourOpen ? (
        <AiPlannerOnboarding
          open={tourOpen}
          stepIndex={tourStep}
          stepCount={TOUR_STEP_COUNT}
          title={tourStepMeta[tourStep]?.title ?? ''}
          body={tourStepMeta[tourStep]?.body ?? ''}
          highlightRect={tourHighlightRect}
          onNext={() => {
            if (tourStep >= TOUR_STEP_COUNT - 1) finishTour();
            else setTourStep((s) => s + 1);
          }}
          onBack={() => {
            if (tourStep === 0) finishTour();
            else setTourStep((s) => Math.max(0, s - 1));
          }}
          onSkip={finishTour}
          isLastStep={tourStep === TOUR_STEP_COUNT - 1}
          nextLabel={t('aiPlanner', 'onboardingNext')}
          backLabel={t('aiPlanner', 'onboardingBack')}
          skipLabel={t('aiPlanner', 'onboardingSkip')}
          doneLabel={t('aiPlanner', 'onboardingDone')}
          progressLabel={t('aiPlanner', 'onboardingProgress')}
          dir={lang === 'ar' ? 'rtl' : 'ltr'}
        />
      ) : null}
    </div>
  );
}
