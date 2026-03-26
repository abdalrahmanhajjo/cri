import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { COMMUNITY_PATH } from '../utils/discoverPaths';
import { useLanguage } from '../context/LanguageContext';
import api from '../api/client';
import Icon from '../components/Icon';
import './Discover.css';
import './Messages.css';

function threadCountLabel(count, t) {
  const n = Number(count) || 0;
  if (n === 1) return t('discover', 'messagesThreadCountOne');
  return t('discover', 'messagesThreadCount').replace('{count}', String(n));
}

function normalizeFollowups(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x) => x && typeof x.body === 'string' && String(x.body).trim());
}

/** Latest activity timestamp for a thread (message, follow-ups, venue reply). */
function threadLastActivityMs(row) {
  let ms = new Date(row.createdAt || 0).getTime();
  const ra = new Date(row.respondedAt || 0).getTime();
  if (Number.isFinite(ra) && ra > ms) ms = ra;
  const fus = normalizeFollowups(row.visitorFollowups);
  for (const fu of fus) {
    const t = new Date(fu.createdAt || 0).getTime();
    if (Number.isFinite(t) && t > ms) ms = t;
  }
  return ms;
}

function groupRouteKey(g) {
  return g.placeId != null && String(g.placeId).trim() !== '' ? String(g.placeId) : '_unknown';
}

function placeInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  const w = parts[0] || '?';
  return w.slice(0, 2).toUpperCase();
}

/** Short preview of latest activity in a thread for inbox rows. */
function threadPreviewSnippet(row) {
  const fus = normalizeFollowups(row.visitorFollowups);
  if (fus.length) {
    const last = fus[fus.length - 1];
    return String(last.body || '').trim();
  }
  const resp = String(row.response || '').trim();
  if (resp) return resp;
  return String(row.message || '').trim();
}

function formatShortTime(ms, locale) {
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const d = new Date(ms);
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - ms) / 1000));
  if (diffSec < 60) return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-diffSec, 'second');
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-diffMin, 'minute');
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-diffHr, 'hour');
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-diffDay, 'day');
  return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

function previewForGroup(group, locale) {
  if (!group.threads.length) return { text: '', timeMs: 0, timeLabel: '' };
  let best = group.threads[0];
  let bestMs = threadLastActivityMs(best);
  for (let i = 1; i < group.threads.length; i++) {
    const t = group.threads[i];
    const ms = threadLastActivityMs(t);
    if (ms > bestMs) {
      best = t;
      bestMs = ms;
    }
  }
  const raw = threadPreviewSnippet(best);
  const text = raw.length > 100 ? `${raw.slice(0, 100)}…` : raw;
  return {
    text,
    timeMs: bestMs,
    timeLabel: bestMs ? formatShortTime(bestMs, locale) : '',
  };
}

