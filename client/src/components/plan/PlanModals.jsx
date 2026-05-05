import Icon from '../Icon';

export function PlanDeleteConfirmModal({ 
  tripDeleteConfirmId, 
  cancelTripDeleteConfirm, 
  pendingDeleteTrip, 
  executeDeleteTrip, 
  deletingTripId, 
  t 
}) {
  if (!tripDeleteConfirmId) return null;

  return (
    <div className="plan-delete-confirm-root">
      <button
        type="button"
        className="plan-delete-confirm-backdrop"
        aria-label={t('home', 'cancel')}
        onClick={cancelTripDeleteConfirm}
      />
      <div
        className="plan-delete-confirm-sheet"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="plan-delete-confirm-title"
        aria-describedby="plan-delete-confirm-desc"
      >
        <p id="plan-delete-confirm-title" className="plan-delete-confirm-title">
          {t('home', 'deleteTripConfirmTitle')}
        </p>
        <p id="plan-delete-confirm-desc" className="plan-delete-confirm-desc">
          {t('home', 'deleteTripConfirmDetail')}
          {pendingDeleteTrip ? (
            <span className="plan-delete-confirm-name">
              {' '}
              — {pendingDeleteTrip.name?.trim() || t('home', 'planTitle')}
            </span>
          ) : null}
        </p>
        <div className="plan-delete-confirm-actions">
          <button type="button" className="plan-delete-confirm-btn plan-delete-confirm-btn--ghost" onClick={cancelTripDeleteConfirm}>
            {t('home', 'cancel')}
          </button>
          <button
            type="button"
            className="plan-delete-confirm-btn plan-delete-confirm-btn--danger"
            onClick={executeDeleteTrip}
            disabled={!!deletingTripId}
          >
            {deletingTripId ? t('home', 'loading') : t('home', 'deleteTrip')}
          </button>
        </div>
      </div>
    </div>
  );
}
