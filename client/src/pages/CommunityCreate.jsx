import { useState, useCallback, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import Icon from '../components/Icon';
import { COMMUNITY_PATH } from '../utils/discoverPaths';
import './CommunityCreate.css';

function parseCommaList(s) {
  return String(s || '')
    .split(/[,;\n]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseTaggedIds(s) {
  return parseCommaList(s).slice(0, 40);
}

const LOOK_PRESETS = [
  { id: '', labelKey: 'communityCreateLookOriginal' },
  { id: 'warm', labelKey: 'communityCreateLookWarm' },
  { id: 'cool', labelKey: 'communityCreateLookCool' },
  { id: 'bw', labelKey: 'communityCreateLookBw' },
  { id: 'vivid', labelKey: 'communityCreateLookVivid' },
  { id: 'fade', labelKey: 'communityCreateLookFade' },
];

const STICKER_PICKS = ['📍', '✨', '❤️', '🔥', '☕', '📸', '⭐', '🌙'];

export default function CommunityCreate() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [placeSearch, setPlaceSearch] = useState('');
  const [placeHits, setPlaceHits] = useState([]);
  const [placeSearchLoading, setPlaceSearchLoading] = useState(false);
  const [linkedPlaceId, setLinkedPlaceId] = useState('');
  const [placeLabel, setPlaceLabel] = useState('');
  const [linkedInfo, setLinkedInfo] = useState(null);
  const [manualId, setManualId] = useState(false);
  const [manualPlaceId, setManualPlaceId] = useState('');

  const [kind, setKind] = useState('post');
  const [caption, setCaption] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [advanced, setAdvanced] = useState(false);
  const [overlayText, setOverlayText] = useState('');
  const [overlayPosition, setOverlayPosition] = useState('bottom');
  const [mediaFilter, setMediaFilter] = useState('');
  const [soundtrackUrl, setSoundtrackUrl] = useState('');
  const [effectsText, setEffectsText] = useState('');
  const [stickersText, setStickersText] = useState('');
  const [stickerPicks, setStickerPicks] = useState([]);
  const [taggedText, setTaggedText] = useState('');
  const [locationLabel, setLocationLabel] = useState('');
  const [coords, setCoords] = useState(null);
  const searchSeq = useRef(0);

  const effectivePlaceId = manualId ? manualPlaceId.trim() : linkedPlaceId;

  useEffect(() => {
    const q = placeSearch.trim();
    if (q.length < 2) {
      setPlaceHits([]);
      return undefined;
    }
    const seq = ++searchSeq.current;
    const tmr = setTimeout(() => {
      setPlaceSearchLoading(true);
      api.user.feed
        .placeSearch(q)
        .then((r) => {
          if (seq !== searchSeq.current) return;
          setPlaceHits(Array.isArray(r?.places) ? r.places : []);
        })
        .catch(() => {
          if (seq !== searchSeq.current) return;
          setPlaceHits([]);
        })
        .finally(() => {
          if (seq === searchSeq.current) setPlaceSearchLoading(false);
        });
    }, 380);
    return () => clearTimeout(tmr);
  }, [placeSearch]);

  const pickPlace = useCallback((p) => {
    if (!p?.id) return;
    setLinkedPlaceId(p.id);
    setPlaceLabel(p.name || p.id);
    setLinkedInfo(p);
    setPlaceSearch(p.name || p.id);
    setPlaceHits([]);
    setManualId(false);
    setError(null);
  }, []);

  const toggleStickerPick = useCallback((emoji) => {
    setStickerPicks((prev) => {
      const has = prev.includes(emoji);
      if (has) return prev.filter((x) => x !== emoji);
      if (prev.length >= 12) return prev;
      return [...prev, emoji];
    });
  }, []);

  const onPickFile = useCallback(
    async (file) => {
      const pid = effectivePlaceId;
      if (!pid) {
        setError(t('discover', 'communityCreatePlaceRequired'));
        return;
      }
      if (!file) return;
      setUploading(true);
      setError(null);
      try {
        const url = await api.user.feed.upload(file, pid, {
          purpose: kind === 'reel' ? 'reel' : undefined,
        });
        if (url) setMediaUrl(url);
      } catch (e) {
        setError(e?.message || String(e));
      } finally {
        setUploading(false);
      }
    },
    [effectivePlaceId, kind, t]
  );

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError(t('discover', 'communityCreateNoGeo'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => setError(t('discover', 'communityCreateGeoDenied'))
    );
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const pid = effectivePlaceId;
    if (!pid) {
      setError(t('discover', 'communityCreatePlaceRequired'));
      return;
    }
    const cap = caption.trim();
    if (!cap) {
      setError(t('discover', 'communityCreateCaptionRequired'));
      return;
    }
    const url = mediaUrl.trim();
    if (!url) {
      setError(t('discover', 'communityCreateMediaRequired'));
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        placeId: pid,
        caption: cap,
        type: kind === 'reel' ? 'reel' : 'post',
        ...(kind === 'reel' ? { video_url: url } : { image_urls: [url], image_url: url }),
      };
      if (overlayText.trim()) body.overlay_text = overlayText.trim();
      if (overlayPosition && overlayPosition !== 'bottom') body.overlay_position = overlayPosition;
      if (mediaFilter) body.media_filter = mediaFilter;
      if (soundtrackUrl.trim()) body.soundtrack_url = soundtrackUrl.trim();
      const effects = parseCommaList(effectsText);
      if (effects.length) body.effects = effects;
      const stickerMerge = [...new Set([...stickerPicks, ...parseCommaList(stickersText)])].filter(Boolean).slice(0, 30);
      if (stickerMerge.length) body.stickers = stickerMerge;
      const tagged = parseTaggedIds(taggedText);
      if (tagged.length) body.tagged_user_ids = tagged;
      if (locationLabel.trim()) body.location_label = locationLabel.trim();
      if (coords) body.location_coords = coords;

      const r = await api.user.feed.create(body);
      const id = r?.post?.id;
      if (id) {
        navigate(`${COMMUNITY_PATH}${kind === 'reel' ? '?tab=reel' : '?tab=feed'}#feed-post-${id}`);
      } else {
        navigate(COMMUNITY_PATH);
      }
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const filterClass = mediaFilter ? `cc-preview-media cc-filter--${mediaFilter}` : 'cc-preview-media';

  return (
    <div className="cc-root">
      <header className="cc-head">
        <Link to={COMMUNITY_PATH} className="cc-back">
          <Icon name="arrow_back" size={22} aria-hidden />
          {t('discover', 'communityCreateBack')}
        </Link>
        <h1 className="cc-title">{t('discover', 'communityCreateTitle')}</h1>
        <p className="cc-sub">{t('discover', 'communityCreateSub')}</p>
      </header>

      <form className="cc-form" onSubmit={onSubmit}>
        {error ? (
          <div className="cc-error" role="alert">
            {error}
          </div>
        ) : null}

        <div className="cc-field">
          <span className="cc-label">{t('discover', 'communityCreatePlaceSearch')}</span>
          {!manualId ? (
            <>
              <input
                className="cc-input"
                value={placeSearch}
                onChange={(e) => {
                  setPlaceSearch(e.target.value);
                  setLinkedPlaceId('');
                  setPlaceLabel('');
                  setLinkedInfo(null);
                }}
                placeholder={t('discover', 'communityCreatePlaceSearchPlaceholder')}
                autoComplete="off"
              />
              {placeSearchLoading ? <span className="cc-hint">{t('discover', 'communityCreateSearching')}</span> : null}
              {placeHits.length > 0 ? (
                <ul className="cc-place-hits" role="listbox">
                  {placeHits.map((p) => (
                    <li key={p.id}>
                      <button type="button" className="cc-place-hit" onClick={() => pickPlace(p)}>
                        <span className="cc-place-hit-name">{p.name || p.id}</span>
                        <span className="cc-place-hit-id">{p.id}</span>
                        {p.location ? <span className="cc-place-hit-loc">{p.location}</span> : null}
                        {p.feedLinkingDisabled ? (
                          <span className="cc-place-hit-warn">{t('discover', 'communityCreatePlaceLinkingOff')}</span>
                        ) : null}
                        {p.feedLinkingRestrictedToOwner ? (
                          <span className="cc-place-hit-note">{t('discover', 'communityCreatePlaceOwnersOnly')}</span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : null}

          <button type="button" className="cc-linkish" onClick={() => setManualId((m) => !m)}>
            {manualId ? t('discover', 'communityCreatePlaceUseSearch') : t('discover', 'communityCreatePlaceManual')}
          </button>

          {manualId ? (
            <label className="cc-field cc-field--tight">
              <span className="cc-label">{t('discover', 'communityCreatePlaceId')}</span>
              <input
                className="cc-input"
                value={manualPlaceId}
                onChange={(e) => setManualPlaceId(e.target.value)}
                placeholder={t('discover', 'communityCreatePlacePlaceholder')}
                autoComplete="off"
              />
            </label>
          ) : null}

          {linkedPlaceId && placeLabel ? (
            <p className="cc-linked">
              <Icon name="check_circle" size={18} aria-hidden />
              <span>
                {t('discover', 'communityCreateLinked')}: <strong>{placeLabel}</strong> ({linkedPlaceId})
              </span>
            </p>
          ) : null}
          {linkedInfo?.feedLinkingDisabled ? (
            <p className="cc-warn">{t('discover', 'communityCreateCannotLinkDisabled')}</p>
          ) : null}
        </div>

        <div className="cc-seg" role="group" aria-label={t('discover', 'communityCreateKind')}>
          <button
            type="button"
            className={`cc-seg-btn ${kind === 'post' ? 'cc-seg-btn--on' : ''}`}
            onClick={() => setKind('post')}
          >
            {t('discover', 'communityCreatePost')}
          </button>
          <button
            type="button"
            className={`cc-seg-btn ${kind === 'reel' ? 'cc-seg-btn--on' : ''}`}
            onClick={() => setKind('reel')}
          >
            {t('discover', 'communityCreateReel')}
          </button>
        </div>

        <label className="cc-field">
          <span className="cc-label">{t('discover', 'communityCreateUpload')}</span>
          <input
            type="file"
            accept={kind === 'reel' ? 'video/*' : 'image/*'}
            disabled={uploading || !effectivePlaceId}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              onPickFile(f);
            }}
          />
          {uploading ? <span className="cc-hint">{t('discover', 'communityCreateUploading')}</span> : null}
          {mediaUrl ? (
            <div className="cc-preview">
              <div className={filterClass}>
                {overlayText.trim() ? (
                  <div className={`cc-overlay cc-overlay--${overlayPosition}`} aria-hidden="true">
                    {overlayText}
                  </div>
                ) : null}
                {kind === 'reel' ? (
                  <video className="cc-preview-vid" src={mediaUrl} controls muted playsInline />
                ) : (
                  <img className="cc-preview-img" src={mediaUrl} alt="" />
                )}
              </div>
            </div>
          ) : null}
        </label>

        <div className="cc-studio-row">
          <span className="cc-label">{t('discover', 'communityCreateLook')}</span>
          <div className="cc-look-chips">
            {LOOK_PRESETS.map((lp) => (
              <button
                key={lp.id || 'none'}
                type="button"
                className={`cc-chip ${mediaFilter === lp.id ? 'cc-chip--on' : ''}`}
                onClick={() => setMediaFilter(lp.id)}
              >
                {t('discover', lp.labelKey)}
              </button>
            ))}
          </div>
        </div>

        <div className="cc-studio-row">
          <span className="cc-label">{t('discover', 'communityCreateOverlayPosition')}</span>
          <div className="cc-look-chips">
            {['bottom', 'center', 'top'].map((pos) => (
              <button
                key={pos}
                type="button"
                className={`cc-chip ${overlayPosition === pos ? 'cc-chip--on' : ''}`}
                onClick={() => setOverlayPosition(pos)}
              >
                {t('discover', `communityCreateOverlay${pos.charAt(0).toUpperCase() + pos.slice(1)}`)}
              </button>
            ))}
          </div>
        </div>

        <label className="cc-field">
          <span className="cc-label">{t('discover', 'communityCreateCaption')}</span>
          <textarea
            className="cc-textarea"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={4}
            maxLength={8000}
            required
          />
        </label>

        <button type="button" className="cc-adv-toggle" onClick={() => setAdvanced((v) => !v)}>
          {advanced ? t('discover', 'communityCreateAdvancedHide') : t('discover', 'communityCreateAdvancedShow')}
        </button>

        {advanced ? (
          <div className="cc-adv">
            <label className="cc-field">
              <span className="cc-label">{t('discover', 'communityCreateOverlay')}</span>
              <input className="cc-input" value={overlayText} onChange={(e) => setOverlayText(e.target.value)} />
            </label>
            <label className="cc-field">
              <span className="cc-label">{t('discover', 'communityCreateSound')}</span>
              <input
                className="cc-input"
                value={soundtrackUrl}
                onChange={(e) => setSoundtrackUrl(e.target.value)}
                placeholder="https://"
              />
            </label>
            <label className="cc-field">
              <span className="cc-label">{t('discover', 'communityCreateEffects')}</span>
              <input
                className="cc-input"
                value={effectsText}
                onChange={(e) => setEffectsText(e.target.value)}
                placeholder={t('discover', 'communityCreateCommaHint')}
              />
            </label>
            <div className="cc-field">
              <span className="cc-label">{t('discover', 'communityCreateStickers')}</span>
              <div className="cc-sticker-bar">
                {STICKER_PICKS.map((em) => (
                  <button
                    key={em}
                    type="button"
                    className={`cc-sticker-pick ${stickerPicks.includes(em) ? 'cc-sticker-pick--on' : ''}`}
                    onClick={() => toggleStickerPick(em)}
                    aria-pressed={stickerPicks.includes(em)}
                  >
                    {em}
                  </button>
                ))}
              </div>
              <input
                className="cc-input"
                value={stickersText}
                onChange={(e) => setStickersText(e.target.value)}
                placeholder={t('discover', 'communityCreateCommaHint')}
              />
            </div>
            <label className="cc-field">
              <span className="cc-label">{t('discover', 'communityCreateTagged')}</span>
              <input
                className="cc-input"
                value={taggedText}
                onChange={(e) => setTaggedText(e.target.value)}
                placeholder={t('discover', 'communityCreateTaggedHint')}
              />
            </label>
            <label className="cc-field">
              <span className="cc-label">{t('discover', 'communityCreateLocation')}</span>
              <input className="cc-input" value={locationLabel} onChange={(e) => setLocationLabel(e.target.value)} />
              <div className="cc-row">
                <button type="button" className="cc-btn-secondary" onClick={useMyLocation}>
                  {t('discover', 'communityCreateUseLocation')}
                </button>
                {coords ? (
                  <span className="cc-hint">
                    {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                  </span>
                ) : null}
              </div>
            </label>
          </div>
        ) : null}

        <button type="submit" className="cc-submit" disabled={submitting || uploading}>
          {submitting ? t('discover', 'communityCreateSaving') : t('discover', 'communityCreatePublish')}
        </button>
      </form>
    </div>
  );
}
