import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../api/client';
import { useLanguage } from '../../context/LanguageContext';
import './css/BusinessSponsorship.css';

export default function BusinessSponsorshipSuccess() {
  const { t } = useLanguage();
  const [params] = useSearchParams();
  const sessionId = params.get('session_id') || '';
  const [status, setStatus] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    document.title = `${t('business', 'successTitle')} · Business — Visit Tripoli`;
  }, [t]);

  useEffect(() => {
    if (!sessionId) {
      setErr('Missing session');
      return;
    }
    let cancelled = false;
    api.business.sponsorship
      .sessionStatus(sessionId)
      .then((r) => {
        if (!cancelled) {
          setStatus(r);
          setErr(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setErr(e.message || 'Could not load session');
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const message = (() => {
    if (err) return err;
    if (!status) return '…';
    if (status.status === 'active' && status.endsAt) {
      const d = new Date(status.endsAt);
      const fmt = d.toLocaleString();
      return t('business', 'successActive').replace('{date}', fmt);
    }
    if (status.status === 'pending') return t('business', 'successPending');
    return t('business', 'successUnknown');
  })();

  return (
    <div className="biz-sponsored biz-sponsored--success">
      <h1 className="biz-sponsored-title">{t('business', 'successTitle')}</h1>
      <p className="biz-sponsored-lead">{message}</p>
      {status?.placeName ? (
        <p className="biz-sponsored-muted">
          <strong>{status.placeName}</strong>
        </p>
      ) : null}
      <Link to="/business" className="biz-sponsored-link">
        {t('business', 'backToDashboard')}
      </Link>
    </div>
  );
}
