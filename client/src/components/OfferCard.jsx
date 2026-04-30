import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import api from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import './css/OfferCard.css';

function isCouponItem(item) {
  const id = item?.id != null ? String(item.id) : '';
  return id.startsWith('coupon-');
}

function isPlacePromoItem(item) {
  const id = item?.id != null ? String(item.id) : '';
  return id.startsWith('promo-');
}

/** Coded coupons and coded place promotions use the same redeem + “show at checkout” flow. */
function isRedeemableOffer(item) {
  const code = String(item?.code ?? '').trim();
  if (!code) return false;
  return isCouponItem(item) || isPlacePromoItem(item);
}

function formatOfferDate(iso, lang) {
  if (iso == null || iso === '') return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const locale = lang === 'ar' ? 'ar' : lang === 'fr' ? 'fr' : 'en';
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

function formatOfferAmount(n, lang) {
  const num = Number(n);
  if (!Number.isFinite(num)) return String(n ?? '');
  const locale = lang === 'ar' ? 'ar-LB' : lang === 'fr' ? 'fr-LB' : 'en-GB';
  try {
    return new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(num);
  } catch {
    return String(num);
  }
}

/** Server sends coupon copy + raw fields; DB translations override; English templates removed from SQL. */
function resolveCouponTitle(pr, t) {
  const title = String(pr.title ?? '').trim();
  if (title) return title;
  const place = String(pr.placeName ?? '').trim();
  if (place) return place;
  return t('discover', 'couponDefaultTitle');
}

function resolveCouponSubtitle(pr, t, lang) {
  const sub = String(pr.subtitle ?? '').trim();
  if (sub) return sub;
  const min = pr.minPurchase != null ? Number(pr.minPurchase) : 0;
  if (min > 0) {
    return t('discover', 'couponMinPurchase').replace('{amount}', formatOfferAmount(min, lang));
  }
  return null;
}

function resolveCouponDiscountLabel(pr, t, lang) {
  const label = String(pr.discountLabel ?? '').trim();
  if (label) return label;
  const type = pr.discountType != null ? String(pr.discountType).toLowerCase() : '';
  const val = pr.discountValue != null ? Number(pr.discountValue) : NaN;
  if (!Number.isFinite(val)) return '';
  const formatted = formatOfferAmount(val, lang);
  if (type === 'percent') return t('discover', 'couponPercentOff').replace('{value}', formatted);
  if (type === 'fixed') return t('discover', 'couponFixedOff').replace('{value}', formatted);
  return '';
}

function resolveCouponTerms(pr, t) {
  const terms = String(pr.terms ?? '').trim();
  if (terms) return terms;
  const lim = pr.usageLimit;
  if (lim != null && lim !== '' && Number.isFinite(Number(lim))) {
    return t('discover', 'couponUsageLimit').replace('{n}', String(lim));
  }
  return null;
}

function offerValidityText({ startsAt, endsAt, t, lang }) {
  const s = formatOfferDate(startsAt != null ? String(startsAt) : '', lang);
  const e = formatOfferDate(endsAt != null ? String(endsAt) : '', lang);
  if (s && e) return t('discover', 'offerValidPeriod').replace('{start}', s).replace('{end}', e);
  if (e) return t('discover', 'offerValidUntilLine').replace('{date}', e);
  if (s) return t('discover', 'offerValidFromLine').replace('{date}', s);
  return null;
}

const CHECKOUT_WINDOW_MS = 5 * 60 * 1000;

function formatCountdownMs(ms) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  return `${mm}:${String(ss).padStart(2, '0')}`;
}

