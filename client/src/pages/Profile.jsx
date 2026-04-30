import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import Icon from '../components/Icon';
import HciSettingsPanel from '../components/HciSettingsPanel';
import api, { getImageUrl } from '../api/client';
import {
  checkPasswordRequirements,
  PASSWORD_REQUIREMENTS,
  isPasswordValid,
} from '../utils/passwordRequirements';
import './css/Profile.css';

function formatMemberSince(date, locale) {
  if (!date) return { full: '', short: '' };
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (Number.isNaN(d.getTime())) return { full: '', short: '' };
    const full = d.toLocaleDateString(locale, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const short = d.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
    return { full, short };
  } catch {
    return { full: '', short: '' };
  }
}

function formatProfileId(id) {
  if (id == null || id === '') return '—';
  const s = String(id);
  if (s.length <= 12) return s;
  return `${s.slice(0, 8)}…${s.slice(-4)}`;
}

export default function Profile() {
  const { t, lang, isRtl } = useLanguage();
  const { showToast } = useToast();
  const { user, logout, refreshUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(null);

  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState(null);

  const [analytics, setAnalytics] = useState(true);
  const [showTips, setShowTips] = useState(true);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const locale = lang === 'ar' ? 'ar-LB' : lang === 'fr' ? 'fr-LB' : 'en-GB';

  const passwordReqs = useMemo(() => checkPasswordRequirements(newPassword), [newPassword]);
  const newPasswordValid = isPasswordValid(newPassword);
  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;
  const canChangePassword = currentPassword.trim() && newPasswordValid && passwordsMatch;

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
      .catch((e) => setProfileError(e.message || t('profilePage', 'loadError')))
      .finally(() => setLoading(false));
  }, [t]);

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
      setProfile((p) => ({
        ...p,
        ...data,
        username: data.username ?? p?.username,
        avatarUrl: data.avatarUrl ?? p?.avatarUrl,
      }));
      await refreshUser();
      setProfileMsg({ type: 'success', text: t('profilePage', 'saveSuccess') });
      showToast(t('feedback', 'profileSaved'), 'success');
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.message || t('profilePage', 'saveError') });
      showToast(t('feedback', 'profileSaveFailed'), 'error');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleAvatarPick(file) {
    if (!file || avatarUploading) return;
    setAvatarUploading(true);
    try {
      const res = await api.user.uploadAvatar(file);
      const newUrl = res?.avatarUrl ? String(res.avatarUrl) : null;
      if (newUrl) {
        setProfile((p) => ({ ...p, avatarUrl: newUrl }));
        await refreshUser().catch(() => {});
        showToast(t('feedback', 'avatarUpdated'), 'success');
      } else {
        showToast(t('feedback', 'avatarUpdateFailed'), 'error');
      }
    } catch (e) {
      showToast(e?.message || t('feedback', 'avatarUpdateFailed'), 'error');
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPasswordMsg(null);
    if (!canChangePassword) return;
    setSavingPassword(true);
    try {
      await api.user.changePassword(currentPassword, newPassword);
      setPasswordMsg({ type: 'success', text: t('profilePage', 'passwordSuccess') });
      showToast(t('feedback', 'passwordChanged'), 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordMsg({ type: 'error', text: err.message || t('profilePage', 'passwordError') });
      showToast(t('feedback', 'passwordChangeFailed'), 'error');
    } finally {
      setSavingPassword(false);
    }
  }

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-loading">
          <div className="profile-loading-spinner" aria-hidden />
          <p>{t('profilePage', 'loading')}</p>
        </div>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="profile-page">
        <div className="profile-card profile-card--error" role="alert">
          <Icon name="error_outline" size={22} ariaHidden />
          <p>{profileError}</p>
        </div>
      </div>
    );
  }

  const displayName = profile?.name || user?.name || '—';
  const displayEmail = profile?.email || user?.email || '';
  const handle = (profile?.username && String(profile.username).trim()) || '';
  const initial = (displayName || displayEmail || '?').charAt(0).toUpperCase();
  const avatarUrl = profile?.avatarUrl || user?.avatarUrl;
  const avatarSrc = avatarUrl ? getImageUrl(String(avatarUrl)) : '';
  const { full: memberFull, short: memberShort } = formatMemberSince(
    profile?.createdAt || user?.createdAt,
    locale
  );
  const isAdmin = profile?.isAdmin === true;
  const isBusiness = profile?.isBusinessOwner === true;
  const ownedCount = Number(profile?.ownedPlaceCount) || 0;
  const bioMax = 500;
  const bioUsed = bio.length;

  const quickLinks = [
    { to: '/plan', label: t('profilePage', 'quickPlan'), icon: 'map' },
    { to: '/trips', label: t('profilePage', 'quickTrips'), icon: 'event_note' },
    { to: '/favourites', label: t('profilePage', 'quickFavourites'), icon: 'favorite' },
    { to: '/messages', label: t('profilePage', 'quickMessages'), icon: 'chat' },
  ];

  return (
    <div className={`profile-page ${isRtl ? 'profile-page--rtl' : ''}`}>
      <header className="profile-hero">
        <div className="profile-hero-visual" aria-hidden />
        <div className="profile-hero-content">
          <div className="profile-avatar-wrap">
            <div className="profile-avatar profile-avatar--hero">
              {avatarSrc ? <img src={avatarSrc} alt="" /> : initial}
            </div>
            <label className={`profile-avatar-edit ${avatarUploading ? 'profile-avatar-edit--busy' : ''}`}>
              <input
                type="file"
                accept="image/*,.heic,.heif"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  void handleAvatarPick(f);
                }}
                disabled={avatarUploading}
              />
              <span className="profile-avatar-edit-icon" aria-hidden>
                <Icon name="photo_camera" size={18} ariaHidden />
              </span>
              <span className="profile-avatar-edit-text">
                {avatarUploading ? t('profilePage', 'photoUploading') : t('profilePage', 'photoChange')}
              </span>
            </label>
            <p className="profile-avatar-hint">{t('profilePage', 'photoHint')}</p>
          </div>
          <div className="profile-hero-text">
            <p className="profile-kicker">{t('profilePage', 'verifiedVisitor')}</p>
            <h1 className="profile-title">{t('profilePage', 'title')}</h1>
            <p className="profile-display-name">{displayName}</p>
            {handle ? <p className="profile-handle">{handle.startsWith('@') ? handle : `@${handle}`}</p> : null}
            {memberShort ? (
              <p className="profile-hero-meta">
                <Icon name="calendar_today" size={16} aria-hidden />
                <span>
                  {t('profilePage', 'memberSince')} {memberFull || memberShort}
                </span>
              </p>
            ) : null}
            <div className="profile-badges">
              {isAdmin ? (
                <span className="profile-badge profile-badge--admin">
                  <Icon name="admin_panel_settings" size={14} aria-hidden />
                  {t('profilePage', 'badgeAdmin')}
                </span>
              ) : null}
              {isBusiness ? (
                <span className="profile-badge profile-badge--host">
                  <Icon name="storefront" size={14} aria-hidden />
                  {ownedCount > 0
                    ? t('profilePage', 'placesListed').replace('{count}', String(ownedCount))
                    : t('profilePage', 'badgeBusiness')}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <p className="profile-lead">{t('profilePage', 'subtitle')}</p>

      <nav className="profile-quick-nav" aria-label={t('profilePage', 'quickNavLabel')}>
        <ul className="profile-quick-grid">
          {quickLinks.map((item) => (
            <li key={item.to}>
              <Link to={item.to} className="profile-quick-link">
                <span className="profile-quick-icon" aria-hidden>
                  <Icon name={item.icon} size={22} />
                </span>
                <span className="profile-quick-label">{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section className="profile-card" aria-labelledby="profile-summary-heading">
        <h2 id="profile-summary-heading" className="profile-card-heading">
          {t('profilePage', 'accountSummary')}
        </h2>
        <dl className="profile-dl">
          <div className="profile-dl-row">
            <dt>{t('profilePage', 'emailLabel')}</dt>
            <dd>{displayEmail || '—'}</dd>
          </div>
          <div className="profile-dl-row">
            <dt>{t('profilePage', 'usernameLabel')}</dt>
            <dd>{handle ? (handle.startsWith('@') ? handle : `@${handle}`) : '—'}</dd>
          </div>
          <div className="profile-dl-row">
            <dt>{t('profilePage', 'userIdLabel')}</dt>
            <dd>
              <code className="profile-id-code">{formatProfileId(profile?.id)}</code>
            </dd>
          </div>
        </dl>
      </section>

      <section className="profile-card" aria-labelledby="profile-personal-heading">
        <h2 id="profile-personal-heading" className="profile-card-heading">
          <Icon name="person" size={20} aria-hidden />
          {t('profilePage', 'personalTitle')}
        </h2>
        <p className="profile-card-desc">{t('profilePage', 'personalIntro')}</p>
        <form onSubmit={handleSaveProfile} className="profile-form">
          <div className="profile-field">
            <label htmlFor="profile-name" className="profile-label">
              {t('profilePage', 'fieldName')}
            </label>
            <input
              id="profile-name"
              type="text"
              className="profile-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('profilePage', 'fieldNamePlaceholder')}
              autoComplete="name"
              maxLength={150}
              aria-describedby="profile-msg"
            />
          </div>
          <div className="profile-field">
            <div className="profile-label-row">
              <label htmlFor="profile-bio" className="profile-label">
                {t('profilePage', 'fieldBio')}
              </label>
              <span className="profile-char-hint" aria-live="polite">
                {t('profilePage', 'bioCharCount')
                  .replace('{used}', String(bioUsed))
                  .replace('{max}', String(bioMax))}
              </span>
            </div>
            <textarea
              id="profile-bio"
              className="profile-textarea"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder={t('profilePage', 'fieldBioPlaceholder')}
              maxLength={bioMax}
              rows={4}
            />
          </div>
          <div className="profile-field">
            <label htmlFor="profile-city" className="profile-label">
              {t('profilePage', 'fieldCity')}
            </label>
            <input
              id="profile-city"
              type="text"
              className="profile-input"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder={t('profilePage', 'fieldCityPlaceholder')}
              autoComplete="address-level2"
              maxLength={100}
            />
          </div>

          <div className="profile-prefs-divider" role="presentation" />

          <h3 className="profile-subheading">{t('profilePage', 'prefsTitle')}</h3>
          <div className="profile-toggle-row">
            <div>
              <p className="profile-toggle-label">{t('profilePage', 'prefAnalytics')}</p>
              <p className="profile-toggle-desc">{t('profilePage', 'prefAnalyticsDesc')}</p>
            </div>
            <button
              type="button"
              className="profile-toggle"
              role="switch"
              aria-pressed={analytics}
              aria-label={t('profilePage', 'prefAnalytics')}
              onClick={() => setAnalytics((a) => !a)}
            />
          </div>
          <div className="profile-toggle-row profile-toggle-row--last">
            <div>
              <p className="profile-toggle-label">{t('profilePage', 'prefTips')}</p>
              <p className="profile-toggle-desc">{t('profilePage', 'prefTipsDesc')}</p>
            </div>
            <button
              type="button"
              className="profile-toggle"
              role="switch"
              aria-pressed={showTips}
              aria-label={t('profilePage', 'prefTips')}
              onClick={() => setShowTips((s) => !s)}
            />
          </div>

          {profileMsg ? (
            <p
              id="profile-msg"
              className={`profile-msg ${profileMsg.type === 'error' ? 'profile-msg--error' : 'profile-msg--success'}`}
              role="status"
            >
              {profileMsg.text}
            </p>
          ) : null}
          <div className="profile-actions">
            <button
              type="submit"
              className="profile-btn profile-btn--primary"
              disabled={savingProfile}
              aria-busy={savingProfile}
            >
              {savingProfile ? t('profilePage', 'saving') : t('profilePage', 'saveProfile')}
            </button>
          </div>
        </form>
      </section>

      <section className="profile-card" aria-labelledby="profile-hci-heading">
        <h2 id="profile-hci-heading" className="profile-card-heading">
          <Icon name="psychology" size={20} aria-hidden />
          {t('profilePage', 'hciFeedbackHeading')}
        </h2>
        <HciSettingsPanel />
      </section>

      <section className="profile-card" aria-labelledby="profile-security-heading">
        <h2 id="profile-security-heading" className="profile-card-heading">
          <Icon name="lock" size={20} aria-hidden />
          {t('profilePage', 'securityTitle')}
        </h2>
        <p className="profile-card-desc">
          {t('profilePage', 'securityLead')}{' '}
          <Link to="/forgot-password" className="profile-inline-link">
            {t('profilePage', 'securityResetLink')}
          </Link>
        </p>
        <form onSubmit={handleChangePassword} className="profile-form">
          <div className="profile-field">
            <label htmlFor="profile-current-password" className="profile-label">
              {t('profilePage', 'fieldCurrentPassword')}
            </label>
            <div className="profile-input-shell">
              <input
                id="profile-current-password"
                type={showCurrent ? 'text' : 'password'}
                className="profile-input profile-input--padded-end"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                disabled={savingPassword}
              />
              <button
                type="button"
                className="profile-input-suffix"
                onClick={() => setShowCurrent((s) => !s)}
                aria-label={showCurrent ? t('profilePage', 'hidePassword') : t('profilePage', 'showPassword')}
              >
                <Icon name={showCurrent ? 'visibility_off' : 'visibility'} size={20} />
              </button>
            </div>
          </div>
          <div className="profile-field">
            <label htmlFor="profile-new-password" className="profile-label">
              {t('profilePage', 'fieldNewPassword')}
            </label>
            <div className="profile-input-shell">
              <input
                id="profile-new-password"
                type={showNew ? 'text' : 'password'}
                className="profile-input profile-input--padded-end"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                disabled={savingPassword}
                aria-describedby="profile-pw-reqs"
              />
              <button
                type="button"
                className="profile-input-suffix"
                onClick={() => setShowNew((s) => !s)}
                aria-label={showNew ? t('profilePage', 'hidePassword') : t('profilePage', 'showPassword')}
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
            <label htmlFor="profile-confirm-password" className="profile-label">
              {t('profilePage', 'fieldConfirmPassword')}
            </label>
            <input
              id="profile-confirm-password"
              type="password"
              className={`profile-input ${confirmPassword && newPassword !== confirmPassword ? 'profile-input--error' : ''}`}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              disabled={savingPassword}
              aria-invalid={!!(confirmPassword && newPassword !== confirmPassword)}
            />
            {confirmPassword && newPassword !== confirmPassword ? (
              <p className="profile-msg profile-msg--error profile-msg--inline" role="alert">
                {t('profilePage', 'passwordsMismatch')}
              </p>
            ) : null}
          </div>
          {passwordMsg ? (
            <p
              className={`profile-msg ${passwordMsg.type === 'error' ? 'profile-msg--error' : 'profile-msg--success'}`}
              role="status"
            >
              {passwordMsg.text}
            </p>
          ) : null}
          <div className="profile-actions">
            <button
              type="submit"
              className="profile-btn profile-btn--primary"
              disabled={savingPassword || !canChangePassword}
              aria-busy={savingPassword}
            >
              {savingPassword ? t('profilePage', 'updatingPassword') : t('profilePage', 'changePassword')}
            </button>
          </div>
        </form>
      </section>

      <section className="profile-card profile-card--account" aria-labelledby="profile-account-heading">
        <h2 id="profile-account-heading" className="profile-card-heading">
          <Icon name="account_circle" size={20} aria-hidden />
          {t('profilePage', 'accountTitle')}
        </h2>
        <button
          type="button"
          className="profile-btn profile-btn--danger profile-btn--block"
          onClick={() => logout()}
          aria-label={t('profilePage', 'signOutAria')}
        >
          <Icon name="logout" size={20} aria-hidden />
          {t('profilePage', 'signOut')}
        </button>
      </section>

      <div className="profile-trust" role="status">
        <Icon name="verified_user" size={22} aria-hidden />
        <p>{t('profilePage', 'trustNote')}</p>
      </div>
    </div>
  );
}
