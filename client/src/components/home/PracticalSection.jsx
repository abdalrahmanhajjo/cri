import { Link } from 'react-router-dom';
import Icon from '../Icon';
import FindYourWayMap from '../FindYourWayMap';
import { COMMUNITY_PATH, PLACES_DISCOVER_PATH } from '../../utils/discoverPaths';

export default function PracticalSection({ 
  t, 
  places = [], 
  showMap = true, 
  userTips = true 
}) {
  const safeT = (ns, key) => (t && typeof t === 'function' ? t(ns, key) : key);
  
  return (
    <>
      <section
        className="vd-section vd-experience-tripoli vd-find-your-way vd-find-your-way--practical"
        aria-labelledby="find-your-way-practical-title"
      >
        <div className="vd-container">
          <header className="vd-find-your-way-header vd-find-your-way-header--practical">
            <h2 id="find-your-way-practical-title" className="vd-find-your-way-title">
              {safeT('home', 'findYourWayPracticalTitle')}
            </h2>
            <p className="vd-find-your-way-sub">{safeT('home', 'findYourWayPracticalSub')}</p>
          </header>

          <div className="vd-find-your-way-main-grid vd-find-your-way-main-grid--practical-split">
            <div className="vd-find-your-way-areas-panel">
              <div id="areas" className="vd-plan-trip-block vd-find-your-way-areas-card vd-find-your-way-areas-card--map">
                <div className="vd-find-your-way-areas-card-intro">
                  <h3 className="vd-plan-trip-block-title">{safeT('home', 'areasTitle')}</h3>
                  <p className="vd-plan-trip-block-desc">{safeT('home', 'areasMapSub')}</p>
                  {showMap && (
                    <div className="vd-plan-trip-inline-actions vd-find-your-way-areas-map-link vd-find-your-way-areas-map-link--home-preview">
                      <Link to="/map" className="vd-plan-trip-inline-link">
                        {safeT('home', 'viewMapCta')}
                        <Icon name="arrow_forward" size={18} aria-hidden />
                      </Link>
                    </div>
                  )}
                </div>
                <FindYourWayMap places={places} t={t} loadEager />
              </div>
            </div>

            <aside
              className="vd-find-your-way-practical-aside"
              aria-labelledby="find-your-way-nav-aside-title"
            >
              <div className="vd-plan-trip-block vd-find-your-way-practical-aside-card">
                <h3 id="find-your-way-nav-aside-title" className="vd-plan-trip-block-title">
                  {safeT('home', 'findYourWayNavAsideTitle')}
                </h3>
                <p className="vd-plan-trip-block-desc">{safeT('home', 'findYourWayNavAsideLead')}</p>
                <ul className="vd-find-your-way-practical-aside-list">
                  <li>{safeT('home', 'findYourWayNavAsideBullet1')}</li>
                  <li>{safeT('home', 'findYourWayNavAsideBullet2')}</li>
                  <li>{safeT('home', 'findYourWayNavAsideBullet3')}</li>
                </ul>
                <div className="vd-plan-trip-inline-actions vd-find-your-way-practical-aside-actions">
                  <Link to="/map" className="vd-plan-trip-inline-link">
                    {safeT('home', 'viewMapCta')}
                    <Icon name="arrow_forward" size={18} aria-hidden />
                  </Link>
                  <Link to="/plan" className="vd-plan-trip-inline-link vd-plan-trip-inline-link--secondary">
                    {safeT('home', 'gettingThereCta')}
                    <Icon name="arrow_forward" size={18} aria-hidden />
                  </Link>
                </div>
              </div>
              <div
                className="vd-find-your-way-practical-quick"
                aria-label={safeT('home', 'findYourWayPracticalQuickTitle')}
              >
                <p className="vd-find-your-way-practical-quick-title">
                  {safeT('home', 'findYourWayPracticalQuickTitle')}
                </p>
                <div className="vd-find-your-way-practical-quick-grid">
                  <Link to={PLACES_DISCOVER_PATH} className="vd-find-your-way-practical-quick-link">
                    <Icon name="explore" size={20} aria-hidden />
                    <span>{safeT('home', 'findYourWayPracticalQuickDiscover')}</span>
                  </Link>
                  <Link to="/plan" className="vd-find-your-way-practical-quick-link">
                    <Icon name="calendar_month" size={20} aria-hidden />
                    <span>{safeT('home', 'findYourWayPracticalQuickPlan')}</span>
                  </Link>
                  <Link to={COMMUNITY_PATH} className="vd-find-your-way-practical-quick-link">
                    <Icon name="chat_bubble_outline" size={20} aria-hidden />
                    <span>{safeT('home', 'findYourWayPracticalQuickCommunity')}</span>
                  </Link>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {!userTips && (
        <section id="plan-trip" className="vd-section vd-plan-trip-one vd-plan-trip-one--tips">
          <div className="vd-container">
            <header className="vd-plan-trip-header">
              <h2 className="vd-plan-trip-section-title">{safeT('home', 'planTripTipsSectionTitle')}</h2>
              <p className="vd-plan-trip-section-sub">{safeT('home', 'planTripTipsSectionSub')}</p>
            </header>
            <div className="vd-plan-trip-block vd-plan-trip-block--compact">
              <p className="vd-plan-trip-block-desc">{safeT('home', 'planTripTipsFallback')}</p>
              <div className="vd-plan-trip-inline-actions">
                <Link to="/plan" className="vd-plan-trip-inline-link">
                  {safeT('home', 'gettingThereCta')}
                  <Icon name="arrow_forward" size={18} />
                </Link>
                <Link to={PLACES_DISCOVER_PATH} className="vd-plan-trip-inline-link">
                  {safeT('home', 'seeAllWays')}
                  <Icon name="arrow_forward" size={18} />
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
