import { Link } from 'react-router-dom';
import Icon from '../Icon';

export function PlanDayView({ 
  day, 
  i, 
  editStart, 
  getDateForDay, 
  placeIdsFromDay, 
  optimizeDayOrder, 
  schedulingDayIndex, 
  groupedPlacesBySlot, 
  TIME_SLOTS, 
  timeSlotLabel, 
  updateSlotTime, 
  removePlaceFromDay, 
  t 
}) {
  const groups = groupedPlacesBySlot(day, i);
  const nPlaces = placeIdsFromDay(day).length;

  return (
    <div key={i} className="plan-day-card plan-day-card--unified">
      <h3 className="plan-day-title">
        {t('home', 'dayLabel')} {i + 1}
        {editStart && getDateForDay(editStart, i) && (
          <span className="plan-day-date">
            {' '}({new Date(getDateForDay(editStart, i) + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })})
          </span>
        )}
      </h3>
      {nPlaces > 0 && (
        <>
          <button
            type="button"
            className="plan-optimize-btn"
            onClick={() => { void optimizeDayOrder(i); }}
            disabled={schedulingDayIndex !== null}
          >
            <Icon name="auto_awesome" size={18} />{' '}
            {schedulingDayIndex === i ? t('home', 'loading') : t('home', 'planOptimizeOrder')}
          </button>
          <p className="plan-smart-schedule-hint">{t('home', 'planSmartScheduleHint')}</p>
        </>
      )}
      <div className="plan-day-slots">
        {TIME_SLOTS.map((slot) => {
          const items = groups[slot] || [];
          if (items.length === 0) return null;
          return (
            <div key={slot} className="plan-day-slot">
              <span className="plan-day-slot-label">{timeSlotLabel(slot)}</span>
              <ul className="plan-day-places">
                {items.map(({ placeId, name, slot: slotRow }) => (
                  <li key={placeId} className="plan-day-place">
                    <div className="plan-day-place-main">
                      <Link to={`/place/${placeId}`} className="plan-day-place-link">{name || placeId}</Link>
                      <div className="plan-slot-times">
                        <label className="plan-time-field">
                          <span className="plan-time-field-label">{t('home', 'tripSlotStart')}</span>
                          <input
                            type="time"
                            value={(slotRow.startTime && String(slotRow.startTime).slice(0, 5)) || ''}
                            onChange={(e) => updateSlotTime(i, placeId, 'startTime', e.target.value ? `${e.target.value}:00` : '')}
                          />
                        </label>
                        <label className="plan-time-field">
                          <span className="plan-time-field-label">{t('home', 'tripSlotEnd')}</span>
                          <input
                            type="time"
                            value={(slotRow.endTime && String(slotRow.endTime).slice(0, 5)) || ''}
                            onChange={(e) => updateSlotTime(i, placeId, 'endTime', e.target.value ? `${e.target.value}:00` : '')}
                          />
                        </label>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="plan-day-place-remove"
                      onClick={() => removePlaceFromDay(i, placeId)}
                      aria-label={t('home', 'planRemoveFromPlan')}
                    >
                      <Icon name="close" size={18} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      {nPlaces === 0 && (
        <p className="plan-day-empty">{t('home', 'planDayEmpty')}</p>
      )}
    </div>
  );
}
