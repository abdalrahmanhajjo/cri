import { Link } from 'react-router-dom';
import { getPlaceImageUrl } from '../../api/client';
import { useLanguage } from '../../context/LanguageContext';
import { translateDynamicField } from '../../i18n/translations';
import Icon from '../Icon';

/* ─── Premium Full-Image Card (Adapted for Activities Grid) ──────────────── */
export function ActivitiesHubCard({ item, type }) {
  const { t, lang } = useLanguage();
  const imgSrc = item.image ? getPlaceImageUrl(item.image) : null;
  const isFree = !item.price || (item.price != null && Number(item.price) === 0);
  const priceLabel = item.priceDisplay || (isFree ? t('home', 'free') : `$${item.price}`);
  
  const startDateObj = item.startDate ? new Date(item.startDate) : null;
  const endDateObj = item.endDate ? new Date(item.endDate) : null;
  
  let dateRangeStr = '';
  if (startDateObj) {
    const startDay = startDateObj.toLocaleDateString(lang, { day: 'numeric' });
    const startMonth = startDateObj.toLocaleDateString(lang, { month: 'short' }).toUpperCase();
    dateRangeStr = `${startDay} ${startMonth}`;
    if (endDateObj && endDateObj.getTime() !== startDateObj.getTime()) {
      const endDay = endDateObj.toLocaleDateString(lang, { day: 'numeric' });
      const endMonth = endDateObj.toLocaleDateString(lang, { month: 'short' }).toUpperCase();
      dateRangeStr += ` - ${endDay} ${endMonth}`;
    }
  }

  return (
    <Link 
      to={`/${type === 'event' ? 'event' : 'tour'}/${item.id}`}
      className={`activities-hub-card activities-hub-card--${type}`}
    >
      <div className="activities-hub-card-media">
        {imgSrc ? (
          <img src={imgSrc} alt="" className="activities-hub-card-img" loading="lazy" />
        ) : (
          <div className="activities-hub-card-fallback">
            <Icon name={type === 'event' ? 'calendar' : 'compass'} size={64} style={{ color: 'rgba(255,255,255,0.15)' }} />
          </div>
        )}
        <div className="activities-hub-card-scrim" />
      </div>

      <div className="activities-hub-card-badge-row">
        <span className="activities-hub-card-category">
          {item.category || (type === 'event' ? 'Event' : 'Tour')}
        </span>
        <span className="activities-hub-card-price">
          {priceLabel}
        </span>
      </div>

      {type === 'event' && dateRangeStr && (
        <div className="activities-hub-card-date" style={{
          padding: '8px 14px', minWidth: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'row', gap: '4px', borderRadius: '12px'
        }}>
          <span style={{ fontSize: '13px', fontWeight: 900, color: '#000', textTransform: 'uppercase', whiteSpace: 'nowrap', letterSpacing: '0.02em' }}>
            {dateRangeStr}
          </span>
        </div>
      )}

      <div className="activities-hub-card-content">
        <div>
          <h3 className="activities-hub-card-title">
            {translateDynamicField(item, 'name', lang)}
          </h3>

          <div className="activities-hub-card-meta">
            {type === 'event' ? (
              <>
                <div className="activities-hub-card-meta-item">
                  <Icon name="map-pin" size={14} />
                  <span style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {translateDynamicField(item, 'location', lang) || 'Tripoli'}
                  </span>
                </div>
                {dateRangeStr && (
                  <div className="activities-hub-card-meta-item">
                    <Icon name="clock" size={14} />
                    <span>{dateRangeStr}</span>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="activities-hub-card-meta-item">
                  <Icon name="clock" size={14} />
                  <span>{item.duration || 'Full day'}</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="activities-hub-card-btn">
           {type === 'event' ? t('home', 'eventDetails') : t('home', 'tourDetails')}
           <Icon name="arrow_forward" size={15} />
        </div>
      </div>
    </Link>
  );
}
