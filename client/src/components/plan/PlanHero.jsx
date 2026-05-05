import { Link } from 'react-router-dom';
import Icon from '../Icon';

export function PlanHero({
  t,
  incomingShareRequests,
  shareRequestsCollapsed,
  setShareRequestsCollapsed,
  expandedShareRequestIds,
  toggleRequestExpanded,
  handleRespondIncomingShare,
  shareActionBusyId,
  isInBuilder,
  startCreateTour,
  aiPlannerEnabled,
  showCreateForm,
  setShowCreateForm,
  tourCreateBtnRef,
  showToast,
}) {
  return (
    <>
      <header className="plan-hero">
        <div className="plan-hero-inner">
          <h1 className="plan-hero-title">{t('home', 'planTitle')}</h1>
          <p className="plan-hero-sub">{t('home', 'planTripSectionSub')}</p>
        </div>
      </header>

      {!isInBuilder && (
        <div className="plan-mytrips-actions-container">
          <div className="plan-mytrips-actions">
            <div className="plan-mytrips-actions-tools">
              <button
                type="button"
                className="plan-manual-tour-btn"
                onClick={startCreateTour}
                title={t('home', 'manualTourRestart')}
                aria-label={t('home', 'manualTourRestartAria')}
              >
                <Icon name="menu_book" size={22} ariaHidden />
              </button>
              {aiPlannerEnabled !== false && (
                <Link to="/plan/ai" className="plan-btn-ai">
                  <Icon name="auto_awesome" size={22} ariaHidden /> {t('nav', 'aiPlanBannerCta')}
                </Link>
              )}
            </div>
            {!showCreateForm && (
              <button
                type="button"
                className="plan-btn-create plan-btn-create--my-trips-primary"
                ref={tourCreateBtnRef}
                onClick={() => {
                  setShowCreateForm(true);
                  showToast(t('home', 'planToastNewTripForm'), 'info');
                }}
              >
                <Icon name="add" size={24} ariaHidden /> {t('home', 'createTrip')}
              </button>
            )}
          </div>
        </div>
      )}

      {incomingShareRequests.length > 0 && (
        <section className="plan-incoming-shares">
          <div className="plan-section-head-toggle">
            <div className="plan-section-step">
              <Icon name="group_add" size={24} className="plan-step-icon" />
              <h2 className="plan-section-title">{t('home', 'planShareRequests')}</h2>
              <span className="plan-section-badge">{incomingShareRequests.length}</span>
            </div>
            <button
              type="button"
              className="plan-builder-section-toggle"
              onClick={() => setShareRequestsCollapsed(!shareRequestsCollapsed)}
              aria-expanded={!shareRequestsCollapsed}
            >
              <Icon name={shareRequestsCollapsed ? 'expand_more' : 'expand_less'} size={22} />
              <span>{shareRequestsCollapsed ? t('home', 'planBuilderSectionShow') : t('home', 'planBuilderSectionHide')}</span>
            </button>
          </div>
          
          {!shareRequestsCollapsed && (
            <div className="plan-share-requests-list">
              {incomingShareRequests.map((req) => {
                const isExpanded = expandedShareRequestIds.has(req.id);
                const isBusy = shareActionBusyId === req.id;
                return (
                  <div key={req.id} className={`plan-share-request-card ${isExpanded ? 'plan-share-request-card--expanded' : ''}`}>
                    <div className="plan-share-request-main" onClick={() => toggleRequestExpanded(req.id)}>
                      <div className="plan-share-request-info">
                        <p className="plan-share-request-text">
                          <strong>{req.senderName || 'Someone'}</strong> {t('home', 'planShareInviteText')} <strong>{req.tripName}</strong>
                        </p>
                        <span className="plan-share-request-meta">{new Date(req.createdAt).toLocaleDateString()}</span>
                      </div>
                      <Icon name={isExpanded ? 'expand_less' : 'expand_more'} size={20} className="plan-share-request-arrow" />
                    </div>
                    {isExpanded && (
                      <div className="plan-share-request-actions">
                        <button
                          type="button"
                          className="plan-share-accept-btn"
                          disabled={isBusy}
                          onClick={() => handleRespondIncomingShare(req.id, 'accept')}
                        >
                          {isBusy ? t('home', 'loading') : t('home', 'planShareAccept')}
                        </button>
                        <button
                          type="button"
                          className="plan-share-reject-btn"
                          disabled={isBusy}
                          onClick={() => handleRespondIncomingShare(req.id, 'reject')}
                        >
                          {isBusy ? t('home', 'loading') : t('home', 'planShareReject')}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </>
  );
}
