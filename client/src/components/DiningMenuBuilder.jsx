import { useCallback, useState } from 'react';
import api, { getImageUrl, fixImageUrlExtension, getImageUrlAlternate } from '../api/client';
import { ACCEPT_IMAGES_WITH_HEIC } from '../utils/imageUploadAccept';
import { menuSectionsToPlainText } from '../utils/diningMenuPlainText';
import './DiningMenuBuilder.css';

function MenuThumb({ url }) {
  const primary = getImageUrl(fixImageUrlExtension(url));
  const altUrl = getImageUrlAlternate(primary) || url;
  const fallback = altUrl !== primary ? getImageUrl(altUrl) : null;
  const [useFallback, setUseFallback] = useState(false);
  const src = useFallback && fallback ? fallback : primary;
  return (
    <img
      className="dining-menu-builder__thumb"
      src={src}
      alt=""
      onError={(e) => {
        if (fallback && !useFallback) setUseFallback(true);
        else e.target.style.display = 'none';
      }}
    />
  );
}

export default function DiningMenuBuilder({ sections, placeId, disabled, onChange, onUploadError }) {
  const [busy, setBusy] = useState(null);

  const sync = useCallback(
    (next) => {
      onChange({
        diningMenuSections: next,
        diningMenuPlain: menuSectionsToPlainText(next),
      });
    },
    [onChange]
  );

  const updateSection = (si, patch) => {
    const next = sections.map((s, i) => (i === si ? { ...s, ...patch } : s));
    sync(next);
  };

  const updateItem = (si, ii, patch) => {
    const next = sections.map((s, i) => {
      if (i !== si) return s;
      const items = s.items.map((it, j) => (j === ii ? { ...it, ...patch } : it));
      return { ...s, items };
    });
    sync(next);
  };

  const addSection = () => {
    sync([
      ...sections,
      { title: `Section ${sections.length + 1}`, note: '', items: [{ name: '', price: '', description: '', badge: '', image: '' }] },
    ]);
  };

  const removeSection = (si) => {
    if (sections.length <= 1) {
      sync([{ title: 'Menu', note: '', items: [] }]);
      return;
    }
    sync(sections.filter((_, i) => i !== si));
  };

  const addItem = (si) => {
    const next = sections.map((s, i) =>
      i === si ? { ...s, items: [...s.items, { name: '', price: '', description: '', badge: '', image: '' }] } : s
    );
    sync(next);
  };

  const removeItem = (si, ii) => {
    const next = sections.map((s, i) => {
      if (i !== si) return s;
      const items = s.items.filter((_, j) => j !== ii);
      return { ...s, items: items.length ? items : [{ name: '', price: '', description: '', badge: '', image: '' }] };
    });
    sync(next);
  };

  const uploadKey = (si, ii) => `${si}-${ii}`;

  const onPickFile = async (si, ii, file) => {
    if (!file || !placeId) return;
    const key = uploadKey(si, ii);
    setBusy(key);
    try {
      const url = await api.business.upload(file, placeId);
      if (url) updateItem(si, ii, { image: String(url).trim() });
    } catch (e) {
      const msg = e?.message || 'Upload failed';
      if (typeof onUploadError === 'function') onUploadError(msg);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="dining-menu-builder">
      <p className="business-hint dining-menu-builder__intro">
        Add sections, then dishes one by one. Upload a photo for each dish if you like. No JSON required.
      </p>
      {sections.map((sec, si) => (
        <div key={`sec-${si}`} className="dining-menu-builder__section">
          <div className="dining-menu-builder__section-head">
            <label className="dining-menu-builder__label">
              Section title
              <input
                className="business-input"
                value={sec.title}
                onChange={(e) => updateSection(si, { title: e.target.value })}
                placeholder="e.g. Breakfast, Grills, Desserts"
                disabled={disabled}
              />
            </label>
            <button
              type="button"
              className="business-btn business-btn--ghost dining-menu-builder__remove-sec"
              onClick={() => removeSection(si)}
              disabled={disabled}
            >
              Remove section
            </button>
          </div>
          <label className="dining-menu-builder__label">
            Section note (optional)
            <input
              className="business-input"
              value={sec.note || ''}
              onChange={(e) => updateSection(si, { note: e.target.value })}
              placeholder="e.g. Served until noon"
              disabled={disabled}
            />
          </label>

          <div className="dining-menu-builder__items">
            {(sec.items || []).map((item, ii) => (
              <div key={`item-${si}-${ii}`} className="dining-menu-builder__item">
                <div className="dining-menu-builder__item-visual">
                  {item.image ? <MenuThumb url={item.image} /> : <div className="dining-menu-builder__thumb dining-menu-builder__thumb--empty" />}
                  <div className="dining-menu-builder__upload-row">
                    <input
                      type="file"
                      accept={ACCEPT_IMAGES_WITH_HEIC}
                      style={{ display: 'none' }}
                      id={`dmb-f-${si}-${ii}`}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        if (f) onPickFile(si, ii, f);
                      }}
                      disabled={disabled || !placeId}
                    />
                    <label
                      htmlFor={`dmb-f-${si}-${ii}`}
                      className="business-btn business-btn--ghost"
                      style={{ cursor: disabled || !placeId || busy === uploadKey(si, ii) ? 'not-allowed' : 'pointer' }}
                    >
                      {busy === uploadKey(si, ii) ? 'Uploading' : 'Upload image'}
                    </label>
                    {item.image ? (
                      <button
                        type="button"
                        className="business-btn business-btn--ghost"
                        disabled={disabled}
                        onClick={() => updateItem(si, ii, { image: '' })}
                      >
                        Remove photo
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="dining-menu-builder__item-fields">
                  <input
                    className="business-input"
                    value={item.name}
                    onChange={(e) => updateItem(si, ii, { name: e.target.value })}
                    placeholder="Dish name"
                    disabled={disabled}
                  />
                  <div className="dining-menu-builder__row2">
                    <input
                      className="business-input"
                      value={item.price}
                      onChange={(e) => updateItem(si, ii, { price: e.target.value })}
                      placeholder="Price"
                      disabled={disabled}
                    />
                    <input
                      className="business-input"
                      value={item.badge}
                      onChange={(e) => updateItem(si, ii, { badge: e.target.value })}
                      placeholder="Badge (e.g. Chef pick)"
                      disabled={disabled}
                    />
                  </div>
                  <textarea
                    className="business-textarea dining-menu-builder__desc"
                    rows={2}
                    value={item.description}
                    onChange={(e) => updateItem(si, ii, { description: e.target.value })}
                    placeholder="Description"
                    disabled={disabled}
                  />
                  <button
                    type="button"
                    className="business-btn business-btn--ghost dining-menu-builder__remove-item"
                    onClick={() => removeItem(si, ii)}
                    disabled={disabled}
                  >
                    Remove dish
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="business-btn business-btn--ghost" onClick={() => addItem(si)} disabled={disabled}>
            + Add dish to this section
          </button>
        </div>
      ))}

      <button type="button" className="business-btn business-btn--primary dining-menu-builder__add-sec" onClick={addSection} disabled={disabled}>
        + Add menu section
      </button>
    </div>
  );
}
