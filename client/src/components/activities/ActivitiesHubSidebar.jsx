import { useLanguage } from '../../context/LanguageContext';
import Icon from '../Icon';
import { DateRangeCalendar } from '../Calendar';

export function ActivitiesHubSidebar({
  tab,
  showEventsHubView,
  evtDate,
  setEvtDate,
  eventDays,
  calendarDayMetadata,
  evtCategory,
  setEvtCategory,
  categoryOptions,
  evtStatus,
  setEvtStatus,
  statusOptions,
  difficultyOptions,
  expDifficulty,
  setExpDifficulty,
  anyTourHasDurationHours,
  evtDuration,
  setEvtDuration,
  expDuration,
  setExpDuration,
  clearEvents,
  clearExperiences,
  evtFiltersActive,
  expFiltersActive,
  experienceCategories,
  expCategory,
  setExpCategory,
}) {
  const { t } = useLanguage();

  return (
    <aside className={`activities-hub-sidebar ${showEventsHubView ? 'activities-hub-sidebar--hub' : ''}`}>
      <div className="activities-hub-sidebar-sticky">
        {tab === 'experiences' ? (
          <div className="activities-hub-sidebar-section">
            <h3 className="activities-hub-sidebar-title">
              {t('home', 'activitiesHubCategory')}
            </h3>
            <div className="activities-hub-category-list">
              {experienceCategories.map((cat) => (
                <button
                  key={cat.id}
                  className={`activities-hub-category-btn ${expCategory === cat.slug ? 'activities-hub-category-btn--active' : ''}`}
                  onClick={() => setExpCategory(expCategory === cat.slug ? '' : cat.slug)}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {!showEventsHubView && (
              <div className="activities-hub-sidebar-section">
                <h3 className="activities-hub-sidebar-title">{t('home', 'filterByDate') || 'Pick Date'}</h3>
                <DateRangeCalendar 
                  startDate={evtDate}
                  endDate={evtDate}
                  onChange={(s) => setEvtDate(s)}
                  showHint={false}
                  isRange={false}
                  className="calendar--sidebar"
                  specialDays={Array.from(eventDays)}
                />
              </div>
            )}
            <div className={showEventsHubView ? 'event-sidebar-section' : 'activities-hub-sidebar-section'}>
              <h3 className={showEventsHubView ? 'event-sidebar-label' : 'activities-hub-sidebar-title'}>
                {t('home', 'activitiesHubCategory')}
              </h3>
              <select
                className={showEventsHubView ? 'event-sidebar-select' : 'activities-hub-select activities-hub-select--sidebar'}
                value={evtCategory}
                onChange={(e) => setEvtCategory(e.target.value)}
              >
                <option value="">{t('home', 'activitiesHubCategoryAll')}</option>
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </>
        )}

        {tab === 'events' ? (
          <div className={showEventsHubView ? 'event-sidebar-section' : 'activities-hub-sidebar-section'}>
            <h3 className={showEventsHubView ? 'event-sidebar-label' : 'activities-hub-sidebar-title'}>
              {t('home', 'activitiesHubStatus')}
            </h3>
            <select
              className={showEventsHubView ? 'event-sidebar-select' : 'activities-hub-select activities-hub-select--sidebar'}
              value={evtStatus}
              onChange={(e) => setEvtStatus(e.target.value)}
            >
              <option value="">{t('home', 'activitiesHubStatusAll')}</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        ) : (
          difficultyOptions.length > 0 && (
            <div className="activities-hub-sidebar-section">
              <h3 className="activities-hub-sidebar-title">{t('home', 'activitiesHubDifficulty')}</h3>
              <select
                className="activities-hub-select activities-hub-select--sidebar"
                value={expDifficulty}
                onChange={(e) => setExpDifficulty(e.target.value)}
              >
                <option value="">{t('home', 'activitiesHubDifficultyAll')}</option>
                {difficultyOptions.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          )
        )}

        {(tab === 'events' || anyTourHasDurationHours) && (
          <div className={showEventsHubView ? 'event-sidebar-section' : 'activities-hub-sidebar-section'}>
            <h3 className={showEventsHubView ? 'event-sidebar-label' : 'activities-hub-sidebar-title'}>
              {t('home', 'activitiesHubDuration')}
            </h3>
            <select
              className={showEventsHubView ? 'event-sidebar-select' : 'activities-hub-select activities-hub-select--sidebar'}
              value={tab === 'events' ? evtDuration : expDuration}
              onChange={(e) => tab === 'events' ? setEvtDuration(e.target.value) : setExpDuration(e.target.value)}
            >
              <option value="">{t('home', 'activitiesHubDurationAll')}</option>
              <option value="short">{t('home', 'activitiesHubDurationShort')}</option>
              <option value="half">{t('home', 'activitiesHubDurationHalf')}</option>
              <option value="full">{t('home', 'activitiesHubDurationFull')}</option>
            </select>
          </div>
        )}

        <div className={showEventsHubView ? 'event-sidebar-section' : 'activities-hub-sidebar-section'} style={{ marginTop: 'auto' }}>
          <button 
            type="button" 
            className={showEventsHubView ? 'event-sidebar-clear-link' : 'activities-hub-clear activities-hub-clear--sidebar'} 
            onClick={tab === 'events' ? clearEvents : clearExperiences}
            disabled={tab === 'events' ? !evtFiltersActive : !expFiltersActive}
          >
            {!showEventsHubView && <Icon name="history" size={18} />}
            {t('home', 'activitiesHubClear')}
          </button>
        </div>
      </div>
    </aside>
  );
}
