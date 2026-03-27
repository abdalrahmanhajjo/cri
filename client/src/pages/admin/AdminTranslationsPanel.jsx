import { useAdminContent, useUpdateAdminContentMutation } from '../../hooks/useAdmin';
import { translations, getTranslationOverrides, setTranslationOverrides, setApiOverrides } from '../../i18n/translations';

function flattenTranslations() {
  const items = [];
  for (const [lang, namespaces] of Object.entries(translations)) {
    if (typeof namespaces !== 'object') continue;
    for (const [namespace, keys] of Object.entries(namespaces)) {
      if (typeof keys !== 'object') continue;
      for (const [key, value] of Object.entries(keys)) {
        if (typeof value === 'string') {
          items.push({ lang, namespace, key, defaultValue: value });
        }
      }
    }
  }
  return items;
}

const ALL_ITEMS = flattenTranslations();
const NAMESPACES = [...new Set(ALL_ITEMS.map((i) => i.namespace))].sort();
const SECTION_ALL = '__all__';

/** Human-readable names for each i18n namespace (same keys as web + mobile bundles). */
const SECTION_META = {
  nav: {
    label: 'Navigation & menus',
    blurb: 'Header, footer, mega menu, account links',
  },
  home: {
    label: 'Home page',
    blurb: 'Landing hero, sections, trip planner CTAs, weather copy',
  },
  detail: {
    label: 'Detail pages',
    blurb: 'Place, event & tour screens — titles, buttons, empty states',
  },
};

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية' },
  { code: 'fr', label: 'Français' },
];

function ContentRow({ item, currentValue, onSave, showNamespace }) {
  const [edit, setEdit] = useState('');
  const [focused, setFocused] = useState(false);
  const rowRef = useRef(null);

  const hasOverride = currentValue !== item.defaultValue;
  const displayValue = currentValue;
  const nsShort = SECTION_META[item.namespace]?.label || item.namespace;

  const handleFocus = () => {
    setEdit(displayValue);
    setFocused(true);
    requestAnimationFrame(() => {
      rowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  };

  const handleSave = () => {
    const trimmed = edit.trim();
    if (trimmed !== displayValue) {
      onSave(item.lang, item.namespace, item.key, trimmed || null);
      window.dispatchEvent(new CustomEvent('translations-updated'));
    }
    setFocused(false);
  };

  const handleReset = () => {
    onSave(item.lang, item.namespace, item.key, null);
    window.dispatchEvent(new CustomEvent('translations-updated'));
    setEdit(item.defaultValue);
    setFocused(false);
  };

  return (
    <tr ref={rowRef} className={`admin-content-row${focused ? ' admin-content-row--editing' : ''}`}>
      {showNamespace && (
        <td className="admin-content-section">
          <span className="admin-content-section-badge" title={SECTION_META[item.namespace]?.blurb || ''}>
            {nsShort}
          </span>
        </td>
      )}
      <td className="admin-content-key">
        <code>{item.key}</code>
        {hasOverride && <span className="admin-content-override-badge">edited</span>}
      </td>
      <td className="admin-content-value">
        {focused ? (
          <div className="admin-content-edit-wrap">
            <textarea
              value={edit}
              onChange={(e) => setEdit(e.target.value)}
              onBlur={handleSave}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setFocused(false);
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSave();
                }
              }}
              rows={Math.min(4, (edit.match(/\n/g) || []).length + 1)}
              autoFocus
            />
            <div className="admin-content-edit-actions">
              <button type="button" className="admin-btn admin-btn--sm admin-btn--secondary" onMouseDown={(e) => { e.preventDefault(); handleSave(); }}>Save</button>
              {hasOverride && (
                <button type="button" className="admin-btn admin-btn--sm admin-btn--secondary" onMouseDown={(e) => { e.preventDefault(); handleReset(); }}>Reset to default</button>
              )}
            </div>
          </div>
        ) : (
          <div
            className="admin-content-display"
            onClick={handleFocus}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleFocus(); } }}
            role="button"
            tabIndex={0}
            title="Click to edit"
          >
            {displayValue || <span className="admin-content-empty">(empty)</span>}
          </div>
        )}
      </td>
    </tr>
  );
}

