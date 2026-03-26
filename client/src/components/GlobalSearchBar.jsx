import { useState, useEffect, useRef, useMemo, useDeferredValue } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import Icon from './Icon';
import { filterPlacesByQuery } from '../utils/searchFilter';
import { PLACES_DISCOVER_PATH } from '../utils/discoverPaths';
import './GlobalSearchBar.css';

const MAX_SUGGESTIONS = 8;

export default function GlobalSearchBar({
  className = '',
  autoFocus = false,
  onPick,
  onEscape,
  idPrefix = 'global-search',
  endAdornment = null,
}) {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const deferredQ = useDeferredValue(query);
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  const langParam = lang === 'ar' ? 'ar' : lang === 'fr' ? 'fr' : 'en';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.places
      .list({ lang: langParam })
      .then((r) => {
        if (!cancelled) {
          const list = r.popular || r.locations || [];
          setPlaces(Array.isArray(list) ? list : []);
        }
      })
      .catch(() => {
        if (!cancelled) setPlaces([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [langParam]);

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const suggestions = useMemo(() => {
    const q = deferredQ.trim();
    if (q.length < 1) return [];
    return filterPlacesByQuery(places, q).slice(0, MAX_SUGGESTIONS);
  }, [places, deferredQ]);

  const showPanel = open && focused && query.trim().length >= 1;
  const listId = `${idPrefix}-listbox`;

  function goPlace(p) {
    navigate(`/place/${p.id}`);
    setQuery('');
    setOpen(false);
    setFocused(false);
    onPick?.();
  }

  function goDiscoverAll() {
    const q = query.trim();
    navigate(`${PLACES_DISCOVER_PATH}${q ? `?q=${encodeURIComponent(q)}` : ''}`);
    setQuery('');
    setOpen(false);
    setFocused(false);
    onPick?.();
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      onEscape?.();
      setOpen(false);
      inputRef.current?.blur();
      setFocused(false);
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestions.length > 0) goPlace(suggestions[0]);
      else goDiscoverAll();
    }
  }

  return (
    <div className={`global-search-bar ${className}`.trim()} ref={wrapRef}>
      <div className="global-search-bar__inner">
        <Icon name="search" size={20} className="global-search-bar__icon" aria-hidden />
        <input
          ref={inputRef}
          type="search"
          className="global-search-bar__input"
          placeholder={t('placeDiscover', 'searchPlaceholder')}
          aria-label={t('nav', 'search')}
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={showPanel}
          autoComplete="off"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setFocused(true);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
        />
        {query ? (
          <button
            type="button"
            className="global-search-bar__clear"
            onClick={() => {
              setQuery('');
              setOpen(false);
              inputRef.current?.focus();
            }}
            aria-label={t('placeDiscover', 'clearSearch')}
          >
            <Icon name="close" size={18} />
          </button>
        ) : null}
        {endAdornment}
      </div>
      {showPanel ? (
        <div id={listId} className="global-search-bar__panel" role="listbox" aria-label={t('nav', 'search')}>
          {loading ? <p className="global-search-bar__meta">{t('detail', 'loading')}</p> : null}
          {!loading && suggestions.length === 0 ? (
            <p className="global-search-bar__empty">{t('nav', 'globalSearchNoResults')}</p>
          ) : null}
          {!loading
            && suggestions.map((p) => (
              <button
                key={p.id}
                type="button"
                role="option"
                className="global-search-bar__option"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => goPlace(p)}
              >
                <span className="global-search-bar__option-name">{p.name}</span>
                {p.location ? <span className="global-search-bar__option-loc">{p.location}</span> : null}
              </button>
            ))}
          {!loading && query.trim().length >= 1 ? (
            <button type="button" className="global-search-bar__see-all" onClick={goDiscoverAll}>
              {t('nav', 'globalSearchSeeAll')}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
