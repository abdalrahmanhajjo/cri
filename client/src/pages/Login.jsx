import { useState } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import Icon from '../components/Icon';
import './Auth.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  /** 'error' | 'verify-info' — unverified login after SMTP delivered a new code */
  const [errorKind, setErrorKind] = useState('error');
  /** After API says email not verified — show button to open code entry page */
  const [showVerifyCodeCta, setShowVerifyCodeCta] = useState(false);
  /** When login used username, API returns real email for the verify link */
  const [verifyEmailTarget, setVerifyEmailTarget] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const rawFrom = location.state?.from || searchParams.get('redirect') || '/';
  const from = typeof rawFrom === 'string' && rawFrom.startsWith('/') && !rawFrom.startsWith('//') ? rawFrom : '/';

  const showFieldError = Boolean(error && errorKind === 'error');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setErrorKind('error');
    setShowVerifyCodeCta(false);
    setVerifyEmailTarget('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      showToast(t('feedback', 'signedIn'), 'success');
      navigate(from, { replace: true });
    } catch (err) {
      const errCode = err?.data?.code;
      const delivered = err?.data?.verificationEmailDelivered === true;
      if (errCode === 'EMAIL_NOT_VERIFIED' && delivered) {
        setErrorKind('verify-info');
      } else {
        setErrorKind('error');
      }
      setShowVerifyCodeCta(errCode === 'EMAIL_NOT_VERIFIED');
      if (errCode === 'EMAIL_NOT_VERIFIED' && typeof err?.data?.verificationEmail === 'string') {
        setVerifyEmailTarget(err.data.verificationEmail);
      }
      const msg = err.message || t('feedback', 'loginFailed');
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-wrap">
        <div className="auth-brand">
          <div className="auth-brand-icon" aria-hidden="true">
            <Icon name="lock" size={28} />
          </div>
          <h1 className="auth-brand-title">Visit Tripoli</h1>
          <p className="auth-brand-sub">Sign in to your account</p>
        </div>

        <div className="auth-card card">
          <h2 className="auth-title">Log in</h2>
          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            {error && (
              <div
                id="login-error"
                className={`auth-error ${errorKind === 'verify-info' ? 'auth-error--info' : ''}`}
                role="alert"
              >
                <div>{error}</div>
              </div>
            )}

            <div className="auth-field">
              <label htmlFor="login-email" className="auth-label">
                Email or username
              </label>
              <div className="auth-input-wrap">
                <Icon name="mail" className="auth-input-icon" size={22} />
                <input
                  id="login-email"
                  type="text"
                  className={`auth-input ${showFieldError ? 'auth-input--error' : ''}`}
                  placeholder="you@example.com or your_handle"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError('');
                    setErrorKind('error');
                    setShowVerifyCodeCta(false);
                    setVerifyEmailTarget('');
                  }}
                  required
                  autoComplete="username"
                  autoCapitalize="off"
                  autoCorrect="off"
                  aria-invalid={showFieldError}
                  aria-describedby={error ? 'login-error' : undefined}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="login-password" className="auth-label">
                Password
              </label>
              <div className="auth-input-wrap">
                <Icon name="key" className="auth-input-icon" size={22} />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className={`auth-input ${showFieldError ? 'auth-input--error' : ''}`}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                    setErrorKind('error');
                    setShowVerifyCodeCta(false);
                    setVerifyEmailTarget('');
                  }}
                  required
                  autoComplete="current-password"
                  aria-invalid={showFieldError}
                  aria-describedby={error ? 'login-error' : undefined}
                  disabled={loading}
                />
                <button
                  type="button"
                  className="auth-toggle-password"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  <Icon name={showPassword ? 'visibility_off' : 'visibility'} size={22} />
                </button>
              </div>
            </div>

            <div className="auth-actions">
              <Link to="/forgot-password" className="auth-link">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              className="btn-primary auth-submit"
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {showVerifyCodeCta && (
            <button
              type="button"
              className="btn-outline auth-submit auth-verify-code-btn"
              onClick={() => {
                const verifyAddr = verifyEmailTarget || email.trim();
                navigate(`/verify-email?email=${encodeURIComponent(verifyAddr)}`);
              }}
            >
              Enter 6-digit verification code
            </button>
          )}

          <p className="auth-footer">
            Don’t have an account? <Link to="/register">Sign up</Link>
          </p>
          <p className="auth-footer-note">
            <Link to="/verify-email">Open the verification code page</Link>
            {' — '}
            <span className="auth-footer-note-path">/verify-email</span>
          </p>
        </div>

        <div className="auth-secure-note" role="status">
          <Icon name="verified_user" size={20} />
          <span>Your connection is secure. We never share your data.</span>
        </div>
      </div>
    </div>
  );
}
