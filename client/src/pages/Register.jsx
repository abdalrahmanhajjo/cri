import { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import api from '../api/client';
import Icon from '../components/Icon';
import {
  checkPasswordRequirements,
  PASSWORD_REQUIREMENTS,
} from '../utils/passwordRequirements';
import {
  checkUsernameRequirements,
  USERNAME_REQUIREMENTS,
} from '../utils/usernameRequirements';
import './css/Auth.css';

export default function Register() {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  /** idle | checking | available | taken — username handle availability vs DB */
  const [usernameAvailability, setUsernameAvailability] = useState('idle');
  const usernameInputRef = useRef(null);
  const usernameCheckGenRef = useRef(0);
  const { register } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const requirements = useMemo(
    () => checkPasswordRequirements(password),
    [password]
  );
  const usernameReqs = useMemo(
    () => checkUsernameRequirements(username),
    [username]
  );
  const usernameFormatOk =
    usernameReqs.minLength &&
    usernameReqs.maxLength &&
    usernameReqs.format &&
    usernameReqs.notReserved;

  useEffect(() => {
    if (!usernameFormatOk) {
      setUsernameAvailability('idle');
      return;
    }

    usernameCheckGenRef.current += 1;
    const gen = usernameCheckGenRef.current;
    setUsernameAvailability('checking');
    const t = setTimeout(async () => {
      try {
        const r = await api.auth.checkUsername(username.trim());
        if (gen !== usernameCheckGenRef.current) return;
        if (!r.validFormat) {
          setUsernameAvailability('invalid');
          return;
        }
        setUsernameAvailability(r.available ? 'available' : 'taken');
        if (!r.available && usernameInputRef.current) {
          usernameInputRef.current.focus();
          usernameInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } catch {
        if (gen === usernameCheckGenRef.current) setUsernameAvailability('error');
      }
    }, 450);

    return () => {
      clearTimeout(t);
      usernameCheckGenRef.current += 1;
    };
  }, [username, usernameFormatOk]);

  const passwordsMatch =
    password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;
  const confirmMismatch =
    confirmPassword.length > 0 && password !== confirmPassword;
  const usernameReady = usernameFormatOk && usernameAvailability === 'available';
  const canSubmit =
    name.trim() &&
    username.trim() &&
    email.trim() &&
    password &&
    confirmPassword &&
    passwordsMatch &&
    usernameReady &&
    requirements.minLength &&
    requirements.uppercase &&
    requirements.lowercase &&
    requirements.number &&
    requirements.special &&
    requirements.noRepeated;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!canSubmit) return;
    setLoading(true);
    try {
      const result = await register(
        name.trim() || undefined,
        username.trim(),
        email.trim(),
        password
      );
      const q = new URLSearchParams();
      q.set('email', email.trim());
      if (result?.verificationEmailDelivered === false) q.set('nosmtp', '1');
      showToast(t('feedback', 'registerCheckEmail'), 'success');
      navigate(`/verify-email?${q.toString()}`, { replace: true });
    } catch (err) {
      const msg = err.message || 'Registration failed. Please try again.';
      setError(msg);
      showToast(msg, 'error');
      if (/username.*taken|already taken/i.test(msg) && usernameInputRef.current) {
        setUsernameAvailability('taken');
        usernameInputRef.current.focus();
      }
    } finally {
      setLoading(false);
    }
  }

  const usernameTaken = usernameFormatOk && usernameAvailability === 'taken';
  const usernameChecking = usernameFormatOk && usernameAvailability === 'checking';

  return (
    <div className="auth-page">
      <div className="auth-wrap">
        <div className="auth-brand">
          <div className="auth-brand-icon" aria-hidden="true">
            <Icon name="person_add" size={28} />
          </div>
          <h1 className="auth-brand-title">Visit Tripoli</h1>
          <p className="auth-brand-sub">Create your account</p>
        </div>

        <div className="auth-card card">
          <h2 className="auth-title">Sign up</h2>
          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            {error && (
              <div id="register-error" className="auth-error" role="alert">
                {error}
              </div>
            )}

            <div className="auth-field">
              <label htmlFor="register-name" className="auth-label">
                Full name
              </label>
              <div className="auth-input-wrap">
                <Icon name="person" className="auth-input-icon" size={22} />
                <input
                  id="register-name"
                  type="text"
                  className={`auth-input ${error ? 'auth-input--error' : ''}`}
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  autoCapitalize="words"
                  aria-invalid={!!error}
                  aria-describedby={error ? 'register-error' : undefined}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="register-username" className="auth-label">
                Username
              </label>
              <div className="auth-input-wrap">
                <Icon name="alternate_email" className="auth-input-icon" size={22} />
                <input
                  ref={usernameInputRef}
                  id="register-username"
                  type="text"
                  className={`auth-input ${usernameTaken || error ? 'auth-input--error' : ''}`}
                  placeholder="your_handle"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError('');
                  }}
                  autoComplete="username"
                  autoCapitalize="off"
                  spellCheck={false}
                  aria-invalid={usernameTaken || !!error}
                  aria-describedby="register-username-requirements register-username-status register-error"
                  disabled={loading}
                />
              </div>
              <div id="register-username-requirements" className="auth-requirements" aria-live="polite">
                <p className="auth-requirements-title">Username must:</p>
                {USERNAME_REQUIREMENTS.map(({ key, label }) => (
                  <p
                    key={key}
                    className={`auth-requirement ${usernameReqs[key] ? 'auth-requirement--met' : ''}`}
                  >
                    <Icon
                      name={usernameReqs[key] ? 'check_circle' : 'radio_button_unchecked'}
                      className="auth-requirement-icon"
                      size={16}
                    />
                    {label}
                  </p>
                ))}
              </div>
              <p id="register-username-status" className="auth-requirement" role="status" style={{ marginTop: 8 }}>
                {usernameChecking && (
                  <>
                    <Icon name="hourglass_empty" className="auth-requirement-icon" size={16} />
                    Checking availability…
                  </>
                )}
                {usernameFormatOk && usernameAvailability === 'available' && (
                  <>
                    <Icon name="check_circle" className="auth-requirement-icon" size={16} style={{ color: 'var(--color-success)' }} />
                    This username is available
                  </>
                )}
                {usernameTaken && (
                  <>
                    <Icon name="error" className="auth-requirement-icon" size={16} style={{ color: 'var(--color-error)' }} />
                    This username is already taken — pick another handle before continuing.
                  </>
                )}
                {usernameFormatOk && usernameAvailability === 'error' && (
                  <>
                    <Icon name="error" className="auth-requirement-icon" size={16} style={{ color: 'var(--color-error)' }} />
                    Could not check this username. Check your connection and try changing the field slightly.
                  </>
                )}
              </p>
            </div>

            <div className="auth-field">
              <label htmlFor="register-email" className="auth-label">
                Email address
              </label>
              <div className="auth-input-wrap">
                <Icon name="mail" className="auth-input-icon" size={22} />
                <input
                  id="register-email"
                  type="email"
                  className={`auth-input ${error ? 'auth-input--error' : ''}`}
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoCapitalize="off"
                  inputMode="email"
                  aria-invalid={!!error}
                  aria-describedby={error ? 'register-error' : undefined}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="register-password" className="auth-label">
                Password
              </label>
              <div className="auth-input-wrap">
                <Icon name="key" className="auth-input-icon" size={22} />
                <input
                  id="register-password"
                  type={showPassword ? 'text' : 'password'}
                  className={`auth-input ${error ? 'auth-input--error' : ''}`}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  aria-invalid={!!error}
                  aria-describedby="register-requirements register-confirm-desc"
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
              <div id="register-requirements" className="auth-requirements" aria-live="polite">
                <p className="auth-requirements-title">Password must have:</p>
                {PASSWORD_REQUIREMENTS.map(({ key, label }) => (
                  <p
                    key={key}
                    className={`auth-requirement ${requirements[key] ? 'auth-requirement--met' : ''}`}
                  >
                    <Icon
                      name={requirements[key] ? 'check_circle' : 'radio_button_unchecked'}
                      className="auth-requirement-icon"
                      size={16}
                    />
                    {label}
                  </p>
                ))}
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="register-confirm" className="auth-label">
                Confirm password
              </label>
              <div className="auth-input-wrap">
                <Icon name="key" className="auth-input-icon" size={22} />
                <input
                  id="register-confirm"
                  type={showConfirm ? 'text' : 'password'}
                  className={`auth-input ${confirmMismatch ? 'auth-input--error' : ''}`}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  aria-invalid={confirmMismatch}
                  aria-describedby="register-confirm-desc"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="auth-toggle-password"
                  onClick={() => setShowConfirm((s) => !s)}
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  <Icon name={showConfirm ? 'visibility_off' : 'visibility'} size={22} />
                </button>
              </div>
              <p id="register-confirm-desc" className={`auth-requirement ${passwordsMatch ? 'auth-requirement--met' : ''}`} role="status">
                {confirmMismatch && (
                  <>
                    <Icon name="error" className="auth-requirement-icon" size={16} style={{ color: 'var(--color-error)' }} />
                    Passwords do not match
                  </>
                )}
                {passwordsMatch && password.length > 0 && !confirmMismatch && (
                  <>
                    <Icon name="check_circle" className="auth-requirement-icon" size={16} style={{ color: 'var(--color-success)' }} />
                    Passwords match
                  </>
                )}
                {!confirmMismatch && !passwordsMatch && <span aria-hidden="true">&nbsp;</span>}
              </p>
            </div>

            <button
              type="submit"
              className="btn-primary auth-submit"
              disabled={loading || !canSubmit}
              aria-busy={loading}
            >
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="auth-footer">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </div>

        <div className="auth-secure-note" role="status">
          <Icon name="verified_user" size={20} />
          <span>Your data is protected. We use encryption and never share your information.</span>
        </div>
      </div>
    </div>
  );
}
