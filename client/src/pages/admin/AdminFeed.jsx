import { useState, useEffect, useCallback, Fragment } from 'react';
import api, { getImageUrl, fixImageUrlExtension } from '../../api/client';
import './Admin.css';

function contentKind(t) {
  const x = String(t || '').toLowerCase();
  if (x === 'reel' || x === 'video') return 'reel';
  return 'post';
}

function resolvedMediaUrl(url) {
  if (!url || typeof url !== 'string' || !String(url).trim()) return null;
  return getImageUrl(fixImageUrlExtension(String(url).trim())) || null;
}

/** Match business portal: explicit reel or legacy video-only (no cover). */
function isReelCard(p) {
  const t = String(p?.type || '').toLowerCase();
  if (t === 'reel' || t === 'video') return true;
  const hasImage = !!resolvedMediaUrl(p?.image_url);
  const hasVideo = !!resolvedMediaUrl(p?.video_url);
  return hasVideo && !hasImage;
}

function captionForDisplay(raw) {
  if (raw == null) return '';
  const s = String(raw).trim();
  if (!s || s.toLowerCase() === 'null') return '';
  return s;
}

function typeBadgeText(p) {
  if (isReelCard(p)) return 'video';
  const t = p?.type != null ? String(p.type).trim() : '';
  if (!t || t.toLowerCase() === 'null') return 'post';
  return t.toLowerCase();
}

