import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { mergeWithSiteSettingsDefaults, mergeDiningGuide } from '../../config/siteSettingsDefaults';
import { getCategoriesForWay } from '../../utils/findYourWayGrouping';
import { DINING_PATH } from '../../utils/discoverPaths';
import './Admin.css';
import './AdminDiningGuide.css';

const LOCALE_TABS = [
  { id: 'en', label: 'English' },
  { id: 'ar', label: 'العربية' },
  { id: 'fr', label: 'Français' },
];

export default function AdminDiningGuide() {
  const [full, setFull] = useState(() => mergeWithSiteSettingsDefaults({}));
  const [dining, setDining] = useState(() => mergeDiningGuide({}));
  const [localeTab, setLocaleTab] = useState('en');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [saved, setSaved] = useState(false);

  const [categories, setCategories] = useState([]);
  const [places, setPlaces] = useState([]);

  const [featQ, setFeatQ] = useState('');
  const [featResults, setFeatResults] = useState([]);
  const [featSearching, setFeatSearching] = useState(false);
  const [hidQ, setHidQ] = useState('');
  const [hidResults, setHidResults] = useState([]);
  const [hidSearching, setHidSearching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.admin.siteSettings
      .get()
      .then((r) => {
        if (cancelled) return;
        const server = r.settings && typeof r.settings === 'object' ? r.settings : {};
        const merged = mergeWithSiteSettingsDefaults(server);
        setFull(merged);
        setDining(mergeDiningGuide(server.diningGuide));
      })
      .catch(() => {
        if (cancelled) return;
        const merged = mergeWithSiteSettingsDefaults({});
        setFull(merged);
        setDining(merged.diningGuide);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    api.categories
      .list({ lang: 'en' })
      .then((r) => setCategories(Array.isArray(r?.categories) ? r.categories : []))
      .catch(() => setCategories([]));
    api.places
      .list({ lang: 'en' })
      .then((r) => {
        const raw = r?.popular || r?.locations || [];
        setPlaces(Array.isArray(raw) ? raw : []);
      })
      .catch(() => setPlaces([]));
  }, []);

  const foodCategoryIds = useMemo(() => {
    const ways = getCategoriesForWay('food', categories);
    return new Set(ways.map((c) => String(c.id)));
  }, [categories]);

  const placeById = useMemo(() => {
    const m = new Map();
    places.forEach((p) => {
      if (p?.id != null) m.set(String(p.id), p);
    });
    return m;
  }, [places]);

  const featuredOffFoodWay = useMemo(() => {
    const ids = dining.featuredPlaceIds || [];
    return ids.filter((id) => {
      const p = placeById.get(String(id));
      if (!p) return false;
      return !foodCategoryIds.has(String(p.categoryId ?? p.category_id));
    });
  }, [dining.featuredPlaceIds, placeById, foodCategoryIds]);

  useEffect(() => {
    const q = featQ.trim();
    if (q.length < 2) {
      setFeatResults([]);
      return undefined;
    }
    const tid = window.setTimeout(() => {
      setFeatSearching(true);
      api.admin.places
        .list({ q, limit: 25 })
        .then((r) => setFeatResults(Array.isArray(r?.places) ? r.places : []))
        .catch(() => setFeatResults([]))
        .finally(() => setFeatSearching(false));
    }, 280);
    return () => window.clearTimeout(tid);
  }, [featQ]);

  useEffect(() => {
    const q = hidQ.trim();
    if (q.length < 2) {
      setHidResults([]);
      return undefined;
    }
    const tid = window.setTimeout(() => {
      setHidSearching(true);
      api.admin.places
        .list({ q, limit: 25 })
        .then((r) => setHidResults(Array.isArray(r?.places) ? r.places : []))
        .catch(() => setHidResults([]))
        .finally(() => setHidSearching(false));
    }, 280);
    return () => window.clearTimeout(tid);
  }, [hidQ]);

  const patchHero = useCallback((loc, field, value) => {
    setDining((d) => ({
      ...d,
      hero: {
        ...d.hero,
        [loc]: { ...d.hero[loc], [field]: value },
      },
    }));
  }, []);

  const patchSectionLabels = useCallback((loc, field, value) => {
    setDining((d) => ({
      ...d,
      sectionLabels: {
        ...d.sectionLabels,
        [loc]: { ...d.sectionLabels[loc], [field]: value },
      },
    }));
  }, []);

  const addFeatured = (place) => {
    const id = String(place.id);
    const hidden = new Set((dining.hiddenPlaceIds || []).map(String));
    if (hidden.has(id)) return;
    if ((dining.featuredPlaceIds || []).some((x) => String(x) === id)) return;
    setDining((d) => ({ ...d, featuredPlaceIds: [...(d.featuredPlaceIds || []), id] }));
    setFeatQ('');
    setFeatResults([]);
  };

  const removeFeatured = (id) => {
    setDining((d) => ({
      ...d,
      featuredPlaceIds: (d.featuredPlaceIds || []).filter((x) => String(x) !== String(id)),
    }));
  };

  const moveFeatured = (index, delta) => {
    setDining((d) => {
      const arr = [...(d.featuredPlaceIds || [])];
      const j = index + delta;
      if (j < 0 || j >= arr.length) return d;
      const next = [...arr];
      [next[index], next[j]] = [next[j], next[index]];
      return { ...d, featuredPlaceIds: next };
    });
  };

  const addHidden = (place) => {
    const id = String(place.id);
    if ((dining.hiddenPlaceIds || []).some((x) => String(x) === id)) return;
    setDining((d) => ({
      ...d,
      hiddenPlaceIds: [...(dining.hiddenPlaceIds || []), id],
      featuredPlaceIds: (d.featuredPlaceIds || []).filter((x) => String(x) !== id),
    }));
    setHidQ('');
    setHidResults([]);
  };

  const removeHidden = (id) => {
    setDining((d) => ({
      ...d,
      hiddenPlaceIds: (d.hiddenPlaceIds || []).filter((x) => String(x) !== String(id)),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    try {
      const payload = { ...full, diningGuide: dining };
      const r = await api.admin.siteSettings.save(payload);
      const merged = mergeWithSiteSettingsDefaults(r.settings && typeof r.settings === 'object' ? r.settings : payload);
      setFull(merged);
      setDining(mergeDiningGuide(merged.diningGuide));
      window.dispatchEvent(new Event('tripoli-site-settings-saved'));
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3000);
    } catch (ex) {
      setErr(ex.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const loc = localeTab;
  const h = dining.hero?.[loc] || {};
  const sl = dining.sectionLabels?.[loc] || {};

  if (loading) {
    return (
      <div className="admin-page-content">
        <p className="admin-form-hint">Loading dining guide settings…</p>
      </div>
    );
  }

  return (
    <div className="admin-page-content">
      <div className="admin-page-header">
        <div className="admin-page-title-wrap">
          <h1 className="admin-page-title">Dining guide</h1>
          <p className="admin-subtitle">
            Controls the public <Link to={DINING_PATH}>/dining</Link> page: hero copy, imagery, curated order, exclusions, and section
            titles. Listings use the same <strong>food</strong> theme as the home map — set categories in{' '}
            <Link to="../categories">Categories</Link>. Sponsored cards use surface <strong>Dining</strong> on{' '}
            <Link to="../sponsored-places">Sponsored places</Link> (subject to Settings → feature toggles).
          </p>
        </div>
        <Link to={DINING_PATH} className="admin-btn admin-btn--secondary" target="_blank" rel="noreferrer">
          Open public page
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="adg-form">
        {err ? (
          <div className="admin-error" role="alert">
            {err}
          </div>
        ) : null}
        {saved ? (
          <div className="admin-toast admin-toast--success" style={{ position: 'relative', marginBottom: '1rem' }} role="status">
            Dining guide saved.
          </div>
        ) : null}

        <div className="admin-card" style={{ gridColumn: 'span 12' }}>
          <div className="admin-card-header">
            <h2 className="admin-card-title">Availability</h2>
          </div>
          <div className="admin-card-body">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={dining.enabled !== false}
                onChange={(e) => setDining((d) => ({ ...d, enabled: e.target.checked }))}
              />
              Dining guide page enabled (when off, /dining redirects visitors to Discover)
            </label>
            <div style={{ height: '0.85rem' }} />
            <p className="admin-form-hint" style={{ marginTop: 0 }}>
              Page sections (these only affect /dining; sponsored placements also depend on Settings → Sponsored places).
            </p>
            <div className="admin-form-row">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={dining.sections?.sponsored !== false}
                  onChange={(e) =>
                    setDining((d) => ({ ...d, sections: { ...(d.sections || {}), sponsored: e.target.checked } }))
                  }
                />
                Show sponsored rail section
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={dining.sections?.topPicks !== false}
                  onChange={(e) =>
                    setDining((d) => ({ ...d, sections: { ...(d.sections || {}), topPicks: e.target.checked } }))
                  }
                />
                Show “Top picks” rail section
              </label>
            </div>
          </div>
        </div>

        <div className="admin-card" style={{ gridColumn: 'span 12' }}>
          <div className="admin-card-header">
            <h2 className="admin-card-title">Hero image (optional)</h2>
          </div>
          <div className="admin-card-body">
            <div className="admin-form-group">
              <label htmlFor="adg-hero-img">Image URL</label>
              <input
                id="adg-hero-img"
                type="url"
                value={dining.heroImageUrl || ''}
                onChange={(e) => setDining((d) => ({ ...d, heroImageUrl: e.target.value }))}
                placeholder="https://…"
              />
              <p className="admin-form-hint">Full-width background behind the hero text (same idea as home bento hero).</p>
            </div>
          </div>
        </div>

        <div className="admin-card" style={{ gridColumn: 'span 12' }}>
          <div className="admin-card-header">
            <h2 className="admin-card-title">Hero copy & section titles</h2>
          </div>
          <div className="admin-card-body">
            <div className="adg-locale-tabs" role="tablist" aria-label="Locale">
              {LOCALE_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={localeTab === tab.id}
                  className={`adg-locale-tab ${localeTab === tab.id ? 'adg-locale-tab--on' : ''}`}
                  onClick={() => setLocaleTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="admin-form-row">
                <div className="admin-form-group">
                  <label htmlFor={`adg-kicker-${loc}`}>Kicker / eyebrow</label>
                  <input
                    id={`adg-kicker-${loc}`}
                    value={h.kicker || ''}
                    onChange={(e) => patchHero(loc, 'kicker', e.target.value)}
                    placeholder="Empty = app translation default"
                  />
                </div>
                <div className="admin-form-group">
                  <label htmlFor={`adg-title-${loc}`}>Title</label>
                  <input
                    id={`adg-title-${loc}`}
                    value={h.title || ''}
                    onChange={(e) => patchHero(loc, 'title', e.target.value)}
                    placeholder="Empty = app translation default"
                  />
                </div>
            </div>
            <div className="admin-form-group">
              <label htmlFor={`adg-sub-${loc}`}>Subtitle</label>
              <textarea
                id={`adg-sub-${loc}`}
                rows={3}
                value={h.subtitle || ''}
                onChange={(e) => patchHero(loc, 'subtitle', e.target.value)}
                placeholder="Empty = app translation default"
              />
            </div>
            <hr style={{ border: 0, borderTop: '1px solid #e5e7eb', margin: '1.25rem 0' }} />
            <p className="admin-form-hint" style={{ marginTop: 0 }}>
              Optional section title overrides for this locale (empty = translation file defaults).
            </p>
            <div className="admin-form-row admin-form-row--3">
              <div className="admin-form-group">
                <label htmlFor={`adg-sl-sponsored-${loc}`}>Sponsored rail title</label>
                <input
                  id={`adg-sl-sponsored-${loc}`}
                  value={sl.sponsoredKicker || ''}
                  onChange={(e) => patchSectionLabels(loc, 'sponsoredKicker', e.target.value)}
                />
              </div>
              <div className="admin-form-group">
                <label htmlFor={`adg-sl-top-${loc}`}>Top picks title</label>
                <input
                  id={`adg-sl-top-${loc}`}
                  value={sl.topPicksTitle || ''}
                  onChange={(e) => patchSectionLabels(loc, 'topPicksTitle', e.target.value)}
                />
              </div>
              <div className="admin-form-group">
                <label htmlFor={`adg-sl-main-${loc}`}>Main collection (screen-reader)</label>
                <input
                  id={`adg-sl-main-${loc}`}
                  value={sl.mainCollectionTitle || ''}
                  onChange={(e) => patchSectionLabels(loc, 'mainCollectionTitle', e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="admin-card" style={{ gridColumn: 'span 12' }}>
          <div className="admin-card-header">
            <h2 className="admin-card-title">Featured order (curated rail & list priority)</h2>
          </div>
          <div className="admin-card-body">
            {featuredOffFoodWay.length ? (
              <p className="admin-form-hint" style={{ color: '#b45309', marginTop: 0 }}>
                Some featured IDs are not in the food-way category set — they will not appear on /dining until their category matches:{' '}
                {featuredOffFoodWay.join(', ')}
              </p>
            ) : null}
            <ol className="adg-ordered-list">
              {(dining.featuredPlaceIds || []).map((id, index) => (
                <li key={String(id)} className="adg-ordered-item">
                  <div className="adg-ordered-item-main">
                    <span className="adg-ordered-name">{placeById.get(String(id))?.name || id}</span>
                    <span className="adg-ordered-meta">{String(id)}</span>
                  </div>
                  <div className="adg-ordered-actions">
                    <button
                      type="button"
                      className="admin-btn admin-btn--secondary admin-btn--sm"
                      onClick={() => moveFeatured(index, -1)}
                      disabled={index === 0}
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn--secondary admin-btn--sm"
                      onClick={() => moveFeatured(index, 1)}
                      disabled={index >= (dining.featuredPlaceIds || []).length - 1}
                    >
                      Down
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn--secondary admin-btn--sm"
                      onClick={() => removeFeatured(id)}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ol>
            <div className="admin-form-group" style={{ marginTop: '1rem' }}>
              <label htmlFor="adg-feat-search">Add place (search)</label>
              <input
                id="adg-feat-search"
                value={featQ}
                onChange={(e) => setFeatQ(e.target.value)}
                placeholder="Type at least 2 characters…"
                autoComplete="off"
              />
              <p className="admin-form-hint">{featSearching ? 'Searching…' : ' '}</p>
              {featResults.length > 0 ? (
                <ul className="adg-search-results">
                  {featResults.map((p) => (
                    <li key={p.id}>
                      <button type="button" className="adg-search-pick" onClick={() => addFeatured(p)}>
                        <span className="adg-search-pick-name">{p.name}</span>
                        <span className="adg-search-pick-sub">{p.location || p.id}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </div>

        <div className="admin-card" style={{ gridColumn: 'span 12' }}>
          <div className="admin-card-header">
            <h2 className="admin-card-title">Hidden from dining</h2>
          </div>
          <div className="admin-card-body">
            <p className="admin-form-hint" style={{ marginTop: 0 }}>
              Excluded even when the place category is in the food theme (e.g. duplicate listings).
            </p>
            <ul className="adg-chip-list">
              {(dining.hiddenPlaceIds || []).map((id) => (
                <li key={String(id)} className="adg-chip">
                  <span>{placeById.get(String(id))?.name || id}</span>
                  <button type="button" className="adg-chip-remove" onClick={() => removeHidden(id)} aria-label="Remove">
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <div className="admin-form-group">
              <label htmlFor="adg-hid-search">Add to hidden</label>
              <input
                id="adg-hid-search"
                value={hidQ}
                onChange={(e) => setHidQ(e.target.value)}
                placeholder="Search places…"
                autoComplete="off"
              />
              <p className="admin-form-hint">{hidSearching ? 'Searching…' : ' '}</p>
              {hidResults.length > 0 ? (
                <ul className="adg-search-results">
                  {hidResults.map((p) => (
                    <li key={p.id}>
                      <button type="button" className="adg-search-pick" onClick={() => addHidden(p)}>
                        <span className="adg-search-pick-name">{p.name}</span>
                        <span className="adg-search-pick-sub">{p.location || p.id}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </div>

        <div className="adg-form-actions">
          <button type="submit" className="admin-btn admin-btn--primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save dining guide'}
          </button>
          <Link to={DINING_PATH} className="admin-btn admin-btn--secondary" target="_blank" rel="noreferrer">
            Preview /dining
          </Link>
        </div>
      </form>
    </div>
  );
}
