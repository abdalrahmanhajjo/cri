import { useState } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Icon from '../components/Icon';
import './Auth.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const rawFrom = location.state?.from || searchParams.get('redirect') || '/';
  const from = typeof rawFrom === 'string' && rawFrom.startsWith('/') && !rawFrom.startsWith('//') ? rawFrom : '/';

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Sign in failed. Please try again.');
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
              <div id="login-error" className="auth-error" role="alert">
                {error}
              </div>
            )}

            <div className="auth-field">
              <label htmlFor="login-email" className="auth-label">
                Email address
              </label>
              <div className="auth-input-wrap">
                <Icon name="mail" className="auth-input-icon" size={22} />
                <input
                  id="login-email"
                  type="email"
                  className={`auth-input ${error ? 'auth-input--error' : ''}`}
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoCapitalize="off"
                  autoCorrect="off"
                  inputMode="email"
                  aria-invalid={!!error}
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
                  className={`auth-input ${error ? 'auth-input--error' : ''}`}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  aria-invalid={!!error}
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

          <p className="auth-footer">
            Don&apos;t have an account? <Link to="/register">Sign up</Link>
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
