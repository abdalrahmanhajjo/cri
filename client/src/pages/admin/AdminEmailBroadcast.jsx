import { useState } from 'react';
import { api } from '../../api/client';
import './Admin.css';

export default function AdminEmailBroadcast() {
  const [subject, setSubject] = useState('');
  const [text, setText] = useState('');
  const [html, setHtml] = useState('');
  const [onlyVerified, setOnlyVerified] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setResult(null);
    const textTrim = text.trim();
    const htmlTrim = html.trim();
    if (!textTrim && !htmlTrim) {
      setError('Add a plain-text message and/or HTML body.');
      return;
    }
    setLoading(true);
    try {
      const r = await api.admin.emailBroadcast({
        subject: subject.trim(),
        text: textTrim,
        html: htmlTrim,
        onlyVerifiedEmail: onlyVerified,
      });
      setResult(r);
    } catch (err) {
      setError(err.message || 'Send failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-page-content">
      <div className="admin-page-header">
        <div className="admin-page-title-wrap">
          <p className="admin-subtitle">
            Sends one email per user via your server SMTP. Requires <code>SMTP_HOST</code>, <code>SMTP_USER</code>, and{' '}
            <code>SMTP_PASS</code>. Default audience is users with a verified email only.
          </p>
          <h1 className="admin-page-title">Email all users</h1>
        </div>
      </div>

      <div className="admin-panel" style={{ maxWidth: 720 }}>
        <form onSubmit={handleSubmit} className="admin-form">
          {error && (
            <div className="admin-error" role="alert">
              {error}
            </div>
          )}
          {result && (
            <div className="admin-toast admin-toast--success" style={{ position: 'relative', marginBottom: '1rem' }} role="status">
              Queued complete: {result.sent} sent, {result.failed} failed, out of {result.totalRecipients} recipients
              {result.onlyVerifiedEmail ? ' (verified email only).' : ' (including unverified emails).'}
              {Array.isArray(result.errors) && result.errors.length > 0 && (
                <details style={{ marginTop: 8 }}>
                  <summary>First errors</summary>
                  <ul style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: 13 }}>
                    {result.errors.map((x, i) => (
                      <li key={i}>
                        {x.email}: {x.message}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

          <div className="admin-form-group">
            <label htmlFor="bc-subject">Subject *</label>
            <input
              id="bc-subject"
              className="admin-input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
              required
              placeholder="News from Visit Tripoli"
            />
          </div>

          <div className="admin-form-group">
            <label htmlFor="bc-text">Plain text body *</label>
            <textarea
              id="bc-text"
              className="admin-textarea"
              rows={8}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Message shown in all mail clients. Required even if you add HTML below."
            />
          </div>

          <div className="admin-form-group">
            <label htmlFor="bc-html">HTML body (optional)</label>
            <textarea
              id="bc-html"
              className="admin-textarea"
              rows={6}
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              placeholder="<p>Optional rich HTML…</p>"
            />
          </div>

          <div className="admin-form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={onlyVerified} onChange={(e) => setOnlyVerified(e.target.checked)} />
              <span>Only users with verified email</span>
            </label>
            <p className="admin-hint" style={{ marginTop: 6 }}>
              Uncheck to include accounts that have not finished email verification (use sparingly).
            </p>
          </div>

          <button
            type="submit"
            className="admin-btn admin-btn--primary"
            disabled={loading || !subject.trim() || (!text.trim() && !html.trim())}
          >
            {loading ? 'Sending…' : 'Send to all matching users'}
          </button>
        </form>
      </div>
    </div>
  );
}
