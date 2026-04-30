import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import Icon from '../components/Icon';
import './css/Auth.css';

export default function VerifyEmail() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [noSmtpHint, setNoSmtpHint] = useState(false);
  const { applySession } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const e = searchParams.get('email');
    if (e) setEmail(e.trim());
    setNoSmtpHint(searchParams.get('nosmtp') === '1');
  }, [searchParams]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const trimmed = email.trim();
    const digits = code.trim().replace(/\s/g, '');
    if (!trimmed || digits.length !== 6) {
      setError('Enter your email and the 6-digit code from your inbox.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.auth.verifyEmail(trimmed, digits);
      applySession(res);
      const welcomeName = res?.user?.name || trimmed.split('@')[0] || '';
      try {
        sessionStorage.setItem(
          'tripoli-welcome-after-verify',
          JSON.stringify({
            name: welcomeName,
            welcomeEmailSent: res?.welcomeEmailDelivered === true,
            at: Date.now(),
          })
        );
      } catch {
        /* ignore quota / private mode */
      }
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Verification failed. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-wrap">
        <div className="auth-brand">
          <div className="auth-brand-icon" aria-hidden="true">
            <Icon name="mark_email_read" size={28} />
          </div>
          <h1 className="auth-brand-title">Visit Tripoli</h1>
          <p className="auth-brand-sub">{t('authPage', 'verifyEmailSub')}</p>
        </div>

        <div className="auth-card card">
          <h2 className="auth-title">{t('authPage', 'verifyEmailTitle')}</h2>
          {noSmtpHint ? (
            <div className="auth-error auth-error--info" role="status" style={{ marginBottom: 16 }}>
              Outgoing mail may not be configured on this server. Your 6-digit code was printed in the API server log —
              enter it below. Or ask an administrator to set SMTP in the API{' '}
              <code className="auth-code-inline">.env</code> so codes are delivered to your inbox.
            </div>
          ) : null}
          <p className="auth-verify-lead">
            {t('authPage', 'verifyLead')}
          </p>
          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            {error && (
              <div className="auth-error" role="alert">
                {error}
              </div>
            )}

            <div className="auth-field">
              <label htmlFor="verify-email" className="auth-label">
                {t('authPage', 'emailLabel')}
              </label>
              <div className="auth-input-wrap">
                <Icon name="mail" className="auth-input-icon" size={22} />
                <input
                  id="verify-email"
                  type="email"
                  className={`auth-input ${error ? 'auth-input--error' : ''}`}
                  placeholder={t('authPage', 'emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="verify-code" className="auth-label">
                {t('authPage', 'verifyCodeLabel')}
              </label>
              <div className="auth-input-wrap">
                <Icon name="confirmation_number" className="auth-input-icon" size={22} />
                <input
                  id="verify-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  className={`auth-input ${error ? 'auth-input--error' : ''}`}
                  placeholder={t('authPage', 'verifyCodePlaceholder')}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  autoComplete="one-time-code"
                  disabled={loading}
                />
              </div>
            </div>

            <button type="submit" className="btn-primary auth-submit" disabled={loading} aria-busy={loading}>
               {loading ? t('authPage', 'verifying') : t('authPage', 'verifyBtnLong')}
            </button>
          </form>

          <p className="auth-footer">
             <Link to="/login">{t('authPage', 'backToLogin')}</Link>
            {' · '}
             <Link to="/forgot-password">{t('authPage', 'forgotPassword')}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
