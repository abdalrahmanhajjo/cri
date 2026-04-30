import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { FALLBACK_GOOGLE_WEB_CLIENT_ID } from '../config/googleSignIn';
import { readGoogleWebClientIdFromPage } from '../utils/googleWebClientId';
import { api } from '../api/client';
import Icon from '../components/Icon';
import './css/Auth.css';

/** @param {unknown} v */
function mapGoogleErrorMessage(err, v, t) {
  const code = err?.data?.code;
  if (code === 'GOOGLE_ACCOUNT_MISMATCH') return t('feedback', 'googleAccountMismatch');
  if (code === 'USE_PASSWORD_LOGIN') return t('feedback', 'googleUsePassword');
  if (code === 'GOOGLE_DISABLED') return t('feedback', 'googleNotConfigured');
  if (typeof v === 'string' && v.trim()) return v;
  return t('feedback', 'googleSignInFailed');
}

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
  const [googleLoading, setGoogleLoading] = useState(false);
  const googleBtnRef = useRef(null);
  const { login, loginWithGoogle } = useAuth();
  const { t, lang } = useLanguage();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const rawFrom = location.state?.from || searchParams.get('redirect') || '/';
  const from = typeof rawFrom === 'string' && rawFrom.startsWith('/') && !rawFrom.startsWith('//') ? rawFrom : '/';

  const googleClientIdBuild = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim?.() || '';
  const googleClientIdFallback = String(FALLBACK_GOOGLE_WEB_CLIENT_ID || '').trim();
  const googleClientIdFromPage = readGoogleWebClientIdFromPage();
  const googleClientIdImmediate =
    googleClientIdBuild || googleClientIdFallback || googleClientIdFromPage;
  const { loading: siteSettingsLoading, googleWebClientId: googleFromSiteSettings } = useSiteSettings();
  const [googleClientIdFromDedicated, setGoogleClientIdFromDedicated] = useState('');
  /** GET /api/auth/google-public-config finished (ok or error). Runs in parallel with site-settings. */
  const [dedicatedGoogleConfigDone, setDedicatedGoogleConfigDone] = useState(() =>
    Boolean(googleClientIdImmediate)
  );

  useEffect(() => {
    if (googleClientIdImmediate) return undefined;
    let cancelled = false;
    const safetyMs = 15000;
    const safety = window.setTimeout(() => {
      if (!cancelled) setDedicatedGoogleConfigDone(true);
    }, safetyMs);
    (async () => {
      try {
        const data = await api.auth.googlePublicConfig();
        const id = typeof data?.clientId === 'string' ? data.clientId.trim() : '';
        if (!cancelled && id) setGoogleClientIdFromDedicated(id);
      } catch {
        /* 404 if server not updated, CORS, etc. */
      } finally {
        window.clearTimeout(safety);
        if (!cancelled) setDedicatedGoogleConfigDone(true);
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(safety);
    };
  }, [googleClientIdImmediate]);

  const googleClientId =
    googleClientIdImmediate || googleFromSiteSettings || googleClientIdFromDedicated;
  /** Wait for site-settings + dedicated endpoint so we never show an empty gap above "OR". */
  const googleClientIdResolved =
    Boolean(googleClientIdImmediate) ||
    (!siteSettingsLoading && dedicatedGoogleConfigDone);

  /** GIS load / render — shown under the button so users know what failed */
  const [googleGsiFeedback, setGoogleGsiFeedback] = useState('');

  useEffect(() => {
    setGoogleGsiFeedback('');
  }, [googleClientId]);

  useEffect(() => {
    if (!googleClientId || !googleClientIdResolved) return undefined;
    const checkMs = 6500;
    const timer = window.setTimeout(() => {
      const host = googleBtnRef.current;
      if (!host || host.childElementCount > 0) return;
      setGoogleGsiFeedback((prev) => prev || t('feedback', 'googleButtonDidNotRender'));
    }, checkMs);
    return () => window.clearTimeout(timer);
  }, [googleClientId, googleClientIdResolved, t]);

  const handleGoogleCredentialRef = useRef(
    /** @param {{ credential?: string }} response */
    (_response) => {}
  );

  const handleGoogleCredential = useCallback(
    async (response) => {
      const cred = response?.credential;
      if (!cred) return;
      setGoogleLoading(true);
      setError('');
      setErrorKind('error');
      setShowVerifyCodeCta(false);
      setVerifyEmailTarget('');
      try {
        await loginWithGoogle(cred);
        showToast(t('feedback', 'signedIn'), 'success');
        navigate(from, { replace: true });
      } catch (err) {
        const msg = mapGoogleErrorMessage(err, err?.data?.error || err?.message, t);
        setErrorKind('error');
        setError(msg);
        showToast(msg, 'error');
      } finally {
        setGoogleLoading(false);
      }
    },
    [from, loginWithGoogle, navigate, showToast, t]
  );

  handleGoogleCredentialRef.current = handleGoogleCredential;

  useEffect(() => {
    if (!googleClientId || !googleBtnRef.current) return undefined;

    let cancelled = false;

    const initGsi = () => {
      if (cancelled || !googleBtnRef.current || !window.google?.accounts?.id) return;
      const el = googleBtnRef.current;
      el.innerHTML = '';
      try {
        window.google.accounts.id.cancel();
      } catch (_) {
        /* ignore */
      }
      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: (res) => handleGoogleCredentialRef.current(res),
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        const rect = el.getBoundingClientRect();
        const vw =
          typeof window !== 'undefined' && window.innerWidth
            ? window.innerWidth
            : 400;
        const fromRect = rect.width > 48 ? Math.floor(rect.width) : 0;
        const fallback = Math.floor(vw - 24);
        const w = Math.min(400, Math.max(240, fromRect || fallback));
        window.google.accounts.id.renderButton(el, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          width: w,
          locale: lang === 'ar' ? 'ar' : lang === 'fr' ? 'fr' : 'en',
        });
      } catch (e) {
        console.error(e);
        setGoogleGsiFeedback(t('feedback', 'googleGsiInitFailed'));
      }
    };

    const existing = document.querySelector('script[data-tripoli-gsi="1"]');
    const runWhenLaidOut = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(initGsi);
      });
    };

    if (window.google?.accounts?.id) {
      runWhenLaidOut();
    } else if (existing) {
      existing.addEventListener('load', runWhenLaidOut, { once: true });
    } else {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.dataset.tripoliGsi = '1';
      script.onload = runWhenLaidOut;
      script.onerror = () => setGoogleGsiFeedback(t('feedback', 'googleGsiScriptBlocked'));
      document.head.appendChild(script);
    }

    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (cancelled || !googleClientId || !googleBtnRef.current) return;
        runWhenLaidOut();
      }, 250);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelled = true;
      window.clearTimeout(resizeTimer);
      window.removeEventListener('resize', onResize);
      try {
        window.google?.accounts?.id?.cancel();
      } catch (_) {
        /* ignore */
      }
      if (googleBtnRef.current) googleBtnRef.current.innerHTML = '';
    };
  }, [googleClientId, lang, t]);

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
    <div className="auth-page auth-page--login">
      <div className="auth-login-shell">
        <aside className="auth-login-aside" aria-hidden="true">
          <div className="auth-login-aside-inner">
            <p className="auth-login-aside-kicker">Visit Tripoli</p>
            <h1 className="auth-login-aside-title">{t('authPage', 'loginHeroTitle')}</h1>
            <p className="auth-login-aside-sub">{t('authPage', 'loginHeroSub')}</p>
            <ul className="auth-login-aside-points">
              <li>
                <Icon name="place" size={18} ariaHidden />
                <span>{t('nav', 'myFavourites')}</span>
              </li>
              <li>
                <Icon name="calendar_today" size={18} ariaHidden />
                <span>{t('nav', 'myTrips')}</span>
              </li>
              <li>
                <Icon name="users" size={18} ariaHidden />
                <span>{t('nav', 'communityFeed')}</span>
              </li>
            </ul>
          </div>
        </aside>

        <div className="auth-login-main">
          <div className="auth-wrap">
            <div className="auth-brand auth-brand--compact">
              <div className="auth-brand-icon" aria-hidden="true">
                <Icon name="lock" size={28} />
              </div>
              <h2 className="auth-brand-title">{t('nav', 'visitTripoli')}</h2>
              <p className="auth-brand-sub">{t('nav', 'signIn')}</p>
            </div>

            <div className="auth-card card">
              <h3 className="auth-title">{t('nav', 'signIn')}</h3>

              {googleClientId ? (
                <div className="auth-google-block">
                  <div
                    ref={googleBtnRef}
                    className={`auth-google-btn-host${googleLoading ? ' auth-google-btn-host--busy' : ''}`}
                  />
                  {googleLoading ? (
                    <p className="auth-google-status" role="status">
                      {t('authPage', 'googleLoading')}
                    </p>
                  ) : null}
                  {googleGsiFeedback ? (
                    <p className="auth-google-missing" role="alert">
                      {googleGsiFeedback}
                    </p>
                  ) : null}
                </div>
              ) : googleClientIdResolved ? (
                <div className="auth-google-missing-wrap">
                  <p className="auth-google-missing" role="note">
                    {t('feedback', 'googleUnavailable')}
                  </p>
                  <p className="auth-google-missing-hint" role="note">
                    {t('feedback', 'googleUnavailableHint')}
                  </p>
                </div>
              ) : (
                <p className="auth-google-status" role="status">
                  {t('authPage', 'googleLoading')}
                </p>
              )}

              <div className="auth-divider" role="separator">
                <span>{t('authPage', 'loginDividerOr')}</span>
              </div>

              <p className="auth-section-label">{t('authPage', 'emailPasswordSection')}</p>

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
                    {t('authPage', 'emailLabel')}
                  </label>
                  <div className="auth-input-wrap">
                    <Icon name="mail" className="auth-input-icon" size={22} />
                    <input
                      id="login-email"
                      type="text"
                      className={`auth-input ${showFieldError ? 'auth-input--error' : ''}`}
                      placeholder={t('authPage', 'emailPlaceholder')}
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
                      disabled={loading || googleLoading}
                    />
                  </div>
                </div>

                <div className="auth-field">
                  <label htmlFor="login-password" className="auth-label">
                    {t('authPage', 'passwordLabel')}
                  </label>
                  <div className="auth-input-wrap">
                    <Icon name="key" className="auth-input-icon" size={22} />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      className={`auth-input ${showFieldError ? 'auth-input--error' : ''}`}
                      placeholder={t('authPage', 'passwordPlaceholder')}
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
                      disabled={loading || googleLoading}
                    />
                    <button
                      type="button"
                      className="auth-toggle-password"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? t('authPage', 'hidePassword') : t('authPage', 'showPassword')}
                      tabIndex={-1}
                    >
                      <Icon name={showPassword ? 'visibility_off' : 'visibility'} size={22} />
                    </button>
                  </div>
                </div>

                <div className="auth-actions">
                  <Link to="/forgot-password" className="auth-link">
                    {t('authPage', 'forgotPassword')}
                  </Link>
                </div>

                <button
                  type="submit"
                  className="btn-primary auth-submit"
                  disabled={loading || googleLoading}
                  aria-busy={loading}
                >
                  {loading ? t('authPage', 'signingIn') : t('authPage', 'signInBtn')}
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
                  {t('authPage', 'enterVerifyCode')}
                </button>
              )}

              <p className="auth-footer">
                {t('authPage', 'dontHaveAccount')} <Link to="/register">{t('authPage', 'signUpLink')}</Link>
              </p>
              <p className="auth-footer-note">
                <Link to="/verify-email">{t('authPage', 'openVerifyPage')}</Link>
                {' — '}
                <span className="auth-footer-note-path">/verify-email</span>
              </p>
            </div>

            <div className="auth-secure-note" role="status">
              <Icon name="verified_user" size={20} />
              <span>{t('authPage', 'secureNote')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