/** Site-wide UI strings — stored in DB (migration 004). */
export default function AdminTranslationsPanel() {
  const { data: contentData, isLoading: loading, error: queryError } = useAdminContent();
  const updateMutation = useUpdateAdminContentMutation();

  const [overrides, setOverrides] = useState({});
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState('');
  const [langFilter, setLangFilter] = useState('en');
  const [namespaceFilter, setNamespaceFilter] = useState(SECTION_ALL);

  useEffect(() => {
    if (contentData?.overrides) {
      setOverrides(contentData.overrides);
      setApiOverrides(contentData.overrides);
    } else if (queryError) {
      setOverrides(getTranslationOverrides());
      setError(queryError?.message || 'Failed to load content');
    }
  }, [contentData, queryError]);

  const getCurrentValue = (item) => {
    const o = overrides[item.lang]?.[item.namespace]?.[item.key];
    return o !== undefined ? o : item.defaultValue;
  };

  const handleSave = async (lang, namespace, key, value) => {
    const next = JSON.parse(JSON.stringify(overrides));
    if (!next[lang]) next[lang] = {};
    if (!next[lang][namespace]) next[lang][namespace] = {};
    if (value === '' || value == null) {
      delete next[lang][namespace][key];
      if (Object.keys(next[lang][namespace]).length === 0) delete next[lang][namespace];
      if (Object.keys(next[lang]).length === 0) delete next[lang];
    } else {
      next[lang][namespace][key] = value;
    }
    try {
      await updateMutation.mutateAsync(next);
      setToast({ type: 'success', msg: 'Saved to database' });
    } catch (err) {
      console.error(err);
      setTranslationOverrides(next);
      setOverrides(next);
      setApiOverrides(null);
      window.dispatchEvent(new CustomEvent('translations-updated'));
      setToast({ type: 'error', msg: err?.message || 'Failed to save to database. Saved locally in this browser.' });
    }
  };

  const countsByLang = useMemo(() => {
    const m = { en: 0, ar: 0, fr: 0 };
    for (const i of ALL_ITEMS) {
      m[i.lang] = (m[i.lang] || 0) + 1;
    }
    return m;
  }, []);

  const countsByNamespace = useMemo(() => {
    const m = {};
    for (const ns of NAMESPACES) m[ns] = 0;
    for (const i of ALL_ITEMS) {
      if (i.lang === langFilter) m[i.namespace] = (m[i.namespace] || 0) + 1;
    }
    return m;
  }, [langFilter]);

  const filtered = useMemo(() => {
    const valueFor = (item) => {
      const o = overrides[item.lang]?.[item.namespace]?.[item.key];
      return o !== undefined ? o : item.defaultValue;
    };
    let list = ALL_ITEMS.filter((i) => i.lang === langFilter);
    if (namespaceFilter !== SECTION_ALL) {
      list = list.filter((i) => i.namespace === namespaceFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((i) =>
        i.key.toLowerCase().includes(q) ||
        valueFor(i).toLowerCase().includes(q) ||
        i.defaultValue.toLowerCase().includes(q) ||
        i.namespace.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      if (namespaceFilter === SECTION_ALL && a.namespace !== b.namespace) {
        return a.namespace.localeCompare(b.namespace);
      }
      return a.key.localeCompare(b.key);
    });
    return list;
  }, [langFilter, namespaceFilter, search, overrides]);

  const totalForLang = countsByLang[langFilter] ?? 0;

  const overrideCount = useMemo(() => {
    let n = 0;
    for (const lang of Object.keys(overrides)) {
      for (const ns of Object.keys(overrides[lang] || {})) {
        n += Object.keys(overrides[lang][ns] || {}).length;
      }
    }
    return n;
  }, [overrides]);

  const handleClearAll = async () => {
    if (!confirm('Clear all translation overrides? This cannot be undone.')) return;
    try {
      await api.admin.content.save({});
      setOverrides({});
      setApiOverrides({});
      window.dispatchEvent(new CustomEvent('translations-updated'));
      setToast({ type: 'success', msg: 'All overrides cleared' });
    } catch (err) {
      console.error(err);
      setToast({ type: 'error', msg: err?.message || 'Failed to clear' });
    }
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const showNamespace = namespaceFilter === SECTION_ALL;
  const activeSectionBlurb = namespaceFilter === SECTION_ALL
    ? 'Browse every string for the selected language, or narrow by section.'
    : SECTION_META[namespaceFilter]?.blurb || '';

  if (loading) {
    return <div className="admin-empty admin-translations-loading">Loading translations…</div>;
  }

  return (
    <div className="admin-translations">
      {toast && <div className={`admin-toast admin-toast--${toast.type}`} role="status">{toast.msg}</div>}
      {error && (
        <div className="admin-alert admin-alert--warning admin-translations-alert" role="alert">
          <strong>Could not load overrides from the server.</strong> {error} Edits may only be saved in this browser until the API is available.
        </div>
      )}

      <div className="admin-translations-intro">
        <div className="admin-translations-intro__text">
          <h2 className="admin-translations-intro__title">Website &amp; app copy</h2>
          <p className="admin-translations-intro__lead">
            These keys match the bundled strings in <code>client/src/i18n/translations.js</code> (English, Arabic, French).
            Overrides are stored in PostgreSQL and apply to <strong>this website</strong> as soon as visitors reload. Point your{' '}
            <strong>mobile app</strong> at the same API so users see the same wording everywhere.
          </p>
          <ul className="admin-translations-intro__api">
            <li>
              <span className="admin-translations-intro__method">GET</span>{' '}
              <code>/api/admin/content</code> — read overrides (no auth; safe for public cache/CDN if you expose it)
            </li>
            <li>
              <span className="admin-translations-intro__method">PUT</span>{' '}
              <code>/api/admin/content</code> — save overrides (admin only)
            </li>
          </ul>
        </div>
      </div>

      <div className="admin-page-header admin-translations-header">
        <div className="admin-page-title-wrap">
          <p className="admin-subtitle">Edit UI text for EN · AR · FR</p>
          <h2 className="admin-translations-h2">Translation overrides</h2>
        </div>
        <div className="admin-page-header-actions">
          {overrideCount > 0 && (
            <button type="button" className="admin-btn admin-btn--secondary" onClick={handleClearAll}>
              Clear all overrides ({overrideCount})
            </button>
          )}
        </div>
      </div>

      <div className="admin-translations-stats" aria-live="polite">
        <div className="admin-translations-stat">
          <span className="admin-translations-stat__value">{totalForLang}</span>
          <span className="admin-translations-stat__label">Strings in this language</span>
        </div>
        <div className="admin-translations-stat">
          <span className="admin-translations-stat__value">{filtered.length}</span>
          <span className="admin-translations-stat__label">Shown below{search.trim() ? ' (search active)' : ''}</span>
        </div>
        <div className="admin-translations-stat">
          <span className="admin-translations-stat__value">{overrideCount}</span>
          <span className="admin-translations-stat__label">Customised keys (all languages)</span>
        </div>
      </div>

      <div className="admin-card admin-translations-card">
        <div className="admin-card-body">
          <div className="admin-content-filters admin-translations-filters">
            <div className="admin-form-group admin-translations-filter">
              <label htmlFor="at-lang">Language</label>
              <select id="at-lang" value={langFilter} onChange={(e) => setLangFilter(e.target.value)}>
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label} ({countsByLang[l.code] ?? 0} strings)
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-form-group admin-translations-filter">
              <label htmlFor="at-section">Section</label>
              <select id="at-section" value={namespaceFilter} onChange={(e) => setNamespaceFilter(e.target.value)}>
                <option value={SECTION_ALL}>All sections — full app &amp; site ({totalForLang})</option>
                {NAMESPACES.map((ns) => (
                  <option key={ns} value={ns}>
                    {SECTION_META[ns]?.label || ns} ({countsByNamespace[ns] ?? 0})
                  </option>
                ))}
              </select>
              {activeSectionBlurb && <p className="admin-translations-section-hint">{activeSectionBlurb}</p>}
            </div>
            <div className="admin-form-group admin-translations-filter admin-translations-filter--grow">
              <label htmlFor="at-search">Search</label>
              <input
                id="at-search"
                type="search"
                placeholder="Filter by key, current text, or default text…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>

          <p className="admin-content-hint admin-translations-hint">
            Click any <strong>Value</strong> to edit. Press Enter to save, Esc to cancel. “Reset to default” removes your override for that key only.
          </p>

          <div className="admin-content-table-wrap admin-translations-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  {showNamespace && <th className="admin-content-th-section">Section</th>}
                  <th className="admin-content-th-key">Key</th>
                  <th>Value (editable)</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <ContentRow
                    key={`${item.lang}-${item.namespace}-${item.key}`}
                    item={item}
                    currentValue={getCurrentValue(item)}
                    onSave={handleSave}
                    showNamespace={showNamespace}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {filtered.length === 0 && (
            <div className="admin-empty admin-translations-empty">No strings match your filters. Try clearing search or choosing “All sections”.</div>
          )}
        </div>
      </div>
    </div>
  );
}