export default function AdminFeed() {
  const [posts, setPosts] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [migrationError, setMigrationError] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [saving, setSaving] = useState(null);

  const [status, setStatus] = useState('all');
  const [discoverable, setDiscoverable] = useState('all');
  const [contentFormat, setContentFormat] = useState('all');
  const [q, setQ] = useState('');

  const [expandedId, setExpandedId] = useState(null);
  const [comments, setComments] = useState({});
  const [loadingComments, setLoadingComments] = useState(null);

  const [editPost, setEditPost] = useState(null);

  const [placeSearch, setPlaceSearch] = useState('');
  const [placeOptions, setPlaceOptions] = useState([]);
  const [composerPlaceId, setComposerPlaceId] = useState('');
  const [composerContentKind, setComposerContentKind] = useState('post');
  const [composerCaption, setComposerCaption] = useState('');
  const [composerImage, setComposerImage] = useState('');
  const [composerVideo, setComposerVideo] = useState('');
  const [composerModeration, setComposerModeration] = useState('approved');
  const [composerDiscoverable, setComposerDiscoverable] = useState(true);
  const [composerUploading, setComposerUploading] = useState(false);
  const [composerSaving, setComposerSaving] = useState(false);

  const load = useCallback((silent) => {
    if (!silent) {
      setLoading(true);
      setError(null);
      setMigrationError(null);
    }
    const params = {
      status,
      discoverable,
      q: q.trim() || undefined,
      limit: 200,
      format: contentFormat !== 'all' ? contentFormat : undefined,
    };
    api.admin.feed
      .list(params)
      .then((r) => {
        setPosts(r.posts || []);
        setPendingCount(typeof r.pendingCount === 'number' ? r.pendingCount : 0);
      })
      .catch((err) => {
        const msg = err.message || 'Failed to load feed';
        if (!silent) {
          setError(msg);
          if (err.status === 503 || /migration/i.test(msg)) setMigrationError(msg);
        }
      })
      .finally(() => {
        if (!silent) setLoading(false);
      });
  }, [status, discoverable, contentFormat, q]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      api.admin.places
        .list({ q: placeSearch.trim() || undefined, limit: 100 })
        .then((r) => {
          if (cancelled) return;
          const list = r.places || [];
          setPlaceOptions(list);
          setComposerPlaceId((prev) => {
            if (prev && list.some((p) => p.id === prev)) return prev;
            return list[0]?.id || '';
          });
        })
        .catch(() => {
          if (!cancelled) setPlaceOptions([]);
        });
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [placeSearch]);

  const submitComposer = async (e) => {
    e.preventDefault();
    if (!composerPlaceId || !composerCaption.trim()) {
      setError('Choose a place and enter a caption.');
      return;
    }
    if (composerContentKind === 'reel' && !composerVideo.trim()) {
      setError('Reels need a direct video URL (https://…).');
      return;
    }
    setComposerSaving(true);
    setError(null);
    try {
      await api.admin.feed.create({
        placeId: composerPlaceId,
        caption: composerCaption.trim(),
        image_url: composerImage.trim() || undefined,
        video_url: composerVideo.trim() || undefined,
        type: composerContentKind === 'reel' ? 'video' : 'post',
        moderation_status: composerModeration,
        discoverable: composerDiscoverable,
      });
      setComposerCaption('');
      setComposerImage('');
      setComposerVideo('');
      await load(true);
    } catch (err) {
      setError(err.message || 'Could not create post');
    } finally {
      setComposerSaving(false);
    }
  };

  const onComposerImageUpload = async (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file) return;
    setComposerUploading(true);
    setError(null);
    try {
      const url = await api.admin.upload(file);
      if (url) setComposerImage(url);
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setComposerUploading(false);
    }
  };

  const loadComments = async (postId) => {
    if (comments[postId]) return;
    setLoadingComments(postId);
    try {
      const r = await api.admin.feed.comments(postId);
      setComments((c) => ({ ...c, [postId]: r.comments || [] }));
    } catch (err) {
      setError(err.message || 'Failed to load comments');
    } finally {
      setLoadingComments(null);
    }
  };

  const toggleExpand = (id) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    loadComments(id);
  };

  const patchPost = async (id, body) => {
    setSaving(id);
    setError(null);
    try {
      const r = await api.admin.feed.update(id, body);
      const updated = r.post;
      setPosts((list) => list.map((p) => (p.id === id ? { ...p, ...updated } : p)));
      load(true);
    } catch (err) {
      setError(err.message || 'Update failed');
    } finally {
      setSaving(null);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this post and all comments, likes, and saves?')) return;
    setDeleting(id);
    try {
      await api.admin.feed.delete(id);
      setPosts((p) => p.filter((x) => x.id !== id));
      setExpandedId((e) => (e === id ? null : e));
    } catch (err) {
      setError(err.message || 'Delete failed');
    } finally {
      setDeleting(null);
    }
  };

  const removeComment = async (postId, commentId) => {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await api.admin.feed.deleteComment(commentId);
      setComments((c) => ({
        ...c,
        [postId]: (c[postId] || []).filter((x) => x.id !== commentId),
      }));
      setPosts((list) =>
        list.map((p) =>
          p.id === postId ? { ...p, comments_count: Math.max(0, (p.comments_count || 1) - 1) } : p
        )
      );
    } catch (err) {
      setError(err.message || 'Failed to delete comment');
    }
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    if (!editPost) return;
    const { id, caption, image_url, video_url, admin_notes, moderation_status } = editPost;
    await patchPost(id, {
      caption,
      type: contentKind(editPost.type) === 'reel' ? 'video' : 'post',
      image_url: image_url || null,
      video_url: video_url || null,
      admin_notes: admin_notes || null,
      moderation_status,
    });
    setEditPost(null);
  };

  return (
    <div className="admin-page-content">
      <div className="admin-page-header">
        <div className="admin-page-title-wrap">
          <p className="admin-subtitle">Moderate community posts, discovery visibility, captions, and comments</p>
          <h1>Feed control center</h1>
        </div>
      </div>

      {migrationError && (
        <div className="admin-error admin-feed-banner" role="alert">
          Database migration required: run <code>server/migrations/006_feed_moderation.sql</code> so moderation and discovery fields exist.
        </div>
      )}
      {error && <div className="admin-error">{error}</div>}

      <div className="admin-feed-stats">
        <div className="admin-feed-stat">
          <span className="admin-feed-stat-value">{pendingCount}</span>
          <span className="admin-feed-stat-label">Pending review</span>
        </div>
        <div className="admin-feed-stat">
          <span className="admin-feed-stat-value">{posts.length}</span>
          <span className="admin-feed-stat-label">Listed (this filter)</span>
        </div>
      </div>

      <div className="admin-card admin-feed-composer">
        <div className="admin-card-header">
          <h2 className="admin-card-title">Create post or reel (any place)</h2>
          <p className="admin-subtitle" style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', opacity: 0.9 }}>
            Publish to the community feed on behalf of any listing. Image uploads use Supabase; reels need a direct video URL (e.g. MP4).
          </p>
        </div>
        <div className="admin-card-body">
          <form onSubmit={submitComposer} className="admin-feed-composer-form">
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label htmlFor="admin-feed-place-search">Find place</label>
                <input
                  id="admin-feed-place-search"
                  type="search"
                  value={placeSearch}
                  onChange={(e) => setPlaceSearch(e.target.value)}
                  placeholder="Search by name, id, or location…"
                  autoComplete="off"
                />
              </div>
              <div className="admin-form-group">
                <label htmlFor="admin-feed-place-select">Place *</label>
                <select
                  id="admin-feed-place-select"
                  value={composerPlaceId}
                  onChange={(e) => setComposerPlaceId(e.target.value)}
                  required
                >
                  {!placeOptions.length && <option value="">No places — adjust search</option>}
                  {placeOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {(p.name || p.id) + (p.location ? ` — ${p.location}` : '')}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="admin-form-row admin-form-row--3">
              <div className="admin-form-group">
                <label htmlFor="admin-feed-kind">Content</label>
                <select
                  id="admin-feed-kind"
                  value={composerContentKind}
                  onChange={(e) => setComposerContentKind(e.target.value)}
                >
                  <option value="post">Feed post</option>
                  <option value="reel">Reel (short video)</option>
                </select>
              </div>
              <div className="admin-form-group">
                <label htmlFor="admin-feed-mod-new">Moderation</label>
                <select
                  id="admin-feed-mod-new"
                  value={composerModeration}
                  onChange={(e) => setComposerModeration(e.target.value)}
                >
                  <option value="approved">approved (live if discoverable)</option>
                  <option value="pending">pending (review first)</option>
                  <option value="rejected">rejected (hidden)</option>
                </select>
              </div>
              <div className="admin-form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                <label style={{ marginBottom: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={composerDiscoverable}
                    onChange={(e) => setComposerDiscoverable(e.target.checked)}
                  />
                  <span>Show in public discovery</span>
                </label>
              </div>
            </div>
            <div className="admin-form-group">
              <label htmlFor="admin-feed-cap">Caption *</label>
              <textarea
                id="admin-feed-cap"
                rows={4}
                value={composerCaption}
                onChange={(e) => setComposerCaption(e.target.value)}
                placeholder="Caption for this post…"
                maxLength={8000}
                required
              />
            </div>
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label htmlFor="admin-feed-img-url">Image URL (optional)</label>
                <input
                  id="admin-feed-img-url"
                  value={composerImage}
                  onChange={(e) => setComposerImage(e.target.value)}
                  placeholder="https://… or upload below"
                />
              </div>
              <div className="admin-form-group">
                <label htmlFor="admin-feed-vid-url">Video URL {composerContentKind === 'reel' ? '(required for reel)' : '(optional)'}</label>
                <input
                  id="admin-feed-vid-url"
                  value={composerVideo}
                  onChange={(e) => setComposerVideo(e.target.value)}
                  placeholder="https://… (direct MP4 or hosted file)"
                />
              </div>
            </div>
            <div className="admin-form-group">
              <label htmlFor="admin-feed-img-file">Upload image</label>
              <input
                id="admin-feed-img-file"
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={onComposerImageUpload}
                disabled={composerUploading}
              />
              {composerUploading && <span className="admin-form-hint"> Uploading…</span>}
            </div>
            <div className="admin-page-header-actions" style={{ marginTop: '0.5rem' }}>
              <button
                type="submit"
                className="admin-btn admin-btn--primary"
                disabled={composerSaving || composerUploading || !composerPlaceId}
              >
                {composerSaving ? 'Publishing…' : 'Publish'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="admin-card admin-feed-filters">
        <div className="admin-card-body" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
          <div className="admin-form-group" style={{ marginBottom: 0, minWidth: 160 }}>
            <label htmlFor="feed-status">Moderation</label>
            <select id="feed-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div className="admin-form-group" style={{ marginBottom: 0, minWidth: 160 }}>
            <label htmlFor="feed-disc">Discoverable</label>
            <select id="feed-disc" value={discoverable} onChange={(e) => setDiscoverable(e.target.value)}>
              <option value="all">Any</option>
              <option value="true">Yes (public discovery)</option>
              <option value="false">No</option>
            </select>
          </div>
          <div className="admin-form-group" style={{ marginBottom: 0, minWidth: 160 }}>
            <label htmlFor="feed-format">Content</label>
            <select id="feed-format" value={contentFormat} onChange={(e) => setContentFormat(e.target.value)}>
              <option value="all">All</option>
              <option value="post">Posts</option>
              <option value="reel">Reels</option>
            </select>
          </div>
          <div className="admin-form-group" style={{ marginBottom: 0, flex: 1, minWidth: 200 }}>
            <label htmlFor="feed-q">Search</label>
            <input
              id="feed-q"
              type="search"
              placeholder="Caption, author, place, email…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <button type="button" className="admin-btn admin-btn--secondary" onClick={load}>
            Refresh
          </button>
        </div>
      </div>

      <div className="admin-widgets admin-dashboard-grid" style={{ gridTemplateColumns: 'repeat(12, 1fr)' }}>
        <div className="admin-card" style={{ gridColumn: 'span 12' }}>
          <div className="admin-card-body" style={{ padding: 0 }}>
            {loading && <div className="admin-loading" style={{ padding: '1.5rem' }}>Loading…</div>}
            {!loading && posts.length === 0 && <div className="admin-empty" style={{ padding: '1.5rem' }}>No posts match.</div>}
            {!loading && posts.length > 0 && (
              <div className="admin-feed-table-wrap">
                <table className="admin-table admin-feed-table">
                  <thead>
                    <tr>
                      <th style={{ width: 56 }}>Media</th>
                      <th>Post</th>
                      <th>Author</th>
                      <th>Moderation</th>
                      <th>Discovery</th>
                      <th style={{ whiteSpace: 'nowrap' }}>♥ / 💬</th>
                      <th style={{ width: 200 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {posts.map((p) => (
                      <Fragment key={p.id}>
                        <tr className="admin-feed-row">
                          <td>
                            {resolvedMediaUrl(p.image_url) ? (
                              <img className="admin-feed-thumb" src={resolvedMediaUrl(p.image_url)} alt="" />
                            ) : resolvedMediaUrl(p.video_url) ? (
                              <video
                                className="admin-feed-thumb admin-feed-thumb--video"
                                src={resolvedMediaUrl(p.video_url)}
                                muted
                                playsInline
                                preload="metadata"
                                aria-label="Video preview"
                              />
                            ) : (
                              <span className="admin-feed-thumb-placeholder">—</span>
                            )}
                          </td>
                          <td>
                            <div className="admin-feed-caption">
                              {(() => {
                                const cap = captionForDisplay(p.caption);
                                if (!cap) return <span className="admin-feed-caption-empty">—</span>;
                                return (
                                  <>
                                    {cap.slice(0, 200)}
                                    {cap.length > 200 ? '…' : ''}
                                  </>
                                );
                              })()}
                            </div>
                            <div className="admin-feed-meta">
                              <span
                                className={`admin-feed-badge ${isReelCard(p) ? 'admin-feed-badge--reel' : ''}`}
                              >
                                {typeBadgeText(p)}
                              </span>
                              {p.place_id && <span>Place: {p.place_id}</span>}
                              <span title={p.created_at}>{new Date(p.created_at).toLocaleString()}</span>
                            </div>
                          </td>
                          <td>
                            <strong>{p.author_name || '—'}</strong>
                            <div className="admin-feed-email">{p.user_email || ''}</div>
                            <div className="admin-feed-role">{p.author_role || ''}</div>
                          </td>
                          <td>
                            <span className={`admin-feed-mod admin-feed-mod--${p.moderation_status || 'approved'}`}>
                              {p.moderation_status || 'approved'}
                            </span>
                          </td>
                          <td>{p.discoverable !== false ? 'Yes' : 'No'}</td>
                          <td>
                            {p.likes_count ?? 0} / {p.comments_count ?? 0}
                          </td>
                          <td>
                            <div className="admin-feed-actions">
                              {(p.moderation_status || 'approved') === 'pending' && (
                                <>
                                  <button
                                    type="button"
                                    className="admin-btn admin-btn--sm admin-btn--primary"
                                    disabled={saving === p.id}
                                    onClick={() => patchPost(p.id, { moderation_status: 'approved', discoverable: true })}
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    className="admin-btn admin-btn--sm admin-btn--secondary"
                                    disabled={saving === p.id}
                                    onClick={() => patchPost(p.id, { moderation_status: 'rejected', discoverable: false })}
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                              {(p.moderation_status || 'approved') === 'approved' && (
                                <button
                                  type="button"
                                  className="admin-btn admin-btn--sm admin-btn--secondary"
                                  disabled={saving === p.id}
                                  onClick={() => patchPost(p.id, { discoverable: p.discoverable === false })}
                                >
                                  {p.discoverable === false ? 'Show in discovery' : 'Hide from discovery'}
                                </button>
                              )}
                              <button
                                type="button"
                                className="admin-btn admin-btn--sm admin-btn--secondary"
                                onClick={() =>
                                  setEditPost({
                                    ...p,
                                    type: isReelCard(p) ? 'video' : 'post',
                                    caption: captionForDisplay(p.caption),
                                  })
                                }
                              >
                                Edit
                              </button>
                              <button type="button" className="admin-btn admin-btn--sm admin-btn--secondary" onClick={() => toggleExpand(p.id)}>
                                {expandedId === p.id ? 'Hide comments' : 'Comments'}
                              </button>
                              <button
                                type="button"
                                className="admin-btn admin-btn--sm admin-btn--danger"
                                disabled={deleting === p.id}
                                onClick={() => remove(p.id)}
                              >
                                {deleting === p.id ? '…' : 'Delete'}
                              </button>
                            </div>
                          </td>
                        </tr>
                        {expandedId === p.id && (
                          <tr className="admin-feed-comments-row">
                            <td colSpan={7}>
                              <div className="admin-feed-comments-panel">
                                {loadingComments === p.id && <div className="admin-loading">Loading comments…</div>}
                                {loadingComments !== p.id && (comments[p.id] || []).length === 0 && (
                                  <div className="admin-empty">No comments.</div>
                                )}
                                {(comments[p.id] || []).map((c) => (
                                  <div key={c.id} className="admin-feed-comment">
                                    <div className="admin-feed-comment-head">
                                      <strong>{c.author_name}</strong>
                                      <span className="admin-feed-email">{c.user_email || ''}</span>
                                      <span className="admin-feed-comment-date">{new Date(c.created_at).toLocaleString()}</span>
                                      <button
                                        type="button"
                                        className="admin-btn admin-btn--sm admin-btn--danger"
                                        onClick={() => removeComment(p.id, c.id)}
                                      >
                                        Remove
                                      </button>
                                    </div>
                                    <p className="admin-feed-comment-body">{c.body}</p>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {editPost && (
        <div className="admin-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="feed-edit-title">
          <div className="admin-modal">
            <div className="admin-modal-header">
              <h2 id="feed-edit-title">Edit post</h2>
              <button type="button" className="admin-modal-close" aria-label="Close" onClick={() => setEditPost(null)}>
                ×
              </button>
            </div>
            <form onSubmit={saveEdit}>
              <div className="admin-modal-body">
                <div className="admin-form-group">
                  <label htmlFor="edit-cap">Caption</label>
                  <textarea
                    id="edit-cap"
                    rows={4}
                    value={editPost.caption || ''}
                    onChange={(e) => setEditPost((x) => ({ ...x, caption: e.target.value }))}
                  />
                </div>
                <div className="admin-form-row">
                  <div className="admin-form-group">
                    <label htmlFor="edit-type">Content</label>
                    <select
                      id="edit-type"
                      value={contentKind(editPost.type)}
                      onChange={(e) =>
                        setEditPost((x) => ({ ...x, type: e.target.value === 'reel' ? 'video' : 'post' }))
                      }
                    >
                      <option value="post">Feed post</option>
                      <option value="reel">Reel (short video)</option>
                    </select>
                  </div>
                </div>
                <div className="admin-form-group">
                  <label htmlFor="edit-img">Image URL</label>
                  <input id="edit-img" value={editPost.image_url || ''} onChange={(e) => setEditPost((x) => ({ ...x, image_url: e.target.value }))} />
                </div>
                <div className="admin-form-group">
                  <label htmlFor="edit-vid">Video URL</label>
                  <input id="edit-vid" value={editPost.video_url || ''} onChange={(e) => setEditPost((x) => ({ ...x, video_url: e.target.value }))} />
                </div>
                <div className="admin-form-group">
                  <label htmlFor="edit-notes">Internal admin notes</label>
                  <textarea
                    id="edit-notes"
                    rows={2}
                    value={editPost.admin_notes || ''}
                    onChange={(e) => setEditPost((x) => ({ ...x, admin_notes: e.target.value }))}
                  />
                </div>
                <div className="admin-form-row">
                  <div className="admin-form-group">
                    <label htmlFor="edit-mod">Moderation</label>
                    <select
                      id="edit-mod"
                      value={editPost.moderation_status || 'approved'}
                      onChange={(e) => setEditPost((x) => ({ ...x, moderation_status: e.target.value }))}
                    >
                      <option value="pending">pending</option>
                      <option value="approved">approved</option>
                      <option value="rejected">rejected</option>
                    </select>
                  </div>
                </div>
                <p className="admin-form-hint" style={{ marginTop: 0 }}>
                  Discovery visibility is changed from the table (Hide / Show in discovery), not here.
                </p>
              </div>
              <div className="admin-modal-footer">
                <button type="button" className="admin-btn admin-btn--secondary" onClick={() => setEditPost(null)}>
                  Cancel
                </button>
                <button type="submit" className="admin-btn admin-btn--primary" disabled={saving === editPost.id}>
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
