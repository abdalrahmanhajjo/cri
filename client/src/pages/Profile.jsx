import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Icon from '../components/Icon';
import api from '../api/client';
import {
  checkPasswordRequirements,
  PASSWORD_REQUIREMENTS,
  isPasswordValid,
} from '../utils/passwordRequirements';
import './Profile.css';

function formatMemberSince(date) {
  if (!date) return '';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  } catch {
    return '';
  }
}

export default function Profile() {
  const { user, logout, refreshUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(null);

  /* Personal info form */
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState(null);

  /* Preferences */
  const [analytics, setAnalytics] = useState(true);
  const [showTips, setShowTips] = useState(true);

  /* Change password */
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState(null);

  const passwordReqs = useMemo(() => checkPasswordRequirements(newPassword), [newPassword]);
  const newPasswordValid = isPasswordValid(newPassword);
  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;
  const canChangePassword =
    currentPassword.trim() &&
    newPasswordValid &&
    passwordsMatch;

  useEffect(() => {
    api.user
      .profile()
      .then((data) => {
        setProfile(data);
        setName(data.name ?? '');
        setBio(data.bio ?? '');
        setCity(data.city ?? '');
        setAnalytics(data.analytics ?? true);
        setShowTips(data.showTips ?? true);
      })
      .catch((e) => setProfileError(e.message || 'Failed to load profile'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSaveProfile(e) {
    e.preventDefault();
    setProfileMsg(null);
    setSavingProfile(true);
    try {
      const data = await api.user.updateProfile({
        name: name.trim() || undefined,
        bio: bio.trim() || undefined,
        city: city.trim() || undefined,
        analytics,
        showTips,
      });
      setProfile((p) => ({ ...p, ...data }));
      await refreshUser();
      setProfileMsg({ type: 'success', text: 'Profile updated successfully.' });
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.message || 'Failed to update profile' });
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPasswordMsg(null);
    if (!canChangePassword) return;
    setSavingPassword(true);
    try {
      await api.user.changePassword(currentPassword, newPassword);
      setPasswordMsg({ type: 'success', text: 'Password updated. Use your new password next time you sign in.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordMsg({ type: 'error', text: err.message || 'Failed to change password' });
    } finally {
      setSavingPassword(false);
    }
  }

  if (loading) {
    return (
      <div className="profile-page">
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          Loading profile…
        </div>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="profile-page">
        <div className="profile-msg profile-msg--error" role="alert">
          {profileError}
        </div>
      </div>
    );
  }

  const displayName = profile?.name || user?.name || 'User';
  const displayEmail = profile?.email || user?.email || '';
  const initial = (displayName || displayEmail || '?').charAt(0).toUpperCase();
  const avatarUrl = profile?.avatarUrl || user?.avatarUrl;
  const memberSince = formatMemberSince(profile?.createdAt || user?.createdAt);

  return (
    <div className="profile-page">
      <header className="profile-header">
        <div className="profile-avatar">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" />
          ) : (
            initial
          )}
        </div>
        <h1 className="profile-name">{displayName}</h1>
        <p className="profile-email">{displayEmail}</p>
        {memberSince && (
          <p className="profile-meta">Member since {memberSince}</p>
        )}
      </header>

      {/* Personal information */}
      <section className="profile-section" aria-labelledby="profile-info-heading">
        <h2 id="profile-info-heading" className="profile-section-title">
          <Icon name="person" size={18} />
          Personal information
        </h2>
        <form onSubmit={handleSaveProfile}>
          <div className="profile-field">
            <label htmlFor="profile-name" className="profile-label">Name</label>
            <input
              id="profile-name"
              type="text"
              className="profile-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
              maxLength={150}
              aria-describedby="profile-msg"
            />
          </div>
          <div className="profile-field">
            <label htmlFor="profile-bio" className="profile-label">Bio</label>
            <textarea
              id="profile-bio"
              className="profile-textarea"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A short bio (optional)"
              maxLength={500}
              rows={3}
            />
          </div>
          <div className="profile-field">
            <label htmlFor="profile-city" className="profile-label">City</label>
            <input
              id="profile-city"
              type="text"
              className="profile-input"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Tripoli"
              autoComplete="address-level2"
              maxLength={100}
            />
          </div>
          {profileMsg && (
            <p
              id="profile-msg"
              className={`profile-msg ${profileMsg.type === 'error' ? 'profile-msg--error' : 'profile-msg--success'}`}
              role="status"
            >
              {profileMsg.text}
            </p>
          )}
          <div className="profile-actions">
            <button
              type="submit"
              className="profile-btn profile-btn--primary"
              disabled={savingProfile}
              aria-busy={savingProfile}
            >
              {savingProfile ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </section>

      {/* Preferences */}
      <section className="profile-section" aria-labelledby="profile-prefs-heading">
        <h2 id="profile-prefs-heading" className="profile-section-title">
          <Icon name="settings" size={18} />
          Preferences
        </h2>
        <div className="profile-toggle-row">
          <div>
            <p className="profile-toggle-label">Analytics</p>
            <p className="profile-toggle-desc">Help us improve by sharing anonymous usage data.</p>
          </div>
          <button
            type="button"
            className="profile-toggle"
            role="switch"
            aria-pressed={analytics}
            aria-label="Toggle analytics"
            onClick={() => setAnalytics((a) => !a)}
          />
        </div>
        <div className="profile-toggle-row">
          <div>
            <p className="profile-toggle-label">Show tips</p>
            <p className="profile-toggle-desc">Show in-app tips and suggestions.</p>
          </div>
          <button
            type="button"
            className="profile-toggle"
            role="switch"
            aria-pressed={showTips}
            aria-label="Toggle show tips"
            onClick={() => setShowTips((s) => !s)}
          />
        </div>
        <div className="profile-actions">
          <button
            type="button"
            className="profile-btn profile-btn--primary"
            disabled={savingProfile}
            onClick={handleSaveProfile}
          >
            Save preferences
          </button>
        </div>
      </section>

      {/* Security */}
      <section className="profile-section" aria-labelledby="profile-security-heading">
        <h2 id="profile-security-heading" className="profile-section-title">
          <Icon name="lock" size={18} />
          Security
        </h2>
        <p className="profile-toggle-desc" style={{ marginBottom: 16 }}>
          <Link to="/forgot-password" className="auth-link">Forgot password?</Link> Request a reset code sent to your email.
        </p>
        <form onSubmit={handleChangePassword}>
          <div className="profile-field">
            <label htmlFor="profile-current-password" className="profile-label">Current password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="profile-current-password"
                type={showCurrent ? 'text' : 'password'}
                className="profile-input"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={savingPassword}
              />
              <button
                type="button"
                onClick={() => setShowCurrent((s) => !s)}
                aria-label={showCurrent ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  padding: 4,
                  cursor: 'pointer',
                  color: 'var(--color-text-tertiary)',
                }}
              >
                <Icon name={showCurrent ? 'visibility_off' : 'visibility'} size={20} />
              </button>
            </div>
          </div>
          <div className="profile-field">
            <label htmlFor="profile-new-password" className="profile-label">New password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="profile-new-password"
                type={showNew ? 'text' : 'password'}
                className="profile-input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                disabled={savingPassword}
                aria-describedby="profile-pw-reqs"
              />
              <button
                type="button"
                onClick={() => setShowNew((s) => !s)}
                aria-label={showNew ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  padding: 4,
                  cursor: 'pointer',
                  color: 'var(--color-text-tertiary)',
                }}
              >
                <Icon name={showNew ? 'visibility_off' : 'visibility'} size={20} />
              </button>
            </div>
            <div id="profile-pw-reqs" className="profile-password-requirements" aria-live="polite">
              {PASSWORD_REQUIREMENTS.map(({ key, label }) => (
                <p
                  key={key}
                  className={`profile-password-requirement ${passwordReqs[key] ? 'profile-password-requirement--met' : ''}`}
                >
                  <Icon
                    name={passwordReqs[key] ? 'check_circle' : 'radio_button_unchecked'}
                    size={14}
                  />
                  {label}
                </p>
              ))}
            </div>
          </div>
          <div className="profile-field">
            <label htmlFor="profile-confirm-password" className="profile-label">Confirm new password</label>
            <input
              id="profile-confirm-password"
              type="password"
              className={`profile-input ${confirmPassword && newPassword !== confirmPassword ? 'profile-input--error' : ''}`}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              disabled={savingPassword}
              aria-invalid={!!(confirmPassword && newPassword !== confirmPassword)}
            />
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="profile-msg profile-msg--error" style={{ marginTop: 8 }}>
                Passwords do not match
              </p>
            )}
          </div>
          {passwordMsg && (
            <p
              className={`profile-msg ${passwordMsg.type === 'error' ? 'profile-msg--error' : 'profile-msg--success'}`}
              role="status"
            >
              {passwordMsg.text}
            </p>
          )}
          <div className="profile-actions">
            <button
              type="submit"
              className="profile-btn profile-btn--primary"
              disabled={savingPassword || !canChangePassword}
              aria-busy={savingPassword}
            >
              {savingPassword ? 'Updating…' : 'Change password'}
            </button>
          </div>
        </form>
      </section>

      {/* Account */}
      <section className="profile-section" aria-labelledby="profile-account-heading">
        <h2 id="profile-account-heading" className="profile-section-title">
          <Icon name="account_circle" size={18} />
          Account
        </h2>
        <button
          type="button"
          className="profile-btn profile-btn--danger"
          onClick={() => logout()}
          aria-label="Sign out of your account"
        >
          <Icon name="logout" size={20} style={{ verticalAlign: 'middle', marginRight: 8 }} />
          Sign out
        </button>
      </section>

      <div className="profile-secure-note" role="status">
        <Icon name="verified_user" size={20} />
        <span>Your profile and password are stored securely. We never share your data with third parties.</span>
      </div>
    </div>
  );
}
