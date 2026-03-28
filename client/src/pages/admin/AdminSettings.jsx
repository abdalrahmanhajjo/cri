import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { siteSettingsDefaults } from '../../config/siteSettingsDefaults';
import AdminTranslationsPanel from './AdminTranslationsPanel';
import './Admin.css';

function SettingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'features', label: 'Features' },
  { id: 'contact', label: 'Contact & social' },
  { id: 'operations', label: 'Operations' },
  { id: 'translations', label: 'Translations' },
];

export default function AdminSettings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab = TABS.some((t) => t.id === tabParam) ? tabParam : 'general';

  const [form, setForm] = useState(() => ({ ...siteSettingsDefaults }));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState(null);
  const [healthErr, setHealthErr] = useState(null);

  const setTab = (id) => {
    setSearchParams(id === 'general' ? {} : { tab: id });
  };

  const apiBase = (() => {
    const raw = import.meta.env.VITE_API_URL;
    if (raw == null || String(raw).trim() === '') {
      if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
      return '';
    }
    return String(raw).replace(/\/$/, '');
  })();

  const pingHealth = useCallback(() => {
    setHealth(null);
    setHealthErr(null);
    fetch(`${apiBase}/health`, { credentials: 'omit' })
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (ok) setHealth(j);
        else setHealthErr('Unexpected response');
      })
      .catch((e) => setHealthErr(e.message || 'Unreachable'));
  }, [apiBase]);

  useEffect(() => {
    const id = window.setTimeout(() => pingHealth(), 0);
    return () => window.clearTimeout(id);
  }, [pingHealth]);

  useEffect(() => {
    api.admin.siteSettings
      .get()
      .then((r) => {
        const server = r.settings && typeof r.settings === 'object' ? r.settings : {};
        setForm({ ...siteSettingsDefaults, ...server });
      })
      .catch(() => setForm({ ...siteSettingsDefaults }))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    try {
      const r = await api.admin.siteSettings.save(form);
      const merged = r.settings && typeof r.settings === 'object' ? r.settings : form;
      setForm({ ...siteSettingsDefaults, ...merged });
      window.dispatchEvent(new Event('tripoli-site-settings-saved'));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message || 'Failed to save');
    }
  };

  return (
    <div className="admin-page-content">
      <div className="admin-page-header">
        <div className="admin-page-title-wrap">
          <p className="admin-subtitle">
            Saved to PostgreSQL. Public clients use <code>GET /api/site-settings</code> (no auth) — same JSON for this website
            and the mobile app.
          </p>
          <h1>
            <span className="admin-modal-header-icon" style={{ marginRight: '0.45rem', display: 'inline-flex', verticalAlign: 'middle' }}><SettingsIcon /></span>
            Site settings
          </h1>
        </div>
      </div>

      {error && <div className="admin-error">{error}</div>}
      {saved && <div className="admin-toast admin-toast--success" style={{ position: 'relative', marginBottom: '1rem' }} role="status">Settings saved to server</div>}
      {loading && <div className="admin-loading" style={{ marginBottom: '1rem' }}>Loading…</div>}

      <div className="admin-settings-tabs" role="tablist" aria-label="Settings sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={activeTab === t.id}
            className={`admin-settings-tab${activeTab === t.id ? ' admin-settings-tab--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'translations' ? (
        <AdminTranslationsPanel />
      ) : (
        <form onSubmit={handleSubmit} style={{ opacity: loading ? 0.65 : 1 }}>
          <div className="admin-widgets admin-dashboard-grid" style={{ gridTemplateColumns: 'repeat(12, 1fr)' }}>
            {activeTab === 'general' && (
              <div className="admin-card" style={{ gridColumn: 'span 12' }}>
                <div className="admin-card-header">
                  <h2 className="admin-card-title">Branding</h2>
                </div>
                <div className="admin-card-body">
                  <div className="admin-form-row">
                    <div className="admin-form-group">
                      <label htmlFor="as-site-name">Site name</label>
                      <input id="as-site-name" value={form.siteName} onChange={(e) => setForm((f) => ({ ...f, siteName: e.target.value }))} placeholder="Visit Tripoli" />
                    </div>
                    <div className="admin-form-group">
                      <label htmlFor="as-lang">Default language</label>
                      <select id="as-lang" value={form.defaultLanguage} onChange={(e) => setForm((f) => ({ ...f, defaultLanguage: e.target.value }))}>
                        <option value="en">English</option>
                        <option value="ar">العربية</option>
                        <option value="fr">Français</option>
                      </select>
                    </div>
                  </div>
                  <div className="admin-form-group">
                    <label htmlFor="as-tagline">Tagline</label>
                    <input id="as-tagline" value={form.siteTagline} onChange={(e) => setForm((f) => ({ ...f, siteTagline: e.target.value }))} />
                    <span className="admin-form-hint">
                      Home hero and footer use translated lines unless you enter a custom tagline here (then that text is shown in all languages).
                    </span>
                  </div>
                  <div className="admin-form-group">
                    <label htmlFor="as-meta-desc">Home page meta description (SEO)</label>
                    <textarea
                      id="as-meta-desc"
                      rows={2}
                      value={form.metaDescription || ''}
                      onChange={(e) => setForm((f) => ({ ...f, metaDescription: e.target.value }))}
                      placeholder="Short description for search engines (optional)"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'features' && (
              <div className="admin-card" style={{ gridColumn: 'span 12' }}>
                <div className="admin-card-header">
                  <h2 className="admin-card-title">Feature toggles</h2>
                </div>
                <div className="admin-card-body">
                  <div className="admin-form-row">
                    <div className="admin-form-group">
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={form.showMap} onChange={(e) => setForm((f) => ({ ...f, showMap: e.target.checked }))} />
                        Show map entry points (nav, home, footer)
                      </label>
                    </div>
                  </div>
                  <div className="admin-form-group">
                    <label htmlFor="as-ga">Analytics ID (GA4)</label>
                    <input id="as-ga" value={form.analyticsId} onChange={(e) => setForm((f) => ({ ...f, analyticsId: e.target.value }))} placeholder="G-XXXXXXXXXX" />
                    <span className="admin-form-hint">Loaded on the public site when visitors browse (not only local).</span>
                  </div>
                  <hr style={{ border: 0, borderTop: '1px solid #e5e7eb', margin: '1.25rem 0' }} />
                  <h3 className="admin-card-title" style={{ fontSize: '1.05rem', marginBottom: '0.75rem' }}>Home bento (hero) images</h3>
                  <p className="admin-form-hint" style={{ marginTop: 0 }}>
                    Optional full URLs to your own photos. Leave blank to use built‑in defaults (not tied to place listings). Avatars are the three circles on the main hero; each links to Community.
                  </p>
                  <div className="admin-form-row">
                    <div className="admin-form-group">
                      <label htmlFor="as-bento-hero">Main hero background</label>
                      <input id="as-bento-hero" type="url" value={form.homeBentoHeroImage || ''} onChange={(e) => setForm((f) => ({ ...f, homeBentoHeroImage: e.target.value }))} placeholder="https://…" />
                    </div>
                    <div className="admin-form-group">
                      <label htmlFor="as-bento-side">Community card</label>
                      <input id="as-bento-side" type="url" value={form.homeBentoSideImage || ''} onChange={(e) => setForm((f) => ({ ...f, homeBentoSideImage: e.target.value }))} placeholder="https://…" />
                    </div>
                  </div>
                  <div className="admin-form-row">
                    <div className="admin-form-group">
                      <label htmlFor="as-bento-why">Middle image tile</label>
                      <input id="as-bento-why" type="url" value={form.homeBentoWhyImage || ''} onChange={(e) => setForm((f) => ({ ...f, homeBentoWhyImage: e.target.value }))} placeholder="https://…" />
                    </div>
                    <div className="admin-form-group">
                      <label htmlFor="as-bento-mosaic">Large mosaic panel</label>
                      <input id="as-bento-mosaic" type="url" value={form.homeBentoMosaicImage || ''} onChange={(e) => setForm((f) => ({ ...f, homeBentoMosaicImage: e.target.value }))} placeholder="https://…" />
                    </div>
                  </div>
                  <div className="admin-form-row">
                    <div className="admin-form-group">
                      <label htmlFor="as-bento-a1">Hero avatar 1</label>
                      <input id="as-bento-a1" type="url" value={form.homeBentoAvatar1 || ''} onChange={(e) => setForm((f) => ({ ...f, homeBentoAvatar1: e.target.value }))} placeholder="https://…" />
                    </div>
                    <div className="admin-form-group">
                      <label htmlFor="as-bento-a2">Hero avatar 2</label>
                      <input id="as-bento-a2" type="url" value={form.homeBentoAvatar2 || ''} onChange={(e) => setForm((f) => ({ ...f, homeBentoAvatar2: e.target.value }))} placeholder="https://…" />
                    </div>
                    <div className="admin-form-group">
                      <label htmlFor="as-bento-a3">Hero avatar 3</label>
                      <input id="as-bento-a3" type="url" value={form.homeBentoAvatar3 || ''} onChange={(e) => setForm((f) => ({ ...f, homeBentoAvatar3: e.target.value }))} placeholder="https://…" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'contact' && (
              <div className="admin-card" style={{ gridColumn: 'span 12' }}>
                <div className="admin-card-header">
                  <h2 className="admin-card-title">Contact & social</h2>
                </div>
                <div className="admin-card-body">
                  <div className="admin-form-row">
                    <div className="admin-form-group">
                      <label htmlFor="as-email">Contact email</label>
                      <input id="as-email" type="email" value={form.contactEmail} onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))} />
                    </div>
                    <div className="admin-form-group">
                      <label htmlFor="as-phone">Contact phone</label>
                      <input id="as-phone" value={form.contactPhone} onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))} />
                    </div>
                  </div>
                  <div className="admin-form-group">
                    <label htmlFor="as-support-url">Support / info URL</label>
                    <input id="as-support-url" type="url" value={form.supportUrl || ''} onChange={(e) => setForm((f) => ({ ...f, supportUrl: e.target.value }))} placeholder="https://…" />
                  </div>
                  <div className="admin-form-row">
                    <div className="admin-form-group">
                      <label htmlFor="as-fb">Facebook</label>
                      <input id="as-fb" type="url" value={form.socialFacebook} onChange={(e) => setForm((f) => ({ ...f, socialFacebook: e.target.value }))} />
                    </div>
                    <div className="admin-form-group">
                      <label htmlFor="as-ig">Instagram</label>
                      <input id="as-ig" type="url" value={form.socialInstagram} onChange={(e) => setForm((f) => ({ ...f, socialInstagram: e.target.value }))} />
                    </div>
                  </div>
                  <div className="admin-form-group">
                    <label htmlFor="as-x">X (Twitter) URL</label>
                    <input id="as-x" type="url" value={form.socialTwitterX || ''} onChange={(e) => setForm((f) => ({ ...f, socialTwitterX: e.target.value }))} placeholder="https://x.com/…" />
                  </div>
                  <div className="admin-form-row">
                    <div className="admin-form-group">
                      <label htmlFor="as-appstore">App Store URL</label>
                      <input
                        id="as-appstore"
                        type="url"
                        value={form.appStoreUrl || ''}
                        onChange={(e) => setForm((f) => ({ ...f, appStoreUrl: e.target.value }))}
                        placeholder="https://apps.apple.com/…"
                      />
                    </div>
                    <div className="admin-form-group">
                      <label htmlFor="as-play">Google Play URL</label>
                      <input
                        id="as-play"
                        type="url"
                        value={form.playStoreUrl || ''}
                        onChange={(e) => setForm((f) => ({ ...f, playStoreUrl: e.target.value }))}
                        placeholder="https://play.google.com/…"
                      />
                    </div>
                  </div>
                  <p className="admin-form-hint" style={{ marginTop: 0 }}>
                    Store URLs are used on the home hero download buttons. Leave blank to use generic App Store / Play links.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'operations' && (
              <>
                <div className="admin-card" style={{ gridColumn: 'span 12' }}>
                  <div className="admin-card-header">
                    <h2 className="admin-card-title">Public announcement</h2>
                  </div>
                  <div className="admin-card-body">
                    <div className="admin-form-group">
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={form.announcementEnabled} onChange={(e) => setForm((f) => ({ ...f, announcementEnabled: e.target.checked }))} />
                        Show announcement strip on the website (top of layout)
                      </label>
                    </div>
                    <div className="admin-form-group">
                      <label htmlFor="as-ann-text">Message</label>
                      <textarea id="as-ann-text" rows={3} value={form.announcementText} onChange={(e) => setForm((f) => ({ ...f, announcementText: e.target.value }))} placeholder="Short public message…" />
                    </div>
                    <div className="admin-form-group">
                      <label htmlFor="as-ann-url">Optional link URL</label>
                      <input id="as-ann-url" type="url" value={form.announcementUrl} onChange={(e) => setForm((f) => ({ ...f, announcementUrl: e.target.value }))} placeholder="https://…" />
                    </div>
                  </div>
                </div>

                <div className="admin-card" style={{ gridColumn: 'span 12' }}>
                  <div className="admin-card-header">
                    <h2 className="admin-card-title">Maintenance</h2>
                  </div>
                  <div className="admin-card-body">
                    <div className="admin-form-group">
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={form.maintenanceMode} onChange={(e) => setForm((f) => ({ ...f, maintenanceMode: e.target.checked }))} />
                        Maintenance mode flag
                      </label>
                      <span className="admin-form-hint">Shows a yellow banner on the public site. Mobile app can read the same JSON flag.</span>
                    </div>
                  </div>
                </div>

                <div className="admin-card" style={{ gridColumn: 'span 12' }}>
                  <div className="admin-card-header">
                    <h2 className="admin-card-title">API health</h2>
                  </div>
                  <div className="admin-card-body">
                    <p style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: '#64748b' }}>
                      Endpoint: <code>{apiBase}/health</code>
                    </p>
                    {health && (
                      <div style={{ marginBottom: '0.75rem', padding: '0.65rem 0.85rem', borderRadius: 8, background: 'rgba(12, 92, 89, 0.08)', border: '1px solid rgba(12, 92, 89, 0.25)', fontSize: '0.88rem' }}>
                        OK — <code>{JSON.stringify(health)}</code>
                      </div>
                    )}
                    {healthErr && (
                      <div className="admin-error" style={{ marginBottom: '0.75rem' }}>{healthErr}</div>
                    )}
                    <button type="button" className="admin-btn admin-btn--secondary" onClick={pingHealth}>
                      Check again
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="admin-modal-footer" style={{ borderTop: '1px solid #e5e7eb', marginTop: '1rem', paddingTop: '1rem' }}>
            <button type="submit" className="admin-btn admin-btn--primary">Save settings</button>
          </div>
        </form>
      )}
    </div>
  );
}
