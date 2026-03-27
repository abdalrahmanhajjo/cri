import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import Icon from '../components/Icon';
import {
  checkPasswordRequirements,
  PASSWORD_REQUIREMENTS,
  isPasswordValid,
} from '../utils/passwordRequirements';
import './Auth.css';

export default function ForgotPassword() {
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState('');
  /** False when server did not confirm email delivery */
  const [resetEmailDelivered, setResetEmailDelivered] = useState(true);
  const [loading, setLoading] = useState(false);

  const passwordReqs = useMemo(() => checkPasswordRequirements(newPassword), [newPassword]);
  const newPasswordValid = isPasswordValid(newPassword);
  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;
  const canReset = code.trim().length === 6 && newPasswordValid && passwordsMatch;

  async function handleSendCode(e) {
    if (e?.preventDefault) e.preventDefault();
    setError('');
    const trimmed = email.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      const res = await api.auth.forgotPassword(trimmed);
      setEmail(trimmed);
      setResetEmailDelivered(res.emailDelivered !== false);
      setCode('');
      setStep('reset');
    } catch (err) {
      const retryAfter = Number(err?.data?.retryAfter);
      if (Number.isFinite(retryAfter) && retryAfter > 0) {
        setError(`${err.message || 'Too many requests.'} Try again in ${Math.ceil(retryAfter / 60)} minute(s).`);
      } else {
        setError(err.message || 'Failed to send code. Try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    setError('');
    if (!canReset) return;
    setLoading(true);
    try {
      await api.auth.resetPassword(email, code.trim(), newPassword);
      setStep('success');
    } catch (err) {
      const retryAfter = Number(err?.data?.retryAfter);
      if (Number.isFinite(retryAfter) && retryAfter > 0) {
        setError(`${err.message || 'Too many attempts.'} Try again in ${Math.ceil(retryAfter / 60)} minute(s).`);
      } else {
        setError(err.message || 'Failed to reset password. Check the code and try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  if (step === 'success') {
    return (
      <div className="auth-page">
        <div className="auth-wrap">
          <div className="auth-brand">
            <div className="auth-brand-icon" aria-hidden="true">
              <Icon name="check_circle" size={28} />
            </div>
            <h1 className="auth-brand-title">Password reset</h1>
            <p className="auth-brand-sub">You can now sign in with your new password.</p>
          </div>
          <div className="auth-card card">
            <p className="auth-footer" style={{ marginTop: 0, textAlign: 'center' }}>
              Your password has been updated successfully.
            </p>
            <Link to="/login" className="btn-primary auth-submit" style={{ display: 'block', textAlign: 'center', marginTop: 20 }}>
              Back to Log in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'reset') {
    return (
      <div className="auth-page">
        <div className="auth-wrap">
          <div className="auth-brand">
            <div className="auth-brand-icon" aria-hidden="true">
              <Icon name="lock" size={28} />
            </div>
            <h1 className="auth-brand-title">Reset password</h1>
            <p className="auth-brand-sub">
              {resetEmailDelivered
                ? `Enter the 6-digit code we sent to ${email}`
                : 'Email could not be sent from this server. If you are the site operator, check the API server log for the code; otherwise ask an administrator to configure SMTP.'}
            </p>
          </div>
          <div className="auth-card card">
            {!resetEmailDelivered && (
              <div className="auth-error auth-error--info" role="status">
                We could not deliver the code to your inbox. The code is never shown on this page for security. Check
                the API server log (development) or ask your administrator to configure outgoing mail (SMTP).
              </div>
            )}
            <h2 className="auth-title">New password</h2>
            <form onSubmit={handleResetPassword} className="auth-form" noValidate>
              {error && (
                <div className="auth-error" role="alert">
                  {error}
                </div>
              )}

              <div className="auth-field">
                <label htmlFor="forgot-code" className="auth-label">Code</label>
                <div className="auth-input-wrap">
                  <Icon name="confirmation_number" className="auth-input-icon" size={22} />
                  <input
                    id="forgot-code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    className="auth-input"
                    placeholder="000000"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    autoComplete="one-time-code"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="auth-field">
                <label htmlFor="forgot-new-password" className="auth-label">New password</label>
                <div className="auth-input-wrap">
                  <Icon name="key" className="auth-input-icon" size={22} />
                  <input
                    id="forgot-new-password"
                    type={showNew ? 'text' : 'password'}
                    className="auth-input"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="auth-toggle-password"
                    onClick={() => setShowNew((s) => !s)}
                    aria-label={showNew ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    <Icon name={showNew ? 'visibility_off' : 'visibility'} size={22} />
                  </button>
                </div>
                <div className="auth-requirements" aria-live="polite">
                  {PASSWORD_REQUIREMENTS.map(({ key, label }) => (
                    <p
                      key={key}
                      className={`auth-requirement ${passwordReqs[key] ? 'auth-requirement--met' : ''}`}
                    >
                      <Icon
                        name={passwordReqs[key] ? 'check_circle' : 'radio_button_unchecked'}
                        className="auth-requirement-icon"
                        size={16}
                      />
                      {label}
                    </p>
                  ))}
                </div>
              </div>

              <div className="auth-field">
                <label htmlFor="forgot-confirm" className="auth-label">Confirm new password</label>
                <div className="auth-input-wrap">
                  <Icon name="key" className="auth-input-icon" size={22} />
                  <input
                    id="forgot-confirm"
                    type="password"
                    className={`auth-input ${confirmPassword && newPassword !== confirmPassword ? 'auth-input--error' : ''}`}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    disabled={loading}
                    aria-invalid={!!(confirmPassword && newPassword !== confirmPassword)}
                  />
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="auth-requirement" style={{ color: 'var(--color-error)' }}>
                    Passwords do not match
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="btn-primary auth-submit"
                disabled={loading || !canReset}
                aria-busy={loading}
              >
                {loading ? 'Resetting…' : 'Reset password'}
              </button>
            </form>
            <p className="auth-footer">
              <button
                type="button"
                className="auth-link"
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit' }}
                onClick={() => { setStep('email'); setError(''); setCode(''); setNewPassword(''); setConfirmPassword(''); }}
              >
                ← Use a different email
              </button>
              {' · '}
              <button
                type="button"
                className="auth-link"
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit' }}
                onClick={handleSendCode}
                disabled={loading}
              >
                Resend code
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-wrap">
        <div className="auth-brand">
          <div className="auth-brand-icon" aria-hidden="true">
            <Icon name="lock" size={28} />
          </div>
          <h1 className="auth-brand-title">Visit Tripoli</h1>
          <p className="auth-brand-sub">Reset your password</p>
        </div>
        <div className="auth-card card">
          <h2 className="auth-title">Forgot password?</h2>
          <p className="auth-footer" style={{ marginTop: 0, marginBottom: 16, textAlign: 'left' }}>
            Enter your email and we&apos;ll send you a 6-digit code to reset your password.
          </p>
          <form onSubmit={handleSendCode} className="auth-form" noValidate>
            {error && (
              <div className="auth-error" role="alert">
                {error}
              </div>
            )}
            <div className="auth-field">
              <label htmlFor="forgot-email" className="auth-label">Email address</label>
              <div className="auth-input-wrap">
                <Icon name="mail" className="auth-input-icon" size={22} />
                <input
                  id="forgot-email"
                  type="email"
                  className="auth-input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={loading}
                />
              </div>
            </div>
            <button
              type="submit"
              className="btn-primary auth-submit"
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? 'Sending…' : 'Send code'}
            </button>
          </form>
          <p className="auth-footer">
            <Link to="/login">← Back to Log in</Link>
          </p>
        </div>
        <div className="auth-secure-note" role="status">
          <Icon name="verified_user" size={20} />
          <span>We never share your email. The code expires in 15 minutes.</span>
        </div>
      </div>
    </div>
  );
}
