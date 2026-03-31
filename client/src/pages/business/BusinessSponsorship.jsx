import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import api from '../../api/client';
import { useLanguage } from '../../context/LanguageContext';
import { mergeBusinessPortal } from '../../config/siteSettingsDefaults';
import './BusinessSponsorship.css';

function formatMoney(cents, currency, lang) {
  const cur = String(currency || 'usd').toUpperCase();
  const locale = lang === 'ar' ? 'ar-LB' : lang === 'fr' ? 'fr-FR' : 'en-US';
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: cur }).format((Number(cents) || 0) / 100);
  } catch {
    return `${(Number(cents) || 0) / 100} ${cur}`;
  }
}

export default function BusinessSponsorship() {
  const { t, lang } = useLanguage();
  const ctx = useOutletContext();
  const data = ctx?.me;
  const refreshMe = ctx?.refreshMe;
  const portal = mergeBusinessPortal(ctx?.businessPortal);
  const [cfg, setCfg] = useState(null);
  const [cfgErr, setCfgErr] = useState(null);
  const [placeId, setPlaceId] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    document.title = `${t('business', 'sponsorshipTitle')} · Business — Visit Tripoli`;
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    api.business.sponsorship
      .config()
      .then((c) => {
        if (!cancelled) {
          setCfg(c);
          setCfgErr(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setCfgErr(e.message || 'Config failed');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const places = data?.places || [];

  const priceLine = useMemo(() => {
    if (!cfg) return '';
    const amount = formatMoney(cfg.sponsorshipAmountCents, cfg.sponsorshipCurrency, lang);
    return t('business', 'sponsorshipPriceLine').replace('{amount}', amount);
  }, [cfg, lang, t]);

  const durationLine = useMemo(() => {
    if (!cfg) return '';
    return t('business', 'sponsorshipDuration').replace('{days}', String(cfg.sponsorshipDurationDays ?? 30));
  }, [cfg, t]);

  useEffect(() => {
    if (!placeId && places.length === 1) setPlaceId(places[0].id);
  }, [places, placeId]);

  const startCheckout = async () => {
    setErr(null);
    if (!placeId) {
      setErr(t('business', 'sponsorshipPickPlace'));
      return;
    }
    const origin = window.location.origin;
    const successUrl = `${origin}/business/sponsorship/success`;
    const cancelUrl = `${origin}/business/sponsorship`;
    setBusy(true);
    try {
      const { url } = await api.business.sponsorship.createCheckoutSession({
        placeId,
        successUrl,
        cancelUrl,
      });
      if (url) window.location.assign(url);
      else setErr(t('business', 'sponsorshipCheckoutError'));
    } catch (e) {
      const st = e?.status;
      const msg = String(e?.message || '');
      if (st === 403 || msg.toLowerCase().includes('disabled')) setErr(t('business', 'sponsorshipDisabled'));
      else if (st === 503 || msg.toLowerCase().includes('not configured')) setErr(t('business', 'sponsorshipNotConfigured'));
      else if (st === 409 || msg.includes('curated') || msg.includes('active')) setErr(t('business', 'sponsorshipConflict'));
      else setErr(msg || t('business', 'sponsorshipCheckoutError'));
    } finally {
      setBusy(false);
    }
  };

  const canPay =
    cfg?.sponsorshipEnabled &&
    cfg?.paymentsReady &&
    placeId &&
    !cfgErr;

  if (portal.sections?.sponsorship === false) {
    return (
      <div className="biz-sponsored">
        <div className="biz-sponsored-card" style={{ maxWidth: 520 }}>
          <p className="biz-sponsored-muted" style={{ fontSize: '1rem', color: 'inherit', marginBottom: '1rem' }}>
            Sponsored placement self-checkout is turned off in site settings. Your administrator can still feature venues
            from the main admin console.
          </p>
          <Link to="/business" className="biz-sponsored-link">
            {t('business', 'backToDashboard')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="biz-sponsored">
      <header className="biz-sponsored-head">
        <p className="biz-sponsored-kicker">Business</p>
        <h1 className="biz-sponsored-title">{t('business', 'sponsorshipTitle')}</h1>
        <p className="biz-sponsored-lead">{t('business', 'sponsorshipLead')}</p>
      </header>

      {ctx?.loadErr ? <p className="biz-sponsored-error">{ctx.loadErr}</p> : null}
      {!data && !ctx?.loadErr && <p className="biz-sponsored-muted">Loading…</p>}

      {data && places.length === 0 && (
        <div className="biz-sponsored-card">
          <p>{t('business', 'sponsorshipNoPlaces')}</p>
          <Link to="/business" className="biz-sponsored-link">
            {t('business', 'backToDashboard')}
          </Link>
        </div>
      )}

      {data && places.length > 0 && (
        <>
          <div className="biz-sponsored-card">
            <label className="biz-sponsored-label" htmlFor="biz-sp-place">
              {t('business', 'sponsorshipPickPlace')}
            </label>
            <select
              id="biz-sp-place"
              className="biz-sponsored-select"
              value={placeId}
              onChange={(e) => setPlaceId(e.target.value)}
            >
              <option value="">—</option>
              {places.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name || p.id}
                </option>
              ))}
            </select>

            {cfg && (
              <ul className="biz-sponsored-meta">
                <li>{durationLine}</li>
                {!cfg.stripePriceConfigured ? <li>{priceLine}</li> : <li>{t('business', 'sponsorshipPriceLine').replace('{amount}', 'Stripe Price')}</li>}
              </ul>
            )}

            {cfgErr && <p className="biz-sponsored-error">{cfgErr}</p>}
            {cfg && !cfg.sponsorshipEnabled && (
              <p className="biz-sponsored-warn">{t('business', 'sponsorshipDisabled')}</p>
            )}
            {cfg && cfg.sponsorshipEnabled && !cfg.paymentsReady && (
              <p className="biz-sponsored-warn">{t('business', 'sponsorshipNotConfigured')}</p>
            )}
            {err && <p className="biz-sponsored-error">{err}</p>}

            <div className="biz-sponsored-actions">
              <button type="button" className="biz-sponsored-btn" disabled={!canPay || busy} onClick={startCheckout}>
                {busy ? '…' : t('business', 'sponsorshipPayCta')}
              </button>
              <button
                type="button"
                className="biz-sponsored-btn biz-sponsored-btn--ghost"
                disabled={busy}
                onClick={() => refreshMe?.()}
              >
                Refresh places
              </button>
            </div>
          </div>

          <p className="biz-sponsored-footnote">
            After payment, placement is created automatically. Rank for paid slots defaults high (e.g. 500) so editorial picks can stay above unless admins reorder.
          </p>
        </>
      )}
    </div>
  );
}
