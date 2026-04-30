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
          <p className="auth-brand-sub">Enter the code we emailed you</p>
        </div>

        <div className="auth-card card">
          <h2 className="auth-title">Verify email</h2>
          {noSmtpHint ? (
            <div className="auth-error auth-error--info" role="status" style={{ marginBottom: 16 }}>
              Outgoing mail may not be configured on this server. Your 6-digit code was printed in the API server log —
              enter it below. Or ask an administrator to set SMTP in the API{' '}
              <code className="auth-code-inline">.env</code> so codes are delivered to your inbox.
            </div>
          ) : null}
          <p className="auth-verify-lead">
            New accounts must verify this email before you can sign in and use the site. Use the 6-digit code from your
            inbox (or the Tripoli app). You can return here anytime from <strong>Log in</strong> (“Enter 6-digit
            verification code”) or <code className="auth-code-inline">/verify-email</code>.
          </p>
          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            {error && (
              <div className="auth-error" role="alert">
                {error}
              </div>
            )}

            <div className="auth-field">
              <label htmlFor="verify-email" className="auth-label">
                Email address
              </label>
              <div className="auth-input-wrap">
                <Icon name="mail" className="auth-input-icon" size={22} />
                <input
                  id="verify-email"
                  type="email"
                  className={`auth-input ${error ? 'auth-input--error' : ''}`}
                  placeholder="you@example.com"
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
                6-digit code
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
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  autoComplete="one-time-code"
                  disabled={loading}
                />
              </div>
            </div>

            <button type="submit" className="btn-primary auth-submit" disabled={loading} aria-busy={loading}>
              {loading ? 'Verifying…' : 'Verify and continue'}
            </button>
          </form>

          <p className="auth-footer">
            <Link to="/login">Back to sign in</Link>
            {' · '}
            <Link to="/forgot-password">Forgot password</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