export default function Messages() {
  const { t, lang } = useLanguage();
  const { placeId: placeIdParam } = useParams();
  const selectedKey = placeIdParam != null && String(placeIdParam).trim() !== '' ? placeIdParam : null;
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState(null);
  const [rowRefreshingId, setRowRefreshingId] = useState(null);
  const [followUpDraft, setFollowUpDraft] = useState({});
  const [followUpSendingId, setFollowUpSendingId] = useState(null);
  const [followUpErr, setFollowUpErr] = useState({});
  const [placeSearch, setPlaceSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadErr(null);
    try {
      const data = await api.user.inquiries();
      const list = Array.isArray(data?.inquiries) ? data.inquiries : [];
      setInquiries(
        list.map((r) => ({
          ...r,
          visitorFollowups: normalizeFollowups(r.visitorFollowups),
        }))
      );
    } catch (e) {
      setLoadErr(e?.message || 'Could not load your messages. Try again.');
      setInquiries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const groupedByPlace = useMemo(() => {
    const map = new Map();
    for (const row of inquiries) {
      const pid = row.placeId != null ? String(row.placeId) : '_unknown';
      if (!map.has(pid)) {
        map.set(pid, {
          placeId: row.placeId,
          placeName: row.placeName || pid,
          threads: [],
        });
      }
      map.get(pid).threads.push(row);
    }
    const groups = Array.from(map.values());
    for (const g of groups) {
      g.threads.sort((a, b) => threadLastActivityMs(b) - threadLastActivityMs(a));
    }
    groups.sort((a, b) => {
      const maxA = a.threads.length ? Math.max(...a.threads.map((t) => threadLastActivityMs(t))) : 0;
      const maxB = b.threads.length ? Math.max(...b.threads.map((t) => threadLastActivityMs(t))) : 0;
      return maxB - maxA;
    });
    return groups;
  }, [inquiries]);

  const localeTag = lang === 'ar' ? 'ar' : lang === 'fr' ? 'fr' : 'en';

  const selectedGroup = useMemo(() => {
    if (!selectedKey) return null;
    return groupedByPlace.find((g) => groupRouteKey(g) === selectedKey) ?? null;
  }, [groupedByPlace, selectedKey]);

  const placeSearchTrim = placeSearch.trim().toLowerCase();
  const filteredGroups = useMemo(() => {
    if (!placeSearchTrim) return groupedByPlace;
    return groupedByPlace.filter((g) => {
      const name = String(g.placeName || '').toLowerCase();
      const pid = String(g.placeId || '').toLowerCase();
      return name.includes(placeSearchTrim) || pid.includes(placeSearchTrim);
    });
  }, [groupedByPlace, placeSearchTrim]);

  useEffect(() => {
    const prev = document.title;
    if (selectedKey && selectedGroup?.placeName) {
      document.title = `${selectedGroup.placeName} — ${t('nav', 'venueMessages')} — Visit Tripoli`;
    } else {
      document.title = `${t('nav', 'venueMessages')} — Visit Tripoli`;
    }
    return () => {
      document.title = prev;
    };
  }, [t, selectedKey, selectedGroup?.placeName]);

  async function refreshRow(placeId, inquiryId) {
    if (!placeId || inquiryId == null) return;
    setRowRefreshingId(inquiryId);
    setLoadErr(null);
    try {
      const data = await api.places.inquiryStatus(placeId, String(inquiryId));
      setInquiries((prev) =>
        prev.map((row) =>
          String(row.id) === String(inquiryId)
            ? {
                ...row,
                status: data.status,
                response: data.response ?? row.response,
                respondedAt: data.respondedAt ?? row.respondedAt,
                visitorFollowups: normalizeFollowups(data.visitorFollowups ?? row.visitorFollowups),
              }
            : row
        )
      );
    } catch (e) {
      setLoadErr(e?.message || t('discover', 'error'));
    } finally {
      setRowRefreshingId(null);
    }
  }

  function statusLabel(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'answered') return t('discover', 'proposalStatusAnswered');
    if (s === 'archived') return t('discover', 'proposalStatusArchived');
    return t('discover', 'proposalStatusOpen');
  }

  async function sendFollowUp(row) {
    const sid = String(row.id);
    const msg = (followUpDraft[sid] || '').trim();
    if (msg.length < 3) {
      setFollowUpErr((e) => ({ ...e, [sid]: t('discover', 'proposalNeedShortFollowUp') }));
      return;
    }
    setFollowUpErr((e) => {
      const next = { ...e };
      delete next[sid];
      return next;
    });
    setFollowUpSendingId(row.id);
    setLoadErr(null);
    try {
      const data = await api.places.inquiryFollowUp(row.placeId, row.id, { message: msg });
      setInquiries((prev) =>
        prev.map((r) =>
          String(r.id) === sid
            ? {
                ...r,
                status: data.status,
                response: data.response ?? r.response,
                respondedAt: data.respondedAt ?? r.respondedAt,
                visitorFollowups: normalizeFollowups(data.visitorFollowups),
              }
            : r
        )
      );
      setFollowUpDraft((d) => ({ ...d, [sid]: '' }));
    } catch (e) {
      const code = e?.data?.code;
      if (code === 'MESSAGING_BLOCKED') {
        setFollowUpErr((err) => ({ ...err, [sid]: t('discover', 'messagingBlockedByVenue') }));
        void load();
      } else if (code === 'INQUIRY_ARCHIVED') {
        setFollowUpErr((err) => ({ ...err, [sid]: t('discover', 'inquiryArchivedHint') }));
        void load();
      } else {
        setFollowUpErr((err) => ({ ...err, [sid]: e?.message || t('discover', 'proposalFollowUpError') }));
      }
    } finally {
      setFollowUpSendingId(null);
    }
  }

  function renderThreadCard(row) {
    const sid = String(row.id);
    const followups = normalizeFollowups(row.visitorFollowups);
    const archived = String(row.status || '').toLowerCase() === 'archived';
    return (
      <article key={row.id} className="ig-proposal-thread messages-thread-card">
        <div className="ig-proposal-thread-head messages-thread-head">
          <span className="messages-thread-summary">
            {row.createdAt ? new Date(row.createdAt).toLocaleString() : ''}
            {row.id != null ? ` · #${row.id}` : ''}
          </span>
          <span className={`ig-proposal-thread-status ig-proposal-thread-status--${String(row.status || 'open')}`}>
            {statusLabel(row.status)}
          </span>
        </div>
        <p className="ig-proposal-thread-message">{row.message}</p>
        {followups.map((fu, idx) => (
          <div key={`${sid}-fu-${idx}`} className="messages-follow-up-bubble">
            <span className="messages-follow-up-label">{t('discover', 'proposalYourFollowUp')}</span>
            {fu.createdAt ? <p className="messages-follow-up-meta">{new Date(fu.createdAt).toLocaleString()}</p> : null}
            <p className="ig-proposal-thread-message messages-follow-up-body">{fu.body}</p>
          </div>
        ))}
        {row.response && String(row.response).trim() ? (
          <div className="ig-proposal-thread-reply">
            <span className="ig-proposal-thread-reply-label">{t('discover', 'proposalVenueReply')}</span>
            <p className="ig-proposal-thread-reply-text">{row.response}</p>
          </div>
        ) : (
          String(row.status || '').toLowerCase() === 'open' && (
            <p className="ig-proposal-thread-no-reply">{t('discover', 'proposalNoReplyYet')}</p>
          )
        )}
        {!archived && (
          <div className="messages-follow-up-form">
            <label className="messages-follow-up-form-label" htmlFor={`follow-up-${sid}`}>
              {t('discover', 'proposalFollowUpLabel')}
            </label>
            <textarea
              id={`follow-up-${sid}`}
              className="messages-follow-up-textarea"
              rows={3}
              maxLength={8000}
              placeholder={t('discover', 'proposalFollowUpPlaceholder')}
              value={followUpDraft[sid] || ''}
              disabled={followUpSendingId === row.id}
              onChange={(e) =>
                setFollowUpDraft((d) => ({
                  ...d,
                  [sid]: e.target.value,
                }))
              }
            />
            {followUpErr[sid] ? (
              <p className="ig-proposal-error messages-follow-up-error" role="alert">
                {followUpErr[sid]}
              </p>
            ) : null}
            <div className="messages-follow-up-actions">
              <button
                type="button"
                className="messages-follow-up-send"
                disabled={followUpSendingId === row.id || (followUpDraft[sid] || '').trim().length < 3}
                onClick={() => sendFollowUp(row)}
              >
                {followUpSendingId === row.id ? t('discover', 'proposalFollowUpSending') : t('discover', 'proposalFollowUpSend')}
              </button>
            </div>
          </div>
        )}
        {archived && <p className="messages-thread-archived-note">{t('discover', 'inquiryArchivedHint')}</p>}
        <button
          type="button"
          className="ig-proposal-thread-refresh"
          disabled={rowRefreshingId === row.id}
          onClick={() => refreshRow(row.placeId, row.id)}
        >
          {rowRefreshingId === row.id ? t('discover', 'proposalReplyChecking') : t('discover', 'proposalRefreshThread')}
        </button>
      </article>
    );
  }

  const isInbox = !selectedKey;
  const placeNotFound = Boolean(selectedKey && !loading && !loadErr && inquiries.length > 0 && !selectedGroup);

  return (
    <div className="messages-page">
      <div className="messages-page-inner">
        <Link to={COMMUNITY_PATH} className="messages-back">
          <Icon name="arrow_back" size={20} aria-hidden="true" />
          {t('discover', 'messagesBackToDiscover')}
        </Link>
        {!isInbox && (
          <Link to="/messages" className="messages-back messages-back-inbox">
            <Icon name="arrow_back" size={20} aria-hidden="true" />
            {t('discover', 'messagesBackToInbox')}
          </Link>
        )}
        <h1 className="messages-page-title">
          {isInbox ? t('discover', 'proposalMyMessagesTitle') : selectedGroup?.placeName || t('nav', 'venueMessages')}
        </h1>
        {isInbox ? (
          <p className="messages-page-intro">{t('discover', 'messagesPageIntro')}</p>
        ) : (
          <p className="messages-page-intro">{t('discover', 'messagesPlaceIntro')}</p>
        )}
        {isInbox && !loading && !loadErr && inquiries.length > 0 && (
          <>
            <p className="messages-page-grouped-hint">{t('discover', 'messagesGroupedHint')}</p>
            <p className="messages-page-sort-hint">{t('discover', 'messagesSortedByRecent')}</p>
          </>
        )}

        {isInbox && !loading && !loadErr && inquiries.length > 0 && (
          <div className="messages-search-row" role="search">
            <div className="messages-search-wrap">
              <Icon name="search" size={22} className="messages-search-icon" aria-hidden="true" />
              <input
                type="search"
                className="messages-search-input"
                placeholder={t('discover', 'messagesSearchPlaceholder')}
                aria-label={t('discover', 'messagesSearchPlaceholder')}
                value={placeSearch}
                onChange={(e) => setPlaceSearch(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
              {placeSearchTrim ? (
                <button
                  type="button"
                  className="messages-search-clear"
                  onClick={() => setPlaceSearch('')}
                  aria-label={t('discover', 'messagesSearchClear')}
                >
                  <Icon name="close" size={20} aria-hidden="true" />
                </button>
              ) : null}
            </div>
            {placeSearchTrim ? (
              <p className="messages-search-meta" role="status">
                {filteredGroups.length > 0
                  ? t('discover', 'messagesSearchCount').replace('{count}', String(filteredGroups.length))
                  : t('discover', 'messagesSearchNoResults')}
              </p>
            ) : null}
          </div>
        )}

        <div className="messages-by-place" aria-label={t('discover', 'proposalMyMessagesTitle')}>
          {loading && (
            <p className="ig-proposal-my-messages-meta messages-status-line" role="status">
              {t('discover', 'loading')}
            </p>
          )}
          {loadErr && (
            <p className="ig-proposal-error" role="alert">
              {loadErr}
            </p>
          )}
          {!loading && !loadErr && inquiries.length === 0 && (
            <p className="ig-proposal-my-messages-empty messages-status-line">{t('discover', 'proposalMyMessagesEmpty')}</p>
          )}
          {placeNotFound && (
            <p className="ig-proposal-error messages-status-line" role="alert">
              {t('discover', 'messagesPlaceNotFound')}
            </p>
          )}

          {isInbox &&
            !loading &&
            !loadErr &&
            inquiries.length > 0 &&
            filteredGroups.map((group) => {
              const key = groupRouteKey(group);
              const { text: preview, timeLabel, timeMs } = previewForGroup(group, localeTag);
              return (
                <Link
                  key={key}
                  to={`/messages/${encodeURIComponent(key)}`}
                  className="messages-inbox-row"
                >
                  <div className="messages-inbox-avatar" aria-hidden="true">
                    {placeInitials(group.placeName)}
                  </div>
                  <div className="messages-inbox-main">
                    <div className="messages-inbox-topline">
                      <span className="messages-inbox-name">{group.placeName}</span>
                      {timeLabel ? (
                        <time className="messages-inbox-time" dateTime={new Date(timeMs).toISOString()}>
                          {timeLabel}
                        </time>
                      ) : null}
                    </div>
                    <p className="messages-inbox-preview">
                      <span className="messages-inbox-thread-meta">{threadCountLabel(group.threads.length, t)}</span>
                      {preview ? ` · ${preview}` : ''}
                    </p>
                  </div>
                  <Icon name="chevron_right" size={22} className="messages-inbox-chevron" aria-hidden="true" />
                </Link>
              );
            })}

          {!isInbox && selectedGroup && !loading && !loadErr && (
            <section className="messages-place-group messages-place-group-open">
              <header className="messages-place-header">
                <div className="messages-place-header-text">
                  <h2 className="messages-place-name messages-sr-only">{selectedGroup.placeName}</h2>
                  <p className="messages-place-meta">{threadCountLabel(selectedGroup.threads.length, t)}</p>
                </div>
                {selectedGroup.placeId != null && String(selectedGroup.placeId).trim() !== '' && (
                  <Link
                    to={`/place/${encodeURIComponent(selectedGroup.placeId)}`}
                    className="messages-place-link"
                  >
                    {t('discover', 'messagesViewPlace')}
                    <Icon name="chevron_right" size={18} className="messages-place-link-icon" aria-hidden="true" />
                  </Link>
                )}
              </header>
              <div className="messages-place-threads">{selectedGroup.threads.map((row) => renderThreadCard(row))}</div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
