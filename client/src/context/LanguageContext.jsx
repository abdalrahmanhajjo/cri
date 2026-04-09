import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getTranslation, languages, getStoredLanguage, setStoredLanguage, setApiOverrides } from '../i18n/translations';
import { api } from '../api/client';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(getStoredLanguage);
  const [overrideVersion, setOverrideVersion] = useState(0);

  useEffect(() => {
    api.admin.content.get()
      .then((res) => { if (res?.overrides) setApiOverrides(res.overrides); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onOverridesChange = () => setOverrideVersion((v) => v + 1);
    window.addEventListener('translations-updated', onOverridesChange);
    return () => window.removeEventListener('translations-updated', onOverridesChange);
  }, []);

  const setLanguage = useCallback((code) => {
    if (!['en', 'ar', 'fr'].includes(code)) return;
    setLangState(code);
    setStoredLanguage(code);
  }, []);

  useEffect(() => {
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dir = dir;
    document.documentElement.lang = lang === 'ar' ? 'ar' : lang === 'fr' ? 'fr' : 'en';
  }, [lang]);

  const t = useCallback((namespace, key) => {
    return getTranslation(lang, namespace, key);
  }, [lang, overrideVersion]);

  const value = useMemo(
    () => ({
      lang,
      setLanguage,
      t,
      languages,
      isRtl: lang === 'ar',
    }),
    [lang, setLanguage, t]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