export default function OfferCard({
  item,
  index = 0,
  showPlaceLink = true,
  t,
  user = null,
  redeemedPromotionIds = null,
  onRedeemed,
}) {
  const { lang } = useLanguage();
  const pr = item;
  const promoId = pr?.id != null ? String(pr.id) : '';
  const placeId = pr.placeId != null ? String(pr.placeId) : '';
  const placeName = pr.placeName;
  const placeNameTrim = String(placeName ?? '').trim();
  const showLink = showPlaceLink && placeNameTrim && placeId;
  const coupon = isCouponItem(pr);
  const redeemable = isRedeemableOffer(pr);
  const pillLabel = coupon ? t('discover', 'couponPill') : t('discover', 'offerPill');
  const displayTitle = coupon ? resolveCouponTitle(pr, t) : String(pr.title ?? '');
  const displaySubtitle = coupon
    ? resolveCouponSubtitle(pr, t, lang)
    : pr.subtitle != null && String(pr.subtitle).trim()
      ? pr.subtitle
      : null;
  const displayDiscount = coupon
    ? resolveCouponDiscountLabel(pr, t, lang)
    : String(pr.discountLabel ?? '').trim();
  const displayTerms = coupon ? resolveCouponTerms(pr, t) : pr.terms != null && String(pr.terms).trim() ? pr.terms : null;
  const validityLine = offerValidityText({
    startsAt: pr.startsAt,
    endsAt: pr.endsAt,
    t,
    lang,
  });
  const showGlobalHint = coupon && !placeNameTrim;
  const redeemedList = Array.isArray(redeemedPromotionIds) ? redeemedPromotionIds : [];
  const alreadyRedeemed = coupon && promoId && redeemedList.includes(promoId);

  const [codeInput, setCodeInput] = useState('');
  const [redeemBusy, setRedeemBusy] = useState(false);
  const [redeemError, setRedeemError] = useState(null);
  const [justRedeemed, setJustRedeemed] = useState(false);
  const [checkoutWindowEnd, setCheckoutWindowEnd] = useState(null);
  const [, setCheckoutTick] = useState(0);

  useEffect(() => {
    if (checkoutWindowEnd == null) return undefined;
    if (Date.now() >= checkoutWindowEnd) {
      setCheckoutWindowEnd(null);
      return undefined;
    }
    const id = setInterval(() => {
      if (Date.now() >= checkoutWindowEnd) setCheckoutWindowEnd(null);
      setCheckoutTick((n) => n + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [checkoutWindowEnd]);

  const checkoutRemainingMs =
    checkoutWindowEnd != null ? checkoutWindowEnd - Date.now() : 0;
  const showCheckoutWindow = checkoutWindowEnd != null && checkoutRemainingMs > 0;

  async function handleRedeem(e) {
    e.preventDefault();
    if (!redeemable || !promoId || !user) return;
    setRedeemError(null);
    setRedeemBusy(true);
    try {
      const data = await api.coupons.redeem(promoId, codeInput);
      if (data?.ok) {
        setJustRedeemed(true);
        setCodeInput('');
        onRedeemed?.(promoId);
        if (!data.alreadyRedeemed) {
          setCheckoutWindowEnd(Date.now() + CHECKOUT_WINDOW_MS);
        }
      }
    } catch (err) {
      setRedeemError(err?.message || t('discover', 'redeemError'));
    } finally {
      setRedeemBusy(false);
    }
  }

  return (
    <article className="ig-offer-card" style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}>
      <div className="ig-offer-card-inner">
        <div className="ig-offer-card-head">
          <span className="ig-offer-pill">{pillLabel}</span>
          {displayDiscount ? <span className="ig-offer-discount">{displayDiscount}</span> : null}
        </div>
        <h2 className="ig-offer-title">{displayTitle}</h2>
        {displaySubtitle ? <p className="ig-offer-sub">{displaySubtitle}</p> : null}
        {validityLine && <p className="ig-offer-validity">{validityLine}</p>}
        {showGlobalHint && <p className="ig-offer-global-hint">{t('discover', 'offerGlobalHint')}</p>}
        {pr.code && (
          <div className="ig-offer-code-row">
            <span className="ig-offer-code-label">{t('discover', 'offerCode')}</span>
            <code className="ig-offer-code">{pr.code}</code>
          </div>
        )}
        {showLink ? (
          <Link to={`/place/${placeId}`} className="ig-offer-link">
            {placeNameTrim}
            <Icon name="chevron_right" size={18} />
          </Link>
        ) : (
          placeNameTrim && <p className="ig-offer-place">{placeNameTrim}</p>
        )}
        {displayTerms ? <p className="ig-offer-terms">{displayTerms}</p> : null}

        {redeemable && (
          <div className="ig-offer-redeem">
            {alreadyRedeemed || justRedeemed ? (
              <div className="ig-offer-redeemed-wrap">
                <p className="ig-offer-redeemed-badge" role="status">
                  <Icon name="check_circle" size={18} aria-hidden="true" />
                  {t('discover', 'redeemRedeemedBadge')}
                </p>
                {showCheckoutWindow && (
                  <div className="ig-offer-redeem-window" role="status" aria-live="polite">
                    <p className="ig-offer-redeem-window-text">{t('discover', 'redeemUseWithinFiveMin')}</p>
                    <p className="ig-offer-redeem-countdown" aria-label={t('discover', 'redeemTimeLeftAria')}>
                      {t('discover', 'redeemTimeLeft').replace('{time}', formatCountdownMs(checkoutRemainingMs))}
                    </p>
                    <button
                      type="button"
                      className="ig-offer-redeem-finish-btn"
                      onClick={() => setCheckoutWindowEnd(null)}
                    >
                      {t('discover', 'redeemFinish')}
                    </button>
                  </div>
                )}
              </div>
            ) : user ? (
              <form className="ig-offer-redeem-form" onSubmit={handleRedeem}>
                <label className="ig-offer-redeem-label">
                  <span className="ig-offer-sr-only">{t('discover', 'redeemPlaceholder')}</span>
                  <input
                    className="ig-offer-redeem-input"
                    type="text"
                    name="coupon-code"
                    autoComplete="off"
                    placeholder={t('discover', 'redeemPlaceholder')}
                    value={codeInput}
                    onChange={(ev) => setCodeInput(ev.target.value)}
                    maxLength={64}
                    disabled={redeemBusy}
                  />
                </label>
                <button type="submit" className="ig-offer-redeem-btn" disabled={redeemBusy}>
                  {redeemBusy ? t('discover', 'redeemProcessing') : t('discover', 'redeemSubmit')}
                </button>
                {redeemError && (
                  <p className="ig-offer-redeem-error" role="alert">
                    {redeemError}
                  </p>
                )}
              </form>
            ) : (
              <p className="ig-offer-redeem-signin">
                <Link to="/login" className="ig-offer-redeem-signin-link">
                  {t('discover', 'redeemSignIn')}
                </Link>
              </p>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
