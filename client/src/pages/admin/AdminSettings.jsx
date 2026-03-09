import { useState, useEffect } from 'react';
import './Admin.css';

const SETTINGS_KEY = 'tripoli_admin_settings';

const defaultSettings = {
  siteName: 'Visit Tripoli',
  siteTagline: "Spots, experiences & events in Lebanon's second city",
  defaultLanguage: 'en',
  showWeather: true,
  showMap: true,
  contactEmail: '',
  contactPhone: '',
  socialFacebook: '',
  socialInstagram: '',
  analyticsId: '',
};

function getStoredSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...defaultSettings, ...JSON.parse(raw) } : { ...defaultSettings };
  } catch {
    return { ...defaultSettings };
  }
}

function setStoredSettings(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function getSiteSettings() {
  return getStoredSettings();
}

export default function AdminSettings() {
  const [form, setForm] = useState({ ...defaultSettings });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setForm(getStoredSettings());
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    try {
      setStoredSettings(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message || 'Failed to save');
    }
  };

  const SettingsIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );

  return (
    <div className="admin-page-content">
      <div className="admin-page-header">
        <div className="admin-page-title-wrap">
          <p className="admin-subtitle">Control site-wide settings</p>
          <h1>Settings</h1>
        </div>
      </div>

      {error && <div className="admin-error">{error}</div>}
      {saved && <div className="admin-toast admin-toast--success" style={{ position: 'relative', marginBottom: '1rem' }}>Settings saved successfully</div>}

      <div className="admin-widgets admin-dashboard-grid" style={{ gridTemplateColumns: 'repeat(12, 1fr)' }}>
        <div className="admin-card" style={{ gridColumn: 'span 12' }}>
          <div className="admin-card-header">
            <h2 className="admin-card-title">
              <span className="admin-modal-header-icon" style={{ marginRight: '0.5rem', display: 'inline-flex' }}><SettingsIcon /></span>
              Site configuration
            </h2>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="admin-card-body">
              <div className="admin-form-section">
                <div className="admin-form-section-title">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
                  General
                </div>
                <div className="admin-form-row">
                  <div className="admin-form-group">
                    <label>Site name</label>
                    <input value={form.siteName} onChange={(e) => setForm((f) => ({ ...f, siteName: e.target.value }))} placeholder="Visit Tripoli" />
                  </div>
                  <div className="admin-form-group">
                    <label>Default language</label>
                    <select value={form.defaultLanguage} onChange={(e) => setForm((f) => ({ ...f, defaultLanguage: e.target.value }))}>
                      <option value="en">English</option>
                      <option value="ar">العربية</option>
                      <option value="fr">Français</option>
                    </select>
                  </div>
                </div>
                <div className="admin-form-group">
                  <label>Tagline</label>
                  <input value={form.siteTagline} onChange={(e) => setForm((f) => ({ ...f, siteTagline: e.target.value }))} placeholder="Spots, experiences & events..." />
                </div>
              </div>

              <div className="admin-form-section">
                <div className="admin-form-section-title">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
                  Features
                </div>
                <div className="admin-form-row">
                  <div className="admin-form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.showWeather} onChange={(e) => setForm((f) => ({ ...f, showWeather: e.target.checked }))} />
                      Show weather widget
                    </label>
                  </div>
                  <div className="admin-form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.showMap} onChange={(e) => setForm((f) => ({ ...f, showMap: e.target.checked }))} />
                      Show map
                    </label>
                  </div>
                </div>
              </div>

              <div className="admin-form-section">
                <div className="admin-form-section-title">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                  Contact
                </div>
                <div className="admin-form-row">
                  <div className="admin-form-group">
                    <label>Contact email</label>
                    <input type="email" value={form.contactEmail} onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))} placeholder="info@visittripoli.com" />
                  </div>
                  <div className="admin-form-group">
                    <label>Contact phone</label>
                    <input value={form.contactPhone} onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))} placeholder="+961 6 123456" />
                  </div>
                </div>
              </div>

              <div className="admin-form-section">
                <div className="admin-form-section-title">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>
                  Social & analytics
                </div>
                <div className="admin-form-row">
                  <div className="admin-form-group">
                    <label>Facebook URL</label>
                    <input value={form.socialFacebook} onChange={(e) => setForm((f) => ({ ...f, socialFacebook: e.target.value }))} placeholder="https://facebook.com/..." />
                  </div>
                  <div className="admin-form-group">
                    <label>Instagram URL</label>
                    <input value={form.socialInstagram} onChange={(e) => setForm((f) => ({ ...f, socialInstagram: e.target.value }))} placeholder="https://instagram.com/..." />
                  </div>
                </div>
                <div className="admin-form-group">
                  <label>Analytics ID (GA4, etc.)</label>
                  <input value={form.analyticsId} onChange={(e) => setForm((f) => ({ ...f, analyticsId: e.target.value }))} placeholder="G-XXXXXXXXXX" />
                  <span className="admin-form-hint">Optional – for tracking</span>
                </div>
              </div>
            </div>
            <div className="admin-modal-footer" style={{ borderTop: '1px solid #e5e7eb' }}>
              <button type="submit" className="admin-btn admin-btn--primary">Save settings</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
