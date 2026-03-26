import { useState, useEffect, useCallback, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import api, { getImageUrl, fixImageUrlExtension } from '../../api/client';
import './Business.css';

const BASE_TITLE = 'Business — Visit Tripoli';

function contentKind(t) {
  const x = String(t || '').toLowerCase();
  if (x === 'reel' || x === 'video') return 'reel';
  return 'post';
}

function imgSrc(url) {
  if (!url) return null;
  return getImageUrl(fixImageUrlExtension(url));
}

function videoSrc(url) {
  if (!url || !String(url).trim()) return null;
  return getImageUrl(fixImageUrlExtension(String(url).trim()));
}

/** DB may still have `news`/`post` for video-only items; treat as reel for labels + preview. */
function isReelCard(p) {
  const t = String(p?.type || '').toLowerCase();
  if (t === 'reel' || t === 'video') return true;
  const hasImage = !!imgSrc(p?.image_url);
  const hasVideo = !!videoSrc(p?.video_url);
  return hasVideo && !hasImage;
}

export default function BusinessPlaceFeed() {
  const ctx = useOutletContext();
  const me = ctx?.me;
  const refreshMe = ctx?.refreshMe;
  const places = useMemo(() => (Array.isArray(me?.places) ? me.places : []), [me?.places]);

  const [posts, setPosts] = useState([]);
  const [placeFilter, setPlaceFilter] = useState('');
  const [formatFilter, setFormatFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const [formPlace, setFormPlace] = useState('');
  const [formCaption, setFormCaption] = useState('');
  const [formImage, setFormImage] = useState('');
  const [formVideo, setFormVideo] = useState('');
  const [formContentKind, setFormContentKind] = useState('post');
  const [uploading, setUploading] = useState(false);

  const [editing, setEditing] = useState(null);

  const [sectionTab, setSectionTab] = useState('feed');
  const [engagementPlaceId, setEngagementPlaceId] = useState('');
  const [insights, setInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [inquiries, setInquiries] = useState([]);
  const [inquiriesLoading, setInquiriesLoading] = useState(false);
  const [promotions, setPromotions] = useState([]);
  const [promoLoading, setPromoLoading] = useState(false);
  const [replyDraft, setReplyDraft] = useState({});
  const [replyingId, setReplyingId] = useState(null);
  const [promoForm, setPromoForm] = useState({
    title: '',
    subtitle: '',
    code: '',
    discountLabel: '',
    terms: '',
    startsAt: '',
    endsAt: '',
    active: true,
  });
  const [promoSaving, setPromoSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (placeFilter) params.placeId = placeFilter;
      if (formatFilter && formatFilter !== 'all') params.format = formatFilter;
      const r = await api.business.feed.list(params);
      setPosts(r.posts || []);
    } catch (e) {
      setError(e.message || 'Could not load posts');
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [placeFilter, formatFilter]);

  useEffect(() => {
    document.title = `Feed · ${BASE_TITLE}`;
    return () => {
      document.title = BASE_TITLE;
    };
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (places.length && !formPlace) setFormPlace(places[0].id);
  }, [places, formPlace]);

  useEffect(() => {
    if (places.length && !engagementPlaceId) setEngagementPlaceId(String(places[0].id));
  }, [places, engagementPlaceId]);

  /** Load Insights, Inquiries, and Offers together whenever the selected venue changes (or on refresh). */
  const refreshEngagementApis = useCallback(async () => {
    if (!engagementPlaceId) {
      setInsights(null);
      setInquiries([]);
      setPromotions([]);
      return;
    }
    setInsightsLoading(true);
    setInquiriesLoading(true);
    setPromoLoading(true);
    setError(null);
    const errs = [];

    await Promise.all([
      (async () => {
        try {
          const r = await api.business.insights(engagementPlaceId);
          setInsights(r);
        } catch (e) {
          setInsights(null);
          errs.push(e.message || 'insights');
        } finally {
          setInsightsLoading(false);
        }
      })(),
      (async () => {
        try {
          const r = await api.business.proposals.list(engagementPlaceId);
          setInquiries(Array.isArray(r.inquiries) ? r.inquiries : []);
        } catch (e) {
          setInquiries([]);
          errs.push(e.message || 'inquiries');
        } finally {
          setInquiriesLoading(false);
        }
      })(),
      (async () => {
        try {
          const r = await api.business.promotions.list(engagementPlaceId);
          setPromotions(Array.isArray(r.promotions) ? r.promotions : []);
        } catch (e) {
          setPromotions([]);
          errs.push(e.message || 'offers');
        } finally {
          setPromoLoading(false);
        }
      })(),
    ]);

    if (errs.length) setError(errs.join(' · '));
  }, [engagementPlaceId]);

  useEffect(() => {
    refreshEngagementApis();
  }, [refreshEngagementApis]);

  const submitReply = async (inquiryId) => {
    const text = (replyDraft[inquiryId] || '').trim();
    if (!text) return;
    setReplyingId(inquiryId);
    setError(null);
    try {
      await api.business.proposals.update(inquiryId, { response: text });
      setReplyDraft((d) => ({ ...d, [inquiryId]: '' }));
      await refreshEngagementApis();
    } catch (err) {
      setError(err.message || 'Could not save reply');
    } finally {
      setReplyingId(null);
    }
  };

  const archiveInquiry = async (inquiryId) => {
    setReplyingId(inquiryId);
    try {
      await api.business.proposals.update(inquiryId, { status: 'archived' });
      await refreshEngagementApis();
    } catch (err) {
      setError(err.message || 'Could not archive');
    } finally {
      setReplyingId(null);
    }
  };

  const toggleMessagingBlock = async (q) => {
    if (!engagementPlaceId || !q?.id) return;
    setReplyingId(q.id);
    setError(null);
    try {
      if (q.isMessagingBlocked) {
        await api.business.messagingBlocks.unblock(engagementPlaceId, q.id);
      } else {
        await api.business.messagingBlocks.block(engagementPlaceId, q.id);
      }
      await refreshEngagementApis();
    } catch (err) {
      setError(err.message || 'Could not update messaging block');
    } finally {
      setReplyingId(null);
    }
  };

  const submitPromo = async (e) => {
    e.preventDefault();
    if (!engagementPlaceId || !promoForm.title.trim()) return;
    setPromoSaving(true);
    setError(null);
    try {
      await api.business.promotions.create({
        placeId: engagementPlaceId,
        title: promoForm.title.trim(),
        subtitle: promoForm.subtitle.trim() || undefined,
        code: promoForm.code.trim() || undefined,
        discountLabel: promoForm.discountLabel.trim() || undefined,
        terms: promoForm.terms.trim() || undefined,
        startsAt: promoForm.startsAt || undefined,
        endsAt: promoForm.endsAt || undefined,
        active: promoForm.active,
      });
      setPromoForm({
        title: '',
        subtitle: '',
        code: '',
        discountLabel: '',
        terms: '',
        startsAt: '',
        endsAt: '',
        active: true,
      });
      await refreshEngagementApis();
    } catch (err) {
      setError(err.message || 'Could not create offer');
    } finally {
      setPromoSaving(false);
    }
  };

  const togglePromoActive = async (p) => {
    try {
      await api.business.promotions.update(p.id, { active: !p.active });
      await refreshEngagementApis();
    } catch (err) {
      setError(err.message || 'Update failed');
    }
  };

  const deletePromo = async (id) => {
    if (!window.confirm('Remove this offer?')) return;
    try {
      await api.business.promotions.delete(id);
      await refreshEngagementApis();
    } catch (err) {
      setError(err.message || 'Delete failed');
    }
  };

  const submitCreate = async (e) => {
    e.preventDefault();
    if (!formPlace || !formCaption.trim()) return;
    if (formContentKind === 'reel' && !formVideo.trim()) {
      setError('Add a video URL for reels, or switch to Feed post.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.business.feed.create({
        placeId: formPlace,
        caption: formCaption.trim(),
        image_url: formImage.trim() || undefined,
        video_url: formVideo.trim() || undefined,
        type: formContentKind === 'reel' ? 'video' : 'post',
      });
      setFormCaption('');
      setFormImage('');
      setFormVideo('');
      await load();
      refreshMe?.();
    } catch (err) {
      setError(err.message || 'Could not publish');
    } finally {
      setSaving(false);
    }
  };

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !formPlace) return;
    setUploading(true);
    setError(null);
    try {
      const url = await api.business.upload(file, formPlace);
      setFormImage(url);
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    if (!editing?.id) return;
    if (contentKind(editing.type) === 'reel' && !(editing.video_url && String(editing.video_url).trim())) {
      setError('Reels require a video URL.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.business.feed.update(editing.id, {
        caption: editing.caption,
        image_url: (editing.image_url && String(editing.image_url).trim()) || null,
        video_url: (editing.video_url && String(editing.video_url).trim()) || null,
        type: contentKind(editing.type) === 'reel' ? 'video' : 'post',
      });
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Remove this post from the community feed?')) return;
    setDeleting(id);
    try {
      await api.business.feed.delete(id);
      setPosts((p) => p.filter((x) => x.id !== id));
      if (editing?.id === id) setEditing(null);
    } catch (err) {
      setError(err.message || 'Delete failed');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="business-dashboard">
      <header className="business-dashboard-hero">
        <p className="business-dashboard-kicker">Community</p>
        <h1 className="business-dashboard-title">Your place feed</h1>
        <p className="business-dashboard-lead">
          Publish feed posts or short-video reels for each venue you manage. Content is tied to your listing; visibility in
          Explore is controlled by administrators. You can edit or remove your items anytime.
        </p>
      </header>

      {error && (
        <div className="business-banner-error" role="alert">
          {error}
        </div>
      )}

      {places.length === 0 && me && (
        <div className="business-empty-card">
          <p>No place is linked to your account yet. Ask an administrator to assign a venue before posting to the feed.</p>
        </div>
      )}

      {places.length > 0 && (
        <>
          <div className="business-engage-tabs" role="tablist" aria-label="Place management">
            {[
              { id: 'feed', label: 'Feed' },
              { id: 'insights', label: 'Insights' },
              { id: 'inquiries', label: 'Inquiries' },
              { id: 'offers', label: 'Offers & coupons' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={sectionTab === tab.id}
                className={`business-engage-tab ${sectionTab === tab.id ? 'business-engage-tab--active' : ''}`}
                onClick={() => setSectionTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {(sectionTab === 'insights' || sectionTab === 'inquiries' || sectionTab === 'offers') && (
            <div className="business-panel business-engage-scope" style={{ marginBottom: '1rem' }}>
              <label className="business-field" style={{ marginBottom: 0 }}>
                <span className="business-hint" style={{ display: 'block', marginBottom: '0.35rem' }}>
                  Venue
                </span>
                <select
                  className="business-select"
                  value={engagementPlaceId}
                  onChange={(e) => setEngagementPlaceId(e.target.value)}
                >
                  {places.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name || p.id}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {sectionTab === 'feed' && (
            <>
          <div className="business-panel" style={{ marginBottom: '1.5rem' }}>
            <h2 className="business-panel-title">New post or reel</h2>
            <form onSubmit={submitCreate} className="business-feed-form">
              <div className="business-field">
                <label htmlFor="bf-kind">Content type</label>
                <select
                  id="bf-kind"
                  className="business-select"
                  value={formContentKind}
                  onChange={(e) => setFormContentKind(e.target.value)}
                >
                  <option value="post">Feed post</option>
                  <option value="reel">Reel (short video)</option>
                </select>
                {formContentKind === 'reel' && (
                  <p className="business-hint" style={{ marginTop: '0.35rem' }}>
                    Add a direct video URL (MP4 or hosted file). Cover image is optional.
                  </p>
                )}
              </div>
              <div className="business-field">
                <label htmlFor="bf-place">Place</label>
                <select
                  id="bf-place"
                  className="business-select"
                  value={formPlace}
                  onChange={(e) => setFormPlace(e.target.value)}
                  required
                >
                  {places.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name || p.id}
                    </option>
                  ))}
                </select>
              </div>
              <div className="business-field">
                <label htmlFor="bf-cap">Caption</label>
                <textarea
                  id="bf-cap"
                  className="business-textarea"
                  rows={4}
                  value={formCaption}
                  onChange={(e) => setFormCaption(e.target.value)}
                  placeholder="Share news, offers, or what’s new at your venue…"
                  required
                  maxLength={8000}
                />
              </div>
              <div className="business-field-row">
                <div className="business-field">
                  <label htmlFor="bf-img">Image URL (optional)</label>
                  <input
                    id="bf-img"
                    className="business-input"
                    value={formImage}
                    onChange={(e) => setFormImage(e.target.value)}
                    placeholder="https://… or upload below"
                  />
                </div>
                <div className="business-field">
                  <label htmlFor="bf-vid">Video URL (optional)</label>
                  <input
                    id="bf-vid"
                    className="business-input"
                    value={formVideo}
                    onChange={(e) => setFormVideo(e.target.value)}
                    placeholder="https://…"
                  />
                </div>
              </div>
              <div className="business-field">
                <label htmlFor="bf-file">Upload image</label>
                <input id="bf-file" type="file" accept="image/*" onChange={onUpload} disabled={uploading || !formPlace} />
                {uploading && <span className="business-hint"> Uploading…</span>}
              </div>
              <button type="submit" className="business-btn business-btn--primary" disabled={saving || uploading}>
                {saving ? 'Publishing…' : 'Publish to feed'}
              </button>
            </form>
          </div>

          <div className="business-feed-toolbar">
            <label className="business-feed-filter">
              <span className="business-hint" style={{ marginRight: '0.5rem' }}>
                Place:
              </span>
              <select className="business-select" value={placeFilter} onChange={(e) => setPlaceFilter(e.target.value)}>
                <option value="">All my places</option>
                {places.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name || p.id}
                  </option>
                ))}
              </select>
            </label>
            <label className="business-feed-filter">
              <span className="business-hint" style={{ marginRight: '0.5rem' }}>
                Type:
              </span>
              <select className="business-select" value={formatFilter} onChange={(e) => setFormatFilter(e.target.value)}>
                <option value="all">All</option>
                <option value="post">Posts only</option>
                <option value="reel">Reels only</option>
              </select>
            </label>
            <button type="button" className="business-btn business-btn--ghost" onClick={load} disabled={loading}>
              Refresh
            </button>
          </div>

          {loading && <div className="business-loading">Loading posts…</div>}

          {!loading && posts.length === 0 && (
            <div className="business-empty-card">
              <p>No feed posts yet. Create one above.</p>
            </div>
          )}

          {!loading && posts.length > 0 && (
            <div className="business-feed-list">
              {posts.map((p) => {
                const placeName = places.find((x) => x.id === p.place_id)?.name || p.place_id;
                const isReel = isReelCard(p);
                const hasImage = !!imgSrc(p.image_url);
                const vSrc = videoSrc(p.video_url);
                return (
                  <article key={p.id} className="business-feed-card">
                    <div className="business-feed-card-media">
                      {hasImage ? (
                        <img src={imgSrc(p.image_url)} alt="" className="business-feed-card-img" />
                      ) : vSrc ? (
                        <video
                          className="business-feed-card-img business-feed-card-video"
                          src={vSrc}
                          muted
                          playsInline
                          preload="metadata"
                          aria-label="Video preview"
                        />
                      ) : (
                        <div className="business-feed-card-img business-feed-card-img--empty">No image</div>
                      )}
                    </div>
                    <div className="business-feed-card-body">
                      <div className="business-feed-card-meta">
                        <strong>{placeName}</strong>
                        <span className={`business-feed-pill ${isReel ? 'business-feed-pill--reel' : ''}`}>
                          {isReel ? 'Video' : 'Post'}
                        </span>
                        <span className="business-feed-pill">{p.moderation_status || '—'}</span>
                      </div>
                      <p className="business-feed-caption">{p.caption}</p>
                      <p className="business-hint" style={{ marginTop: '0.5rem' }}>
                        {p.created_at ? new Date(p.created_at).toLocaleString() : ''}
                      </p>
                      <div className="business-feed-card-actions">
                        <button
                          type="button"
                          className="business-btn business-btn--ghost"
                          onClick={() =>
                            setEditing({
                              ...p,
                              type: isReelCard(p) ? 'reel' : 'post',
                            })
                          }
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="business-btn business-btn--ghost"
                          style={{ color: 'var(--biz-danger, #b42318)' }}
                          disabled={deleting === p.id}
                          onClick={() => remove(p.id)}
                        >
                          {deleting === p.id ? '…' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
            </>
          )}

          {sectionTab === 'insights' && (
            <div className="business-engage-panel">
              {insightsLoading && <div className="business-loading">Loading insights…</div>}
              {!insightsLoading && insights && (
                <>
                  <div className="business-insight-metrics">
                    <div className="business-insight-metric">
                      <span className="business-insight-metric-value">{insights.tripPlannerCount}</span>
                      <span className="business-insight-metric-label">Trip plans including this place</span>
                    </div>
                    <div className="business-insight-metric">
                      <span className="business-insight-metric-value">{insights.checkinCount}</span>
                      <span className="business-insight-metric-label">Check-ins recorded</span>
                    </div>
                  </div>
                  <p className="business-hint" style={{ marginBottom: '1rem' }}>
                    {insights.labels?.trips}. Names come from users who saved an itinerary that includes this venue.
                  </p>
                  <div className="business-subpanel">
                    <h3 className="business-subpanel-title">Who added this place to a trip</h3>
                    {insights.tripPlanners.length === 0 ? (
                      <p className="business-hint">No trip planner data yet.</p>
                    ) : (
                      <ul className="business-engage-list">
                        {insights.tripPlanners.map((row) => (
                          <li key={`${row.tripId}-${row.userId}`} className="business-engage-list-item">
                            <div>
                              <strong>{row.userName || 'Visitor'}</strong>
                              <span className="business-hint"> · {row.userEmail || '—'}</span>
                            </div>
                            <div className="business-hint">
                              Trip: {row.tripName} ·{' '}
                              {row.tripCreatedAt ? new Date(row.tripCreatedAt).toLocaleDateString() : ''}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="business-subpanel">
                    <h3 className="business-subpanel-title">Who checked in</h3>
                    <p className="business-hint" style={{ marginBottom: '0.75rem' }}>
                      {insights.labels?.checkins}
                    </p>
                    {insights.checkins.length === 0 ? (
                      <p className="business-hint">No check-ins yet.</p>
                    ) : (
                      <ul className="business-engage-list">
                        {insights.checkins.map((c) => (
                          <li key={c.id} className="business-engage-list-item">
                            <div>
                              <strong>{c.userName || 'Guest'}</strong>
                              <span className="business-hint"> · {c.userEmail || '—'}</span>
                            </div>
                            <div className="business-hint">
                              {c.createdAt ? new Date(c.createdAt).toLocaleString() : ''}
                              {c.note ? ` · ${c.note}` : ''}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <button type="button" className="business-btn business-btn--ghost" onClick={refreshEngagementApis}>
                    Refresh
                  </button>
                </>
              )}
            </div>
          )}

          {sectionTab === 'inquiries' && (
            <div className="business-engage-panel">
              {inquiriesLoading && <div className="business-loading">Loading inquiries…</div>}
              {!inquiriesLoading && inquiries.length === 0 && (
                <div className="business-empty-card">
                  <p>No messages yet. Visitors can send a note from your public place page.</p>
                </div>
              )}
              {!inquiriesLoading &&
                inquiries.map((q) => (
                  <article key={q.id} className="business-inquiry-card">
                    <div className="business-inquiry-head">
                      <div>
                        <strong>{q.userName || 'Visitor'}</strong>
                        <span className="business-hint"> · {q.userEmail}</span>
                        {q.guestPhone ? <span className="business-hint"> · {q.guestPhone}</span> : null}
                        {q.isGuest && <span className="business-feed-pill business-feed-pill--muted"> Guest</span>}
                        {q.isMessagingBlocked && (
                          <span className="business-feed-pill business-feed-pill--warn"> Messaging blocked</span>
                        )}
                      </div>
                      <span className="business-feed-pill">{q.status}</span>
                    </div>
                    {q.isMessagingBlocked ? (
                      <p className="business-hint" style={{ marginBottom: '0.65rem' }}>
                        This visitor cannot send new inquiries or follow-ups to this place until you unblock them.
                      </p>
                    ) : null}
                    <p className="business-inquiry-message">{q.message}</p>
                    {Array.isArray(q.visitorFollowups) &&
                      q.visitorFollowups.length > 0 &&
                      q.visitorFollowups.map((fu, idx) => (
                        <div key={`${q.id}-fu-${idx}`} className="business-inquiry-followup">
                          <span className="business-hint">
                            Visitor follow-up
                            {fu.createdAt ? ` · ${new Date(fu.createdAt).toLocaleString()}` : ''}
                          </span>
                          <p className="business-inquiry-message">{fu.body}</p>
                        </div>
                      ))}
                    {q.response && (
                      <div className="business-inquiry-reply">
                        <span className="business-hint">Your reply</span>
                        <p>{q.response}</p>
                      </div>
                    )}
                    {q.status !== 'archived' && (
                      <div className="business-inquiry-reply-box">
                        <textarea
                          className="business-textarea"
                          rows={3}
                          placeholder="Write a reply to the visitor…"
                          value={replyDraft[q.id] ?? ''}
                          onChange={(e) => setReplyDraft((d) => ({ ...d, [q.id]: e.target.value }))}
                        />
                        <div className="business-inquiry-actions">
                          <button
                            type="button"
                            className="business-btn business-btn--primary"
                            disabled={replyingId === q.id}
                            onClick={() => submitReply(q.id)}
                          >
                            {replyingId === q.id ? '…' : 'Send reply'}
                          </button>
                          <button
                            type="button"
                            className="business-btn business-btn--ghost"
                            disabled={replyingId === q.id}
                            onClick={() => archiveInquiry(q.id)}
                          >
                            Archive
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="business-inquiry-actions business-inquiry-actions--block">
                      <button
                        type="button"
                        className={`business-btn ${q.isMessagingBlocked ? 'business-btn--primary' : 'business-btn--ghost'}`}
                        disabled={replyingId === q.id}
                        onClick={() => toggleMessagingBlock(q)}
                        title={
                          q.isMessagingBlocked
                            ? 'Allow new messages from this visitor'
                            : 'Stop new inquiries and follow-ups from this visitor'
                        }
                      >
                        {q.isMessagingBlocked ? 'Unblock messaging' : 'Block messaging'}
                      </button>
                    </div>
                    <p className="business-hint" style={{ marginTop: '0.5rem' }}>
                      {q.createdAt ? new Date(q.createdAt).toLocaleString() : ''}
                    </p>
                  </article>
                ))}
            </div>
          )}

          {sectionTab === 'offers' && (
            <div className="business-engage-panel">
              <form onSubmit={submitPromo} className="business-panel" style={{ marginBottom: '1.25rem' }}>
                <h2 className="business-panel-title">New offer or coupon</h2>
                <div className="business-field">
                  <label htmlFor="po-title">Title</label>
                  <input
                    id="po-title"
                    className="business-input"
                    value={promoForm.title}
                    onChange={(e) => setPromoForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="Weekend brunch special"
                    required
                    maxLength={200}
                  />
                </div>
                <div className="business-field">
                  <label htmlFor="po-sub">Subtitle (optional)</label>
                  <input
                    id="po-sub"
                    className="business-input"
                    value={promoForm.subtitle}
                    onChange={(e) => setPromoForm((f) => ({ ...f, subtitle: e.target.value }))}
                    maxLength={500}
                  />
                </div>
                <div className="business-field-row">
                  <div className="business-field">
                    <label htmlFor="po-code">Promo code</label>
                    <input
                      id="po-code"
                      className="business-input"
                      value={promoForm.code}
                      onChange={(e) => setPromoForm((f) => ({ ...f, code: e.target.value }))}
                      placeholder="TRIPOLI10"
                      maxLength={64}
                    />
                  </div>
                  <div className="business-field">
                    <label htmlFor="po-disc">Discount label</label>
                    <input
                      id="po-disc"
                      className="business-input"
                      value={promoForm.discountLabel}
                      onChange={(e) => setPromoForm((f) => ({ ...f, discountLabel: e.target.value }))}
                      placeholder="10% off"
                      maxLength={120}
                    />
                  </div>
                </div>
                <div className="business-field">
                  <label htmlFor="po-terms">Terms (optional)</label>
                  <textarea
                    id="po-terms"
                    className="business-textarea"
                    rows={2}
                    value={promoForm.terms}
                    onChange={(e) => setPromoForm((f) => ({ ...f, terms: e.target.value }))}
                    maxLength={2000}
                  />
                </div>
                <div className="business-field-row">
                  <div className="business-field">
                    <label htmlFor="po-start">Starts (optional)</label>
                    <input
                      id="po-start"
                      type="datetime-local"
                      className="business-input"
                      value={promoForm.startsAt}
                      onChange={(e) => setPromoForm((f) => ({ ...f, startsAt: e.target.value }))}
                    />
                  </div>
                  <div className="business-field">
                    <label htmlFor="po-end">Ends (optional)</label>
                    <input
                      id="po-end"
                      type="datetime-local"
                      className="business-input"
                      value={promoForm.endsAt}
                      onChange={(e) => setPromoForm((f) => ({ ...f, endsAt: e.target.value }))}
                    />
                  </div>
                </div>
                <label className="business-field" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={promoForm.active}
                    onChange={(e) => setPromoForm((f) => ({ ...f, active: e.target.checked }))}
                  />
                  Active on place page
                </label>
                <button type="submit" className="business-btn business-btn--primary" disabled={promoSaving}>
                  {promoSaving ? 'Saving…' : 'Publish offer'}
                </button>
              </form>

              {promoLoading && <div className="business-loading">Loading offers…</div>}
              {!promoLoading && promotions.length === 0 && (
                <div className="business-empty-card">
                  <p>No offers yet. Create one above — it appears on your public listing when active.</p>
                </div>
              )}
              {!promoLoading && promotions.length > 0 && (
                <div className="business-promo-grid">
                  {promotions.map((p) => (
                    <article key={p.id} className="business-promo-card">
                      <div className="business-promo-card-top">
                        <h3>{p.title}</h3>
                        {p.discountLabel && <span className="business-promo-badge">{p.discountLabel}</span>}
                      </div>
                      {p.subtitle && <p className="business-hint">{p.subtitle}</p>}
                      {p.code && <code className="business-promo-code">{p.code}</code>}
                      {p.terms && <p className="business-promo-terms">{p.terms}</p>}
                      <div className="business-promo-card-actions">
                        <button
                          type="button"
                          className="business-btn business-btn--ghost"
                          onClick={() => togglePromoActive(p)}
                        >
                          {p.active ? 'Pause' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          className="business-btn business-btn--ghost"
                          style={{ color: 'var(--biz-danger)' }}
                          onClick={() => deletePromo(p.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {editing && (
        <div className="business-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="bf-edit-title">
          <div className="business-modal">
            <div className="business-modal-head">
              <h2 id="bf-edit-title">Edit post</h2>
              <button type="button" className="business-modal-x" aria-label="Close" onClick={() => setEditing(null)}>
                ×
              </button>
            </div>
            <form onSubmit={saveEdit}>
              <div className="business-modal-body">
                <div className="business-field">
                  <label htmlFor="bf-e-cap">Caption</label>
                  <textarea
                    id="bf-e-cap"
                    className="business-textarea"
                    rows={5}
                    value={editing.caption || ''}
                    onChange={(e) => setEditing((x) => ({ ...x, caption: e.target.value }))}
                    maxLength={8000}
                  />
                </div>
                <div className="business-field">
                  <label htmlFor="bf-e-img">Image URL</label>
                  <input
                    id="bf-e-img"
                    className="business-input"
                    value={editing.image_url || ''}
                    onChange={(e) => setEditing((x) => ({ ...x, image_url: e.target.value }))}
                  />
                </div>
                <div className="business-field">
                  <label htmlFor="bf-e-vid">Video URL</label>
                  <input
                    id="bf-e-vid"
                    className="business-input"
                    value={editing.video_url || ''}
                    onChange={(e) => setEditing((x) => ({ ...x, video_url: e.target.value }))}
                  />
                </div>
                <div className="business-field">
                  <label htmlFor="bf-e-kind">Content type</label>
                  <select
                    id="bf-e-kind"
                    className="business-select"
                    value={contentKind(editing.type)}
                    onChange={(e) =>
                      setEditing((x) => ({ ...x, type: e.target.value === 'reel' ? 'reel' : 'post' }))
                    }
                  >
                    <option value="post">Feed post</option>
                    <option value="reel">Reel (short video)</option>
                  </select>
                </div>
              </div>
              <div className="business-modal-foot">
                <button type="button" className="business-btn business-btn--ghost" onClick={() => setEditing(null)}>
                  Cancel
                </button>
                <button type="submit" className="business-btn business-btn--primary" disabled={saving}>
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
