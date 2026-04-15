const fs = require('fs');
const path = require('path');
const target = path.join(__dirname, '../client/src/pages/PlaceDining.jsx');
let s = fs.readFileSync(target, 'utf8');

const oldFn = `function StayCard({ place, onMapClick, onAddToTrip, viewDetailsLabel, mapAriaLabel, addToTripLabel }) {
  const img = getPlaceImageUrl(place.image || (place.images && place.images[0])) || null;
  const rating = place.rating != null ? Number(place.rating).toFixed(1) : null;
  return (
    <article className="hg-stay-card">
      <Link to={\`/place/\${place.id}\`} className="hg-stay-card__main">
        <div className="hg-stay-card__media">
          {img ? (
            <DeliveryImg url={img} preset="gridCard" alt="" />
          ) : (
            <span className="hg-stay-card__fallback">
              <Icon name="restaurant" size={32} />
            </span>
          )}
          <div className="hg-stay-card__frame" aria-hidden />
          {rating ? (
            <span className="hg-stay-card__rating">
              <Icon name="star" size={14} /> {rating}
            </span>
          ) : null}
        </div>
        <div className="hg-stay-card__body">
          <h3 className="hg-stay-card__title">{place.name}</h3>
          {place.location ? <p className="hg-stay-card__loc">{place.location}</p> : null}
          <span className="hg-stay-card__cta">
            <span>{viewDetailsLabel}</span>
            <Icon name="arrow_forward" size={18} aria-hidden />
          </span>
        </div>
      </Link>
      <div className="hg-stay-card__actions">
        {onAddToTrip ? (
          <button
            type="button"
            className="hg-stay-card__btn hg-stay-card__btn--trip"
            onClick={() => onAddToTrip(place)}
            aria-label={addToTripLabel}
          >
            <Icon name="event_note" size={18} aria-hidden />
          </button>
        ) : null}
        {onMapClick ? (
          <button
            type="button"
            className="hg-stay-card__btn hg-stay-card__btn--map"
            onClick={() => onMapClick(place)}
            aria-label={mapAriaLabel}
          >
            <Icon name="map" size={18} aria-hidden />
          </button>
        ) : null}
      </div>
    </article>
  );
}`;

const newFn = `const DINING_PLACE_HASH = '#place-dining-heading';

function DiningListingCard({ place, onMapClick, onAddToTrip, viewDetailsLabel, mapAriaLabel, addToTripLabel, t }) {
  const img = getPlaceImageUrl(place.image || (place.images && place.images[0])) || null;
  const rating = place.rating != null ? Number(place.rating).toFixed(1) : null;
  const dp = place?.diningProfile && typeof place.diningProfile === 'object' ? place.diningProfile : {};
  const phoneDial = String(dp.contactPhone || '')
    .trim()
    .replace(/[^\\d+]/g, '');
  const website = String(dp.socialMedia?.website || '').trim();
  const detailToDining = \`/place/\${place.id}\${DINING_PLACE_HASH}\`;
  const sig = diningSignals(place);
  const reserve = Boolean(dp.reservations);
  const orderCapable = Boolean(dp.delivery || dp.takeaway);
  const hasMenuBlock = Boolean(sig.hasMenu);
  const hasOffersHint = matchesDiningFlow(place, 'offers');
  const bookHref = phoneDial ? \`tel:\${phoneDial}\` : detailToDining;
  const orderHref = phoneDial ? \`tel:\${phoneDial}\` : website || detailToDining;
  const orderExternal = Boolean(website && orderHref === website);

  const quick = [];
  if (reserve) {
    quick.push(
      <a key="book" href={bookHref} className="hg-dining-card__chip">
        <Icon name="event_note" size={14} aria-hidden />
        <span>{t('diningGuide', 'cardActionBook')}</span>
      </a>
    );
  }
  if (orderCapable) {
    if (orderExternal) {
      quick.push(
        <a
          key="order"
          href={orderHref}
          target="_blank"
          rel="noreferrer"
          className="hg-dining-card__chip"
        >
          <Icon name="storefront" size={14} aria-hidden />
          <span>{t('diningGuide', 'cardActionOrder')}</span>
        </a>
      );
    } else {
      quick.push(
        <Link key="order" to={orderHref} className="hg-dining-card__chip">
          <Icon name="storefront" size={14} aria-hidden />
          <span>{t('diningGuide', 'cardActionOrder')}</span>
        </Link>
      );
    }
  }
  if (hasMenuBlock) {
    quick.push(
      <Link key="menu" to={detailToDining} className="hg-dining-card__chip">
        <Icon name="menu_book" size={14} aria-hidden />
        <span>{t('diningGuide', 'cardActionMenu')}</span>
      </Link>
    );
  }
  if (hasOffersHint) {
    quick.push(
      <Link key="offers" to={detailToDining} className="hg-dining-card__chip hg-dining-card__chip--accent">
        <Icon name="sell" size={14} aria-hidden />
        <span>{t('diningGuide', 'cardActionOffers')}</span>
      </Link>
    );
  }

  return (
    <article className="hg-stay-card hg-stay-card--dining">
      <Link to={\`/place/\${place.id}\`} className="hg-stay-card__main">
        <div className="hg-stay-card__media">
          {img ? (
            <DeliveryImg url={img} preset="gridCard" alt="" />
          ) : (
            <span className="hg-stay-card__fallback">
              <Icon name="restaurant" size={32} />
            </span>
          )}
          <div className="hg-stay-card__frame" aria-hidden />
          {rating ? (
            <span className="hg-stay-card__rating">
              <Icon name="star" size={14} /> {rating}
            </span>
          ) : null}
        </div>
        <div className="hg-stay-card__body">
          <h3 className="hg-stay-card__title">{place.name}</h3>
          {place.location ? <p className="hg-stay-card__loc">{place.location}</p> : null}
          <span className="hg-stay-card__cta">
            <span>{viewDetailsLabel}</span>
            <Icon name="arrow_forward" size={18} aria-hidden />
          </span>
        </div>
      </Link>
      {quick.length > 0 ? (
        <div className="hg-dining-card__quick" role="group" aria-label={t('diningGuide', 'cardQuickGroupLabel')}>
          {quick}
        </div>
      ) : null}
      <div className="hg-stay-card__actions">
        {onAddToTrip ? (
          <button
            type="button"
            className="hg-stay-card__btn hg-stay-card__btn--trip"
            onClick={() => onAddToTrip(place)}
            aria-label={addToTripLabel}
          >
            <Icon name="event_note" size={18} aria-hidden />
          </button>
        ) : null}
        {onMapClick ? (
          <button
            type="button"
            className="hg-stay-card__btn hg-stay-card__btn--map"
            onClick={() => onMapClick(place)}
            aria-label={mapAriaLabel}
          >
            <Icon name="map" size={18} aria-hidden />
          </button>
        ) : null}
      </div>
    </article>
  );
}`;

if (!s.includes(oldFn)) {
  console.error('Old StayCard block not found');
  process.exit(1);
}
s = s.replace(oldFn, newFn);
s = s.replace(/<StayCard/g, '<DiningListingCard');
fs.writeFileSync(target, s);
console.log('OK');
