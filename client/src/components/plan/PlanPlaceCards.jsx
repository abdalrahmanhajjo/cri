import { Link } from 'react-router-dom';
import { getPlaceImageUrl } from '../../api/client';
import Icon from '../Icon';
import DeliveryImg from '../DeliveryImg';

export function PlanPlaceCard({ 
  place, 
  isFavourite, 
  onToggleFavourite, 
  tripDayCount = 0, 
  onAddToTrip, 
  t 
}) {
  if (!place || place.id == null) return null;
  const placeId = String(place.id);
  const imgUrl = getPlaceImageUrl(place.image || (Array.isArray(place.images) && place.images[0])) || null;
  const name = place.name != null ? String(place.name) : '';
  const location = place.location != null ? String(place.location) : '';
  const rating = place.rating != null ? Number(place.rating) : null;
  const bestTime = place.bestTime ? String(place.bestTime) : '';
  const duration = place.duration ? String(place.duration) : '';
  const showTripAdd = typeof onAddToTrip === 'function' && tripDayCount > 0;

  return (
    <div className="plan-discover-card">
      <div className="plan-discover-card-top">
        <Link to={`/place/${placeId}`} className="plan-discover-card-link">
          <div
            className="plan-discover-card-media"
            style={imgUrl ? { backgroundImage: `url("${imgUrl}")` } : undefined}
          >
            {imgUrl ? (
              <DeliveryImg url={imgUrl} preset="planDiscover" alt="" />
            ) : (
              <span className="plan-discover-card-fallback">Place</span>
            )}
            <div className="plan-discover-card-overlay">
              <h3 className="plan-discover-card-title">{name || 'Place'}</h3>
              {location && <p className="plan-discover-card-meta">{location}</p>}
            </div>
            {rating != null && !Number.isNaN(rating) && (
              <span className="plan-discover-card-badge plan-discover-card-rating">
                <Icon name="star" size={14} /> {rating.toFixed(1)}
              </span>
            )}
          </div>
        </Link>
        <div className="plan-discover-card-summary">
          <Link to={`/place/${placeId}`} className="plan-discover-card-summary-title">
            {name || 'Place'}
          </Link>
          {location ? <p className="plan-discover-card-summary-loc">{location}</p> : null}
          {rating != null && !Number.isNaN(rating) ? (
            <span className="plan-discover-card-summary-rating">
              <Icon name="star" size={14} ariaHidden /> {rating.toFixed(1)}
            </span>
          ) : null}
        </div>
      </div>
      <div className="plan-discover-card-footer">
        {bestTime && <span className="plan-discover-card-tag">{bestTime}</span>}
        {duration && <span className="plan-discover-card-tag">{duration}</span>}
        <button
          type="button"
          className={`plan-discover-fav-btn ${isFavourite ? 'plan-discover-fav-btn--active' : ''}`}
          onClick={(e) => { e.preventDefault(); onToggleFavourite(placeId); }}
          aria-label={t('home', 'planSavePlace')}
          title={t('home', 'planSavePlaceOptional')}
        >
          <Icon name={isFavourite ? 'favorite' : 'favorite_border'} size={22} />
        </button>
      </div>
      {showTripAdd && (
        <div className="plan-discover-card-add">
          <span className="plan-fav-add-label">{t('home', 'planAddToDay')}:</span>
          <div className="plan-fav-add-btns">
            {Array.from({ length: tripDayCount }, (_, i) => (
              <button
                key={i}
                type="button"
                className="plan-fav-add-day-btn"
                onClick={(e) => {
                  e.preventDefault();
                  onAddToTrip(placeId, name, i);
                }}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function PlanFavouriteCard({ place, dayCount, onAddToDay, t }) {
  if (!place || place.id == null) return null;
  const placeId = String(place.id);
  const imgUrl = getPlaceImageUrl(place.image || (Array.isArray(place.images) && place.images[0])) || null;
  const name = place.name != null ? String(place.name) : '';
  const category = place.category || '';
  const location = place.location || '';

  return (
    <div className="plan-fav-card">
      <Link to={`/place/${placeId}`} className="plan-fav-card-media">
        {imgUrl ? <DeliveryImg url={imgUrl} preset="planSquare" alt="" /> : null}
        {!imgUrl && <span className="plan-fav-card-fallback">Place</span>}
      </Link>
      <div className="plan-fav-card-body">
        <Link to={`/place/${placeId}`} className="plan-fav-card-title">{name || placeId}</Link>
        {category && <span className="plan-fav-card-cat">{category}</span>}
        {location && <p className="plan-fav-card-loc">{location}</p>}
        <div className="plan-fav-card-actions">
          <span className="plan-fav-add-label">{t('home', 'planAddToDay')}:</span>
          <div className="plan-fav-add-btns">
            {Array.from({ length: dayCount }, (_, i) => (
              <button
                key={i}
                type="button"
                className="plan-fav-add-day-btn"
                onClick={() => onAddToDay(placeId, name, i)}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
