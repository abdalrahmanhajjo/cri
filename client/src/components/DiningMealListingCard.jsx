import { Link } from 'react-router-dom';
import { getPlaceImageUrl } from '../api/client';
import DeliveryImg from './DeliveryImg';
import Icon from './Icon';
import { diningOfferTeaser } from '../utils/diningOfferTeaser';
import { diningSignals } from '../utils/diningPlaceSignals';

const DINING_PLACE_HASH = '#place-dining-heading';

function serviceModeLabel(token, t) {
  const k = String(token || '').toLowerCase();
  const id =
    k === 'delivery'
      ? 'svcDelivery'
      : k === 'takeaway'
        ? 'svcTakeaway'
        : k === 'reservations'
          ? 'svcReservations'
          : k === 'outdoor seating'
            ? 'svcOutdoor'
            : null;
  return id ? t('diningGuide', id) : token;
}

export default function DiningMealListingCard({
  place,
  onMapClick,
  offerHighlight,
  /** When set, the card highlights this offer line (Deals & specials list); place name moves under it. */
  offerHeadline = '',
  mealLineCountForPlace = 0,
  viewDetailsLabel,
  mapAriaLabel,
  t,
  sponsoredBadge = null,
}) {
  const img = getPlaceImageUrl(place.image || (place.images && place.images[0])) || null;
  const rating = place.rating != null ? Number(place.rating).toFixed(1) : null;
  const dp = place?.diningProfile && typeof place.diningProfile === 'object' ? place.diningProfile : {};
  const phoneDial = String(dp.contactPhone || '')
    .trim()
    .replace(/[^\d+]/g, '');
  const website = String(dp.socialMedia?.website || '').trim();
  const detailToDining = `/place/${place.id}${DINING_PLACE_HASH}`;
  const sig = diningSignals(place);
  const reserve = Boolean(dp.reservations);
  const orderCapable = Boolean(dp.delivery || dp.takeaway);
  const hasMenuBlock = Boolean(sig.hasMenu);
  const reviewN = Number(place?.reviewCount ?? place?.reviews_count ?? place?.reviewsCount ?? 0) || 0;
  const bookHref = phoneDial ? `tel:${phoneDial}` : detailToDining;
  const orderHref = phoneDial ? `tel:${phoneDial}` : website || detailToDining;
  const orderExternal = Boolean(website && orderHref === website);
  const headline = String(offerHeadline || '').trim();
  const offerTeaser = headline
    ? ''
    : offerHighlight
      ? diningOfferTeaser(place)
      : '';
  const nCart = Number(mealLineCountForPlace) || 0;

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
  const quickRow = quick.slice(0, 3);

  const menuCartAria =
    nCart > 0
      ? t('diningGuide', 'cardActionMenuCartBadge').replace('{n}', String(nCart))
      : t('diningGuide', 'cardActionPickMenu');

  return (
    <article
      className={`hg-stay-card hg-stay-card--dining${sponsoredBadge ? ' hg-stay-card--partner' : ''}${offerHeadline ? ' hg-stay-card--offer-mode' : ''}`}
    >
      <Link to={`/place/${place.id}`} className="hg-stay-card__main">
        <div className="hg-stay-card__media">
          {sponsoredBadge ? (
            <span className="hg-stay-card__partnerBadge">{sponsoredBadge}</span>
          ) : null}
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
          {headline ? (
            <>
              <h3 className="hg-stay-card__title hg-dining-card__offerHeadline">{headline}</h3>
              <p className="hg-dining-card__placeUnder">{place.name}</p>
            </>
          ) : (
            <h3 className="hg-stay-card__title">{place.name}</h3>
          )}
          {!headline && offerHighlight && offerTeaser ? (
            <p className="hg-dining-card__offerLine">{offerTeaser}</p>
          ) : null}
          {place.location ? <p className="hg-stay-card__loc">{place.location}</p> : null}
          {sig.cuisines.length > 0 ? (
            <div className="hg-dining-card__cuisines">
              {sig.cuisines.slice(0, 3).map((c) => (
                <span key={c} className="hg-dining-card__cuisine">
                  {c}
                </span>
              ))}
            </div>
          ) : null}
          {sig.serviceModes.length > 0 ? (
            <div className="hg-dining-card__svc">
              {sig.serviceModes.slice(0, 4).map((sm) => (
                <span key={sm} className="hg-dining-card__svcPill">
                  {serviceModeLabel(sm, t)}
                </span>
              ))}
            </div>
          ) : null}
          {reviewN > 0 ? (
            <p className="hg-dining-card__reviews">
              {t('diningGuide', 'reviewsShort').replace('{count}', String(reviewN))}
            </p>
          ) : null}
          <span className="hg-stay-card__cta">
            <span>{viewDetailsLabel}</span>
            <Icon name="arrow_forward" size={18} aria-hidden />
          </span>
        </div>
      </Link>
      <div className="hg-dining-card__footer hg-dining-card__footer--split">
        <div
          className="hg-dining-card__quickSlot"
          role={quickRow.length > 0 ? 'group' : undefined}
          aria-label={quickRow.length > 0 ? t('diningGuide', 'cardQuickGroupLabel') : undefined}
        >
          {quickRow.length > 0 ? <div className="hg-dining-card__quick">{quickRow}</div> : null}
        </div>
        <div className="hg-stay-card__actions">
          <Link
            to={detailToDining}
            className={`hg-stay-card__btn hg-stay-card__btn--cart${nCart > 0 ? ' hg-stay-card__btn--cart-has' : ''}`}
            aria-label={menuCartAria}
          >
            <Icon name="restaurant_menu" size={18} aria-hidden />
            <span className="hg-stay-card__btn-text">{t('diningGuide', 'cardActionMenu')}</span>
            {nCart > 0 ? <span className="hg-dining-cart-count">{nCart}</span> : null}
          </Link>
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
      </div>
    </article>
  );
}
