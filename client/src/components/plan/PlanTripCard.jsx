import { Link } from 'react-router-dom';
import Icon from '../Icon';
import { toDateOnly, getDayCount } from '../../utils/tripPlannerHelpers';

export function PlanTripCard({ 
  tr, 
  navigate, 
  t, 
  handleViewTripOnMap, 
  handleShareTrip, 
  handleDuplicateTrip, 
  beginDeleteTrip, 
  duplicatingId, 
  deletingTripId,
  placeIdsFromDay
}) {
  const totalPlaces = Array.isArray(tr.days)
    ? tr.days.reduce((acc, d) => acc + placeIdsFromDay(d).length, 0)
    : 0;
  const numDays = getDayCount(tr.startDate, tr.endDate);
  const hasPlaces = totalPlaces > 0;
  const canHostManage = tr.isHost !== false;

  return (
    <li className="plan-trip-card">
      <button 
        type="button" 
        className="plan-trip-card-inner" 
        onClick={() => navigate(`/trips/${encodeURIComponent(tr.id)}`)}
      >
        <h3>{tr.name || t('home', 'planTitle')}</h3>
        {tr.description && <p className="plan-trip-desc">{tr.description}</p>}
        <div className="plan-trip-stats">
          <span className="plan-trip-stat">{numDays} {numDays === 1 ? 'day' : 'days'}</span>
          <span className="plan-trip-stat">{totalPlaces} {totalPlaces === 1 ? 'place' : 'places'}</span>
        </div>
        <p className="plan-trip-meta">
          {tr.startDate && new Date(toDateOnly(tr.startDate) + 'T12:00:00').toLocaleDateString()}
          {tr.endDate && ` – ${new Date(toDateOnly(tr.endDate) + 'T12:00:00').toLocaleDateString()}`}
        </p>
        <span className="plan-trip-arrow" aria-hidden="true"><Icon name="arrow_forward" size={22} /></span>
      </button>
      <div className="plan-trip-card-actions">
        {hasPlaces && (
          <button 
            type="button" 
            className="plan-trip-card-btn plan-trip-card-btn--primary" 
            onClick={(e) => { e.stopPropagation(); handleViewTripOnMap(tr); }}
          >
            <Icon name="map" size={18} /> {t('detail', 'viewOnMap')}
          </button>
        )}
        <button 
          type="button" 
          className="plan-trip-card-btn" 
          onClick={(e) => { e.stopPropagation(); handleShareTrip(tr); }}
        >
          <Icon name="share" size={18} /> {t('detail', 'share')}
        </button>
        <button 
          type="button" 
          className="plan-trip-card-btn" 
          onClick={(e) => { e.stopPropagation(); handleDuplicateTrip(tr); }} 
          disabled={duplicatingId === tr.id}
        >
          <Icon name="content_copy" size={18} /> {t('home', 'duplicate')}
        </button>
        {canHostManage && (
          <button
            type="button"
            className="plan-trip-card-btn plan-trip-card-btn--danger plan-trip-card-btn--icon-only"
            onClick={(e) => {
              e.stopPropagation();
              beginDeleteTrip(tr.id);
            }}
            disabled={deletingTripId === tr.id || duplicatingId === tr.id}
            aria-busy={deletingTripId === tr.id}
            aria-label={
              deletingTripId === tr.id ? t('home', 'loading') : t('home', 'deleteTrip')
            }
          >
            <Icon name="delete" size={20} ariaHidden />
          </button>
        )}
      </div>
    </li>
  );
}
