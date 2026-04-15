# -*- coding: utf-8 -*-
from pathlib import Path

p = Path("client/src/pages/Messages.jsx")
text = p.read_text(encoding="utf-8")

helpers = r'''
  function formatChatTime(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '';
      return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return '';
    }
  }

  /** Visitor messages on the right (WhatsApp-style); venue on the left. */
  function buildVenueThreadTimeline(row) {
    const fus = normalizeFollowups(row.visitorFollowups);
    const items = [];
    if (row.message && String(row.message).trim()) {
      items.push({ role: 'user', body: String(row.message).trim(), at: row.createdAt });
    }
    for (const fu of fus) {
      items.push({ role: 'user', body: String(fu.body || '').trim(), at: fu.createdAt });
    }
    const resp = row.response && String(row.response).trim() ? String(row.response).trim() : '';
    if (resp) {
      items.push({ role: 'venue', body: resp, at: row.respondedAt });
    }
    items.sort((a, b) => {
      const ta = new Date(a.at || 0).getTime();
      const tb = new Date(b.at || 0).getTime();
      if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb;
      return 0;
    });
    return items;
  }

'''

new_render = r'''  function renderThreadCard(row) {
    const sid = String(row.id);
    const archived = String(row.status || '').toLowerCase() === 'archived';
    const timeline = buildVenueThreadTimeline(row);
    const open = String(row.status || '').toLowerCase() === 'open';
    const showNoReplyYet = open && !timeline.some((m) => m.role === 'venue');
    return (
      <article key={row.id} className="messages-wa-thread messages-thread-card">
        <div className="messages-wa-thread__toolbar">
          <span className="messages-wa-thread__meta">
            {row.createdAt ? formatChatTime(row.createdAt) : ''}
            {row.id != null ? ` · #${String(row.id).slice(0, 8)}` : ''}
          </span>
          <span className={`messages-wa-thread__status messages-wa-thread__status--${String(row.status || 'open')}`}>
            {statusLabel(row.status)}
          </span>
        </div>
        <div className="messages-wa-chat" role="log" aria-label={t('discover', 'proposalMyMessagesTitle')}>
          {timeline.map((m, idx) => (
            <div
              key={`${sid}-m-${idx}-${m.role}`}
              className={`messages-wa-row messages-wa-row--${m.role === 'venue' ? 'in' : 'out'}`}
            >
              <div className={`messages-wa-bubble messages-wa-bubble--${m.role === 'venue' ? 'in' : 'out'}`}>
                <p className="messages-wa-bubble__text">{m.body}</p>
                <time className="messages-wa-bubble__time" dateTime={m.at ? new Date(m.at).toISOString() : undefined}>
                  {formatChatTime(m.at)}
                </time>
              </div>
            </div>
          ))}
          {showNoReplyYet ? (
            <p className="messages-wa-system">{t('discover', 'proposalNoReplyYet')}</p>
          ) : null}
        </div>
        {!archived && (
          <div className="messages-follow-up-form messages-wa-composer">
            <label className="messages-follow-up-form-label" htmlFor={`follow-up-${sid}`}>
              {t('discover', 'proposalFollowUpLabel')}
            </label>
            <div className="messages-wa-composer__inner">
              <textarea
                id={`follow-up-${sid}`}
                className="messages-follow-up-textarea messages-wa-composer__input"
                rows={2}
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
              <button
                type="button"
                className="messages-wa-send"
                disabled={followUpSendingId === row.id || (followUpDraft[sid] || '').trim().length < 3}
                onClick={() => sendFollowUp(row)}
                aria-label={t('discover', 'proposalFollowUpSend')}
              >
                <Icon name="send" size={22} aria-hidden="true" />
              </button>
            </div>
            {followUpErr[sid] ? (
              <p className="ig-proposal-error messages-follow-up-error" role="alert">
                {followUpErr[sid]}
              </p>
            ) : null}
          </div>
        )}
        {archived && <p className="messages-thread-archived-note">{t('discover', 'inquiryArchivedHint')}</p>}
        <button
          type="button"
          className="messages-wa-refresh"
          disabled={rowRefreshingId === row.id}
          onClick={() => refreshRow(row.placeId, row.id)}
        >
          {rowRefreshingId === row.id ? t('discover', 'proposalReplyChecking') : t('discover', 'proposalRefreshThread')}
        </button>
      </article>
    );
  }
'''

start = text.find("  function renderThreadCard(row) {")
if start < 0:
    raise SystemExit("renderThreadCard not found")
end = text.find("  const isInbox = !selectedKey;", start)
if end < 0:
    raise SystemExit("isInbox not found")

# Insert helpers before renderThreadCard if missing
if "function buildVenueThreadTimeline" not in text:
    text = text[:start] + helpers + new_render + "\n" + text[end:]
else:
    text = text[:start] + new_render + "\n" + text[end:]

p.write_text(text, encoding="utf-8")
print("Messages.jsx timeline OK")
