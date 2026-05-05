import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import Icon from '../Icon';

export function ActivitiesHubHero({ tab, counts, title, subtitle }) {
  const { t } = useLanguage();

  return (
    <header className="activities-hub-hero">
      <div className="vd-container activities-hub-hero-inner">
        <nav className="activities-hub-tabs" aria-label={t('nav', 'activitiesHubTabsLabel')}>
          <Link
            to="/activities?tab=events"
            replace
            className={`activities-hub-tab ${tab === 'events' ? 'activities-hub-tab--active' : ''}`}
            aria-current={tab === 'events' ? 'page' : undefined}
          >
            <Icon name="celebration" size={22} aria-hidden />
            <span className="activities-hub-tab-label">{t('nav', 'eventsFestivals')}</span>
            <span className="activities-hub-tab-count" aria-hidden="true">
              {counts.events}
            </span>
          </Link>
          <Link
            to="/activities?tab=experiences"
            replace
            className={`activities-hub-tab ${tab === 'experiences' ? 'activities-hub-tab--active' : ''}`}
            aria-current={tab === 'experiences' ? 'page' : undefined}
          >
            <Icon name="hiking" size={22} aria-hidden />
            <span className="activities-hub-tab-label">{t('nav', 'activitiesHubNav')}</span>
            <span className="activities-hub-tab-count" aria-hidden="true">
              {counts.tours}
            </span>
          </Link>
        </nav>
        <div className="activities-hub-intro">
          <h1 className="activities-hub-title">{title}</h1>
          <p className="activities-hub-sub">{subtitle}</p>
          <div className="activities-hub-intro-meta" aria-label={t('nav', 'activitiesHubTabsLabel')}>
            <span className="activities-hub-intro-pill">
              <Icon name="hiking" size={16} aria-hidden />
              {t('nav', 'activitiesExperiences')}: {counts.tours}
            </span>
            <span className="activities-hub-intro-pill">
              <Icon name="celebration" size={16} aria-hidden />
              {t('nav', 'eventsFestivals')}: {counts.events}
            </span>
            <Link to="/map" className="activities-hub-intro-link">
              {t('home', 'viewMap')} <Icon name="arrow_forward" size={16} />
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
