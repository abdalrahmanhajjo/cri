import { Link } from 'react-router-dom';
import DeliveryImg from './DeliveryImg';
import Icon from './Icon';
import { getPlaceImageUrl, getImageUrl } from '../api/client';
import './SponsoredPlaceCard.css';

function resolveImageUrl(item) {
  const override = item?.imageOverrideUrl ? String(item.imageOverrideUrl).trim() : '';
  if (override) return getImageUrl(override);
  const place = item?.place || {};
  return getPlaceImageUrl(place.image || (place.images && place.images[0])) || null;
}

export default function SponsoredPlaceCard({ item, t, variant = 'tile' }) {
  const place = item?.place || {};
  const placeId = place?.id != null ? String(place.id) : item?.placeId != null ? String(item.placeId) : '';
  const title = String(item?.titleOverride || place?.name || '').trim();
  const subtitle = String(item?.subtitleOverride || place?.location || '').trim();
  const badge = String(item?.badgeText || t?.('discover', 'sponsoredLabel') || 'Sponsored').trim();
  const img = resolveImageUrl(item);
  const href = item?.ctaUrl ? String(item.ctaUrl).trim() : '';

  return (
    <div className={`sp-card sp-card--${variant}`}>
      <div className="sp-card-badge">{badge}</div>
      <div className="sp-card-main">
        <div className="sp-card-media">
          {img ? (
            <DeliveryImg url={img} preset="discoverCard" alt="" />
          ) : (
            <span className="sp-card-fallback" aria-hidden>
              <Icon name="place" size={26} />
            </span>
          )}
        </div>
        <div className="sp-card-body">
          <h3 className="sp-card-title">{title || '—'}</h3>
          {subtitle ? <p className="sp-card-subtitle">{subtitle}</p> : null}
          <div className="sp-card-actions">
            {placeId ? (
              <Link to={`/place/${encodeURIComponent(placeId)}`} className="sp-card-link">
                {t?.('discover', 'sponsoredViewPlace') || 'View place'}
              </Link>
            ) : null}
            {href ? (
              <a className="sp-card-link sp-card-link--cta" href={href} target="_blank" rel="noreferrer">
                {t?.('discover', 'sponsoredLearnMore') || 'Learn more'}
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

