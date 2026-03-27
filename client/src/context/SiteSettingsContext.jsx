import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { api, API_ERROR_NETWORK } from '../api';
import { siteSettingsDefaults } from '../config/siteSettingsDefaults';
import { getStoredLanguage, getTranslation } from '../i18n/translations';

const SiteSettingsContext = createContext(null);

export function SiteSettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => ({ ...siteSettingsDefaults }));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(() => {
    setLoading(true);
    api
      .siteSettings()
      .then((r) => {
        const s = r?.settings && typeof r.settings === 'object' ? r.settings : {};
        setSettings({ ...siteSettingsDefaults, ...s });
        setError(null);
      })
      .catch((e) => {
        const lang = getStoredLanguage();
        setError(
          e?.code === API_ERROR_NETWORK
            ? getTranslation(lang, 'errors', 'networkError')
            : e?.message || 'Failed to load site settings'
        );
        setSettings({ ...siteSettingsDefaults });
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onSaved = () => refresh();
    window.addEventListener('tripoli-site-settings-saved', onSaved);
    return () => window.removeEventListener('tripoli-site-settings-saved', onSaved);
  }, [refresh]);

  const value = useMemo(() => ({ settings, loading, error, refresh }), [settings, loading, error, refresh]);

  return <SiteSettingsContext.Provider value={value}>{children}</SiteSettingsContext.Provider>;
}

export function useSiteSettings() {
  const ctx = useContext(SiteSettingsContext);
  if (!ctx) {
    throw new Error('useSiteSettings must be used within SiteSettingsProvider');
  }
  return ctx;
}
