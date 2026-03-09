import { useState, useEffect, useMemo, useRef } from 'react';
import { translations, getTranslationOverrides, setTranslationOverrides, setApiOverrides } from '../../i18n/translations';
import { api } from '../../api/client';
import './Admin.css';

/** Flatten translations into editable items */
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
const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية' },
  { code: 'fr', label: 'Français' },
];

function ContentRow({ item, currentValue, onSave }) {
  const [edit, setEdit] = useState('');
  const [focused, setFocused] = useState(false);
  const rowRef = useRef(null);

  const hasOverride = currentValue !== item.defaultValue;
  const displayValue = currentValue;

  const handleFocus = () => {
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

  useEffect(() => {
    if (focused) setEdit(displayValue);
  }, [focused, displayValue]);

  return (
    <tr ref={rowRef} className={`admin-content-row${focused ? ' admin-content-row--editing' : ''}`}>
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
                <button type="button" className="admin-btn admin-btn--sm admin-btn--secondary" onMouseDown={(e) => { e.preventDefault(); handleReset(); }}>Reset</button>
              )}
            </div>
          </div>
        ) : (
          <div
            className="admin-content-display"
            onClick={handleFocus}
            title="Click to edit"
          >
            {displayValue || <span className="admin-content-empty">(empty)</span>}
          </div>
        )}
      </td>
    </tr>
  );
}

export default function AdminContent() {
  const [overrides, setOverrides] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState('');
  const [langFilter, setLangFilter] = useState('en');
  const [namespaceFilter, setNamespaceFilter] = useState(NAMESPACES[0] || 'nav');

  useEffect(() => {
    api.admin.content.get()
      .then((res) => {
        const data = res?.overrides || {};
        setOverrides(data);
        setApiOverrides(data);
        setError(null);
      })
      .catch((err) => {
        setOverrides(getTranslationOverrides());
        setError(err?.message || 'Failed to load content');
      })
      .finally(() => setLoading(false));
  }, []);

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
      const res = await api.admin.content.save(next);
      const data = res?.overrides || next;
      setOverrides(data);
      setApiOverrides(data);
      window.dispatchEvent(new CustomEvent('translations-updated'));
      setToast({ type: 'success', msg: 'Saved' });
    } catch (err) {
      console.error(err);
      setTranslationOverrides(next);
      setOverrides(next);
      setApiOverrides(null);
      window.dispatchEvent(new CustomEvent('translations-updated'));
      setToast({ type: 'error', msg: err?.message || 'Failed to save to database. Saved locally.' });
    }
  };

  const filtered = useMemo(() => {
    let list = ALL_ITEMS.filter((i) => i.lang === langFilter && i.namespace === namespaceFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((i) =>
        i.key.toLowerCase().includes(q) ||
        getCurrentValue(i).toLowerCase().includes(q) ||
        i.defaultValue.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => a.key.localeCompare(b.key));
  }, [langFilter, namespaceFilter, search, overrides]);

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
      setToast({ type: 'success', msg: 'Cleared' });
    } catch (err) {
      console.error(err);
      setToast({ type: 'error', msg: err?.message || 'Failed to clear' });
    }
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  if (loading) {
    return (
      <div className="admin-page-content">
        <div className="admin-empty">Loading content…</div>
      </div>
    );
  }

  return (
    <div className="admin-page-content">
      {toast && <div className={`admin-toast admin-toast--${toast.type}`}>{toast.msg}</div>}
      {error && (
        <div className="admin-alert admin-alert--warning" style={{ marginBottom: 16 }}>
          {error}. Saving will persist to the database when the migration is applied.
        </div>
      )}
      <div className="admin-page-header">
        <div className="admin-page-title-wrap">
          <p className="admin-subtitle">Edit every text on the website</p>
          <h1>Content & translations</h1>
        </div>
        <div className="admin-page-header-actions">
          {overrideCount > 0 && (
            <button type="button" className="admin-btn admin-btn--secondary" onClick={handleClearAll}>
              Clear all overrides ({overrideCount})
            </button>
          )}
        </div>
      </div>

      <div className="admin-widgets admin-dashboard-grid" style={{ gridTemplateColumns: 'repeat(12, 1fr)' }}>
        <div className="admin-card" style={{ gridColumn: 'span 12' }}>
          <div className="admin-card-header">
            <h2 className="admin-card-title">Translation strings</h2>
          </div>
          <div className="admin-card-body">
            <div className="admin-content-filters">
              <div className="admin-form-group" style={{ marginBottom: 0, minWidth: 200 }}>
                <label>Language</label>
                <select value={langFilter} onChange={(e) => setLangFilter(e.target.value)}>
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
              </div>
              <div className="admin-form-group" style={{ marginBottom: 0, minWidth: 180 }}>
                <label>Section</label>
                <select value={namespaceFilter} onChange={(e) => setNamespaceFilter(e.target.value)}>
                  {NAMESPACES.map((ns) => (
                    <option key={ns} value={ns}>{ns}</option>
                  ))}
                </select>
              </div>
              <div className="admin-form-group" style={{ marginBottom: 0, flex: 1 }}>
                <label>Search</label>
                <input
                  type="search"
                  placeholder="Search keys or text…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <p className="admin-content-hint">Click any text to edit. Changes apply immediately across the site.</p>

            <div className="admin-content-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th style={{ width: '30%' }}>Key</th>
                    <th>Value (click to edit)</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <ContentRow
                      key={`${item.lang}-${item.namespace}-${item.key}`}
                      item={item}
                      currentValue={getCurrentValue(item)}
                      onSave={handleSave}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {filtered.length === 0 && (
              <div className="admin-empty">No strings match your filters.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
