import { useState, useRef, useCallback, useEffect, useMemo, Fragment } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { getImageUrl, fixImageUrlExtension, getPlaceImageUrl, API_ERROR_NETWORK } from '../api/client';
import Icon from './Icon';
import { isCommunityFeedVideo } from './CommunityFeed';
import { useLanguage } from '../context/LanguageContext';
import { formatFeedTime } from '../utils/feedTime';
import { rawFeedImageUrls, MAX_FEED_POST_IMAGES } from '../utils/feedPostImages';
import { COMMUNITY_PATH, discoverPlaceFeedPath } from '../utils/discoverPaths';

function mediaUrl(url) {
  if (!url || typeof url !== 'string') return '';
  return getImageUrl(fixImageUrlExtension(url));
}

function isLikelyStreamableVideoUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const u = url.trim().toLowerCase();
  if (u.includes('youtube.com') || u.includes('youtu.be') || u.includes('vimeo.com')) return false;
  return /^https?:\/\//i.test(u) || u.startsWith('/');
}

/** Group flat API list into roots with nested replies (one level). */
function nestComments(list) {
  const items = list.map((c) => ({ ...c, replies: [] }));
  const byId = new Map(items.map((c) => [c.id, c]));
  const roots = [];
  for (const c of items) {
    if (!c.parentId) roots.push(c);
    else {
      const p = byId.get(c.parentId);
      if (p) p.replies.push(c);
      else roots.push(c);
    }
  }
  const sortByTime = (a, b) => new Date(a.createdAt) - new Date(b.createdAt);
  roots.sort(sortByTime);
  roots.forEach((r) => r.replies.sort(sortByTime));
  return roots;
}

function removeCommentAndReplies(comments, deletedId) {
  return comments.filter((c) => c.id !== deletedId && c.parentId !== deletedId);
}

function commentLooksEdited(c) {
  if (!c.updatedAt || !c.createdAt) return false;
  return new Date(c.updatedAt) > new Date(c.createdAt);
}

/** TikTok-style compact counts (e.g. 79.5K). */
function formatCompactCount(n) {
  const x = Number(n) || 0;
  if (x < 1000) return String(x);
  if (x < 1_000_000) return `${(x / 1000).toFixed(x % 1000 === 0 ? 0 : 1)}K`;
  return `${(x / 1_000_000).toFixed(1)}M`;
}

export default function FeedPostCard({
  post,
  user,
  onPatch,
  onRemove,
  t,
  variant = 'feed',
  discoverBasePath = COMMUNITY_PATH,
  isActiveReel = false,
}) {
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentsFetched, setCommentsFetched] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [replyToId, setReplyToId] = useState(null);
  const [posting, setPosting] = useState(false);
  const [heartBurst, setHeartBurst] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editText, setEditText] = useState('');
  const [commentWriteBusyId, setCommentWriteBusyId] = useState(null);
  const [likePopKey, setLikePopKey] = useState(0);
  const [likeAnimDir, setLikeAnimDir] = useState('up');
  const [feedActionMsg, setFeedActionMsg] = useState(null);
  const lastTapRef = useRef(0);
  const feedActionMsgTimerRef = useRef(null);
  const likeSnapRef = useRef({
    liked: post.liked_by_me === true,
    count: Number(post.likes_count) || 0,
  });
  const likeSeqRef = useRef(0);
  const commentLikeSnapRef = useRef(new Map());
  const commentLikeSeqRef = useRef({});
  const commentInputRef = useRef(null);
  const editTextareaRef = useRef(null);
  const reelVideoRef = useRef(null);
  const [reelMuted, setReelMuted] = useState(true);
  const [reelProgress, setReelProgress] = useState(0);
  const [feedHeaderMoreOpen, setFeedHeaderMoreOpen] = useState(false);
  const feedHeaderMoreRef = useRef(null);
  const [ownerEditOpen, setOwnerEditOpen] = useState(false);
  const [ownerEditCaption, setOwnerEditCaption] = useState('');
  const [ownerEditImages, setOwnerEditImages] = useState([]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const galleryRef = useRef(null);
  const [ownerEditVideoUrl, setOwnerEditVideoUrl] = useState('');
  const [ownerEditUploading, setOwnerEditUploading] = useState(null);
  const [ownerEditShowAdvanced, setOwnerEditShowAdvanced] = useState(false);
  const [ownerSaving, setOwnerSaving] = useState(false);
  const [imageZoomOpen, setImageZoomOpen] = useState(false);
  const [imageZoomSrc, setImageZoomSrc] = useState('');
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : false
  );

  const liked = post.liked_by_me === true;
  const saved = post.saved_by_me === true;
  const likesCount = Number(post.likes_count) || 0;
  const commentsCount = Number(post.comments_count) || 0;
  const placeId = post.place_id != null ? String(post.place_id) : '';
  const placeName =
    post.place_name != null && String(post.place_name).trim()
      ? String(post.place_name).trim()
      : '';
  const authorName =
    post.author_name != null && String(post.author_name).trim()
      ? String(post.author_name).trim()
      : '';
  const displayName = placeName || authorName || '—';
  const venueFeedPath = placeId ? discoverPlaceFeedPath(placeId) : '';
  const placeAvatarUrl = (() => {
    const raw = post.place_image_url;
    if (raw == null || typeof raw !== 'string' || !String(raw).trim()) return null;
    return getPlaceImageUrl(String(raw).trim());
  })();
  const isVideo = isCommunityFeedVideo(post);
  const gallerySrcs = useMemo(() => {
    const raw = rawFeedImageUrls(post);
    return raw.map((u) => mediaUrl(u)).filter(Boolean);
  }, [post.id, post.image_url, post.image_urls]);
  const img = gallerySrcs[0] || '';
  const vid = post.video_url ? mediaUrl(post.video_url) : '';
  const showVideo = isVideo && vid && isLikelyStreamableVideoUrl(post.video_url);
  const externalVideo = isVideo && post.video_url && !showVideo;
  const timeLabel = formatFeedTime(post.created_at, lang);
  const hideLikes = post.hide_likes === true;
  const commentsDisabled = post.comments_disabled === true;
  const iManagePost = post.i_manage_post === true;

  async function loadComments() {
    if (loadingComments || commentsFetched) return;
    setLoadingComments(true);
    try {
      const r = await api.feedPublic.comments(post.id);
      setComments(Array.isArray(r.comments) ? r.comments : []);
    } catch {
      setComments([]);
    } finally {
      setLoadingComments(false);
      setCommentsFetched(true);
    }
  }

  const openComments = () => {
    if (commentsDisabled) return;
    setCommentsOpen(true);
    loadComments();
  };

  const toggleComments = () => {
    if (commentsDisabled) return;
    if (commentsOpen) {
      setCommentsOpen(false);
      return;
    }
    setCommentsOpen(true);
    loadComments();
  };

  useEffect(() => {
    if (!commentsOpen) return;
    const id = window.requestAnimationFrame(() => {
      commentInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [commentsOpen]);

  useEffect(() => {
    likeSnapRef.current = {
      liked: post.liked_by_me === true,
      count: Number(post.likes_count) || 0,
    };
  }, [post.id, post.liked_by_me, post.likes_count]);

  useEffect(() => {
    setGalleryIndex(0);
    if (galleryRef.current) galleryRef.current.scrollLeft = 0;
  }, [post.id]);

  useEffect(() => {
    if (commentsDisabled) {
      setCommentsOpen(false);
    }
  }, [commentsDisabled, post.id]);

  useEffect(() => {
    const m = commentLikeSnapRef.current;
    comments.forEach((c) => {
      m.set(c.id, { liked: c.likedByMe === true, count: Number(c.likesCount) || 0 });
    });
  }, [comments]);

  const requireAuth = useCallback(() => {
    if (!user) {
      navigate('/login', { state: { from: discoverBasePath } });
      return false;
    }
    return true;
  }, [user, navigate, discoverBasePath]);

  const showFeedActionError = useCallback(
    (e) => {
      const status = e?.status;
      const apiText =
        typeof e?.data?.error === 'string' && e.data.error.trim()
          ? e.data.error.trim()
          : typeof e?.message === 'string' && e.message.trim()
            ? e.message.trim()
            : '';
      const blocked = e?.data?.code === 'ACCOUNT_BLOCKED';
      const code = e?.data?.code;
      let msg;
      if (e?.code === API_ERROR_NETWORK) {
        msg = t('errors', 'networkError');
      } else if (status === 401) {
        msg = t('discover', 'feedActionAuth');
      } else if (status === 403 && code === 'LIKES_HIDDEN') {
        msg = t('discover', 'feedLikesHiddenMsg');
      } else if (status === 403 && code === 'COMMENTS_DISABLED') {
        msg = t('discover', 'feedCommentsOffMsg');
      } else if (status === 403 && blocked && apiText) {
        msg = apiText;
      } else if (
        apiText &&
        apiText !== 'Request failed' &&
        apiText.length < 260 &&
        typeof status === 'number' &&
        status >= 400
      ) {
        msg = apiText;
      } else {
        msg = t('discover', 'feedActionFailed');
      }
      setFeedActionMsg(msg);
      if (feedActionMsgTimerRef.current) clearTimeout(feedActionMsgTimerRef.current);
      feedActionMsgTimerRef.current = window.setTimeout(() => {
        feedActionMsgTimerRef.current = null;
        setFeedActionMsg(null);
      }, 6000);
    },
    [t]
  );

  useEffect(() => {
    return () => {
      if (feedActionMsgTimerRef.current) clearTimeout(feedActionMsgTimerRef.current);
    };
  }, []);

  const [reelMoreOpen, setReelMoreOpen] = useState(false);
  const reelMoreRef = useRef(null);

  useEffect(() => {
    setReelProgress(0);
    setReelMuted(true);
    setReelMoreOpen(false);
    setFeedHeaderMoreOpen(false);
    setOwnerEditOpen(false);
  }, [post.id]);

  useEffect(() => {
    if (!imageZoomOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setImageZoomOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [imageZoomOpen]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia('(min-width: 1024px)');
    const apply = () => setIsDesktop(mq.matches);
    apply();
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
    mq.addListener(apply);
    return () => mq.removeListener(apply);
  }, []);

  useEffect(() => {
    if (!reelMoreOpen) return undefined;
    const onDown = (e) => {
      if (reelMoreRef.current && !reelMoreRef.current.contains(e.target)) {
        setReelMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [reelMoreOpen]);

  useEffect(() => {
    if (!feedHeaderMoreOpen) return undefined;
    const onDown = (e) => {
      if (feedHeaderMoreRef.current && !feedHeaderMoreRef.current.contains(e.target)) {
        setFeedHeaderMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [feedHeaderMoreOpen]);

  useEffect(() => {
    if (!ownerEditOpen && !feedHeaderMoreOpen && !reelMoreOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (ownerSaving) return;
        setOwnerEditOpen(false);
        setFeedHeaderMoreOpen(false);
        setReelMoreOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [ownerEditOpen, feedHeaderMoreOpen, reelMoreOpen, ownerSaving]);

  const clearFeedActionMsg = useCallback(() => {
    if (feedActionMsgTimerRef.current) {
      clearTimeout(feedActionMsgTimerRef.current);
      feedActionMsgTimerRef.current = null;
    }
    setFeedActionMsg(null);
  }, []);

  const handleLike = useCallback(() => {
    if (hideLikes) return;
    if (!requireAuth()) return;
    clearFeedActionMsg();
    const prev = { ...likeSnapRef.current };
    const nextLiked = !prev.liked;
    const nextCount = Math.max(0, prev.count + (prev.liked ? -1 : 1));
    likeSnapRef.current = { liked: nextLiked, count: nextCount };
    const seq = ++likeSeqRef.current;
    onPatch(post.id, { liked_by_me: nextLiked, likes_count: nextCount });

    const runToggle = () => api.feedPublic.toggleLike(post.id);

    void (async () => {
      try {
        let r;
        try {
          r = await runToggle();
        } catch (e) {
          if (seq !== likeSeqRef.current) return;
          if (e?.code === API_ERROR_NETWORK) {
            await new Promise((res) => setTimeout(res, 420));
            if (seq !== likeSeqRef.current) return;
            r = await runToggle();
          } else {
            throw e;
          }
        }
        if (seq !== likeSeqRef.current) return;
        likeSnapRef.current = { liked: r.liked, count: Number(r.likes_count) || 0 };
        onPatch(post.id, { liked_by_me: r.liked, likes_count: r.likes_count });
      } catch (e) {
        if (seq !== likeSeqRef.current) return;
        likeSnapRef.current = prev;
        onPatch(post.id, { liked_by_me: prev.liked, likes_count: prev.count });
        showFeedActionError(e);
      }
    })();
  }, [hideLikes, requireAuth, post.id, onPatch, clearFeedActionMsg, showFeedActionError]);

  const onPostLikeClick = useCallback(() => {
    setLikeAnimDir(likeSnapRef.current.liked ? 'down' : 'up');
    setLikePopKey((k) => k + 1);
    handleLike();
  }, [handleLike]);

  const triggerHeartBurst = useCallback(() => {
    setHeartBurst(true);
    window.setTimeout(() => setHeartBurst(false), 900);
  }, []);

  const onDoubleTapMedia = useCallback(() => {
    if (hideLikes) return;
    triggerHeartBurst();
    if (!user) {
      navigate('/login', { state: { from: discoverBasePath } });
      return;
    }
    if (!likeSnapRef.current.liked) {
      setLikeAnimDir('up');
      setLikePopKey((k) => k + 1);
      handleLike();
    }
  }, [hideLikes, triggerHeartBurst, user, navigate, handleLike, discoverBasePath]);

  const onMediaDoubleClick = (e) => {
    e.preventDefault();
    onDoubleTapMedia();
  };

  const onMediaTouchEnd = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 320) {
      lastTapRef.current = 0;
      onDoubleTapMedia();
    } else {
      lastTapRef.current = now;
    }
  };

  const handleSave = async () => {
    if (!requireAuth()) return;
    clearFeedActionMsg();
    try {
      const r = await api.feedPublic.toggleSave(post.id);
      onPatch(post.id, { saved_by_me: r.saved });
    } catch (e) {
      showFeedActionError(e);
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}${discoverBasePath}#feed-post-${post.id}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: t('discover', 'brandTitle'),
          text: post.caption ? String(post.caption).slice(0, 140) : '',
          url,
        });
        return;
      }
      await navigator.clipboard.writeText(url);
    } catch {
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        /* ignore */
      }
    }
  };

  const handleToggleCommentLike = useCallback(
    (commentId) => {
      if (!requireAuth()) return;
      clearFeedActionMsg();
      const prev =
        commentLikeSnapRef.current.get(commentId) ?? { liked: false, count: 0 };
      const nextLiked = !prev.liked;
      const nextCount = Math.max(0, prev.count + (prev.liked ? -1 : 1));
      commentLikeSnapRef.current.set(commentId, { liked: nextLiked, count: nextCount });
      const mySeq = (commentLikeSeqRef.current[commentId] =
        (commentLikeSeqRef.current[commentId] || 0) + 1);

      setComments((list) =>
        list.map((c) =>
          c.id === commentId ? { ...c, likedByMe: nextLiked, likesCount: nextCount } : c
        )
      );

      const runToggle = () => api.feedPublic.toggleCommentLike(post.id, commentId);

      void (async () => {
        try {
          let r;
          try {
            r = await runToggle();
          } catch (e) {
            if (commentLikeSeqRef.current[commentId] !== mySeq) return;
            if (e?.code === API_ERROR_NETWORK) {
              await new Promise((res) => setTimeout(res, 420));
              if (commentLikeSeqRef.current[commentId] !== mySeq) return;
              r = await runToggle();
            } else {
              throw e;
            }
          }
          if (commentLikeSeqRef.current[commentId] !== mySeq) return;
          const cnt = Number(r.likes_count) || 0;
          commentLikeSnapRef.current.set(commentId, { liked: r.liked, count: cnt });
          setComments((list) =>
            list.map((c) =>
              c.id === commentId ? { ...c, likedByMe: r.liked, likesCount: cnt } : c
            )
          );
        } catch (e) {
          if (commentLikeSeqRef.current[commentId] !== mySeq) return;
          commentLikeSnapRef.current.set(commentId, prev);
          setComments((list) =>
            list.map((c) =>
              c.id === commentId
                ? { ...c, likedByMe: prev.liked, likesCount: prev.count }
                : c
            )
          );
          showFeedActionError(e);
        }
      })();
    },
    [requireAuth, post.id, clearFeedActionMsg, showFeedActionError]
  );

  const startEdit = (c) => {
    if (!requireAuth()) return;
    setEditingCommentId(c.id);
    setEditText(c.body || '');
  };

  const cancelEdit = () => {
    setEditingCommentId(null);
    setEditText('');
  };

  useEffect(() => {
    if (!editingCommentId) return undefined;
    const id = window.requestAnimationFrame(() => {
      editTextareaRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [editingCommentId]);

  const saveEdit = async (commentId) => {
    const text = editText.trim();
    if (!text) return;
    setCommentWriteBusyId(commentId);
    try {
      const r = await api.feedPublic.updateComment(post.id, commentId, text);
      const c = r.comment;
      if (c) {
        setComments((prev) =>
          prev.map((x) =>
            x.id === c.id
              ? {
                  ...x,
                  body: c.body,
                  updatedAt: c.updatedAt ?? x.updatedAt,
                }
              : x
          )
        );
      }
      cancelEdit();
    } catch {
      /* ignore */
    } finally {
      setCommentWriteBusyId(null);
    }
  };

  const deleteComment = async (commentId) => {
    if (!requireAuth()) return;
    if (!window.confirm(t('discover', 'feedCommentDeleteConfirm'))) return;
    setCommentWriteBusyId(commentId);
    try {
      const r = await api.feedPublic.deleteComment(post.id, commentId);
      setComments((prev) => removeCommentAndReplies(prev, commentId));
      if (replyToId === commentId) setReplyToId(null);
      if (editingCommentId === commentId) cancelEdit();
      if (r.comments_count != null) {
        onPatch(post.id, { comments_count: Number(r.comments_count) });
      }
    } catch {
      /* ignore */
    } finally {
      setCommentWriteBusyId(null);
    }
  };

  const handlePostComment = async (e) => {
    e.preventDefault();
    const text = commentText.trim();
    if (!text || !requireAuth()) return;
    setPosting(true);
    try {
      const payload = replyToId ? { body: text, parentId: replyToId } : { body: text };
      const r = await api.feedPublic.addComment(post.id, payload);
      const c = r.comment;
      if (c) {
        setComments((prev) => [...prev, c]);
        setCommentsFetched(true);
        onPatch(post.id, { comments_count: commentsCount + 1 });
      }
      setCommentText('');
      setReplyToId(null);
    } catch (e) {
      showFeedActionError(e);
    } finally {
      setPosting(false);
    }
  };

  const patchOwnerSocial = async (body) => {
    if (!requireAuth()) return;
    setOwnerSaving(true);
    try {
      await api.business.feed.update(post.id, body);
      onPatch?.(post.id, body);
      setFeedHeaderMoreOpen(false);
      setReelMoreOpen(false);
    } catch (e) {
      showFeedActionError(e);
    } finally {
      setOwnerSaving(false);
    }
  };

  const openOwnerEdit = () => {
    setOwnerEditCaption(String(post.caption || ''));
    const imgLines = rawFeedImageUrls(post);
    setOwnerEditImages(imgLines);
    setOwnerEditVideoUrl(post.video_url != null ? String(post.video_url) : '');
    setOwnerEditShowAdvanced(false);
    setOwnerEditUploading(null);
    setOwnerEditOpen(true);
    setFeedHeaderMoreOpen(false);
    setReelMoreOpen(false);
  };

  const uploadOwnerEditImages = async (files) => {
    if (!files?.length) return;
    if (!placeId) {
      setFeedActionMsg('This post is not linked to a place. Upload from Business dashboard.');
      return;
    }
    const list = Array.from(files).filter((f) => /^image\//i.test(f.type));
    if (!list.length) return;
    setOwnerEditUploading('image');
    try {
      for (const file of list) {
        const url = await api.business.upload(file, placeId);
        if (!url) continue;
        setOwnerEditImages((prev) => {
          if (contentKind(post.type) === 'reel') return [url];
          if (prev.includes(url)) return prev;
          return [...prev, url].slice(0, MAX_FEED_POST_IMAGES);
        });
      }
    } catch (e) {
      showFeedActionError(e);
    } finally {
      setOwnerEditUploading(null);
    }
  };

  const uploadOwnerEditVideo = async (file) => {
    if (!file) return;
    if (!placeId) {
      setFeedActionMsg('This post is not linked to a place. Upload from Business dashboard.');
      return;
    }
    if (!/^video\//i.test(file.type)) {
      setFeedActionMsg('Choose a video file (MP4, WebM, MOV).');
      return;
    }
    setOwnerEditUploading('video');
    try {
      const url = await api.business.upload(file, placeId);
      if (url) setOwnerEditVideoUrl(url);
    } catch (e) {
      showFeedActionError(e);
    } finally {
      setOwnerEditUploading(null);
    }
  };

  const saveOwnerEdit = async () => {
    const cap = ownerEditCaption.trim();
    if (!cap || !requireAuth()) return;
    setOwnerSaving(true);
    try {
      const lines = ownerEditImages
        .map((s) => String(s).trim())
        .filter(Boolean)
        .slice(0, MAX_FEED_POST_IMAGES);
      const r = await api.business.feed.update(post.id, {
        caption: cap,
        image_urls: lines.length ? lines : null,
        image_url: lines[0] || null,
        video_url: ownerEditVideoUrl.trim() || null,
      });
      const p = r?.post;
      if (p) {
        onPatch?.(post.id, {
          caption: p.caption,
          image_url: p.image_url,
          image_urls: p.image_urls,
          video_url: p.video_url,
          updated_at: p.updated_at,
          type: p.type,
        });
      }
      setOwnerEditOpen(false);
    } catch (e) {
      showFeedActionError(e);
    } finally {
      setOwnerSaving(false);
    }
  };

  const deleteOwnerPost = async () => {
    if (!requireAuth()) return;
    if (!window.confirm(t('discover', 'feedOwnerDeleteConfirm'))) return;
    setOwnerSaving(true);
    try {
      await api.business.feed.delete(post.id);
      onRemove?.(post.id);
      setFeedHeaderMoreOpen(false);
      setReelMoreOpen(false);
    } catch (e) {
      showFeedActionError(e);
    } finally {
      setOwnerSaving(false);
    }
  };

  const nested = nestComments(comments);
  const replyTargetName =
    replyToId && comments.find((c) => c.id === replyToId)?.authorName;

  const showReelTheater = variant === 'reel' && (showVideo || img || externalVideo);
  const mediaTapProps = hideLikes
    ? {}
    : { onDoubleClick: onMediaDoubleClick, onTouchEnd: onMediaTouchEnd };

  const reelHandle = (() => {
    const s = String(post.author_name || 'user')
      .replace(/\s+/g, '')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 28);
    return s || 'user';
  })();
  /** Reels bottom row: place name when linked to a place; else @handle from author. */
  const reelOverlayPrimary = placeId && placeName ? placeName : `@${reelHandle}`;
  const showVerified = post.author_role === 'business_owner';

  useEffect(() => {
    if (!showReelTheater || !showVideo) return;
    const v = reelVideoRef.current;
    if (!v) return;
    if (isActiveReel) {
      const p = v.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
      return;
    }
    v.pause();
  }, [isActiveReel, showReelTheater, showVideo, post.id]);

  const onReelProgressClick = (e) => {
    const v = reelVideoRef.current;
    if (!v || !v.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    v.currentTime = ratio * v.duration;
  };

  const renderComment = (c, { isReply }) => {
    const uid = user?.id != null ? String(user.id) : '';
    const isOwn = uid && String(c.userId) === uid;
    const likedComment = c.likedByMe === true;
    const clikes = Number(c.likesCount) || 0;
    const time = formatFeedTime(c.createdAt, lang);
    const edited = commentLooksEdited(c);
    const writeBusy = commentWriteBusyId === c.id;
    const editing = editingCommentId === c.id;

    return (
      <div
        key={c.id}
        className={`ig-feed-comment-item ${isReply ? 'ig-feed-comment-item--reply' : ''}`}
      >
        {editing ? (
          <div className="ig-feed-comment-edit">
            <div className="ig-feed-comment-edit-head">
              <span className="ig-feed-comment-edit-title">{t('discover', 'feedEditCommentTitle')}</span>
              <span className="ig-feed-comment-edit-count" aria-live="polite">
                {editText.length} / 2000
              </span>
            </div>
            <textarea
              ref={editTextareaRef}
              className="ig-feed-comment-edit-input"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  cancelEdit();
                }
              }}
              maxLength={2000}
              rows={4}
              disabled={writeBusy}
              aria-label={t('discover', 'feedEditCommentTitle')}
            />
            <div className="ig-feed-comment-edit-actions">
              <button
                type="button"
                className="ig-feed-comment-edit-btn ig-feed-comment-edit-btn--primary"
                onClick={() => saveEdit(c.id)}
                disabled={writeBusy || !editText.trim()}
              >
                {t('discover', 'feedCommentSave')}
              </button>
              <button
                type="button"
                className="ig-feed-comment-edit-btn"
                onClick={cancelEdit}
                disabled={writeBusy}
              >
                {t('discover', 'feedCommentCancel')}
              </button>
            </div>
          </div>
        ) : (
          <>
            {isReply && (
              <div className="ig-feed-comment-reply-label">
                <Icon name="reply" size={14} />
                <span>{t('discover', 'feedCommentReply')}</span>
              </div>
            )}
            <div className="ig-feed-comment-bubble">
              <p className="ig-feed-comment-line">
                <strong>{c.authorName}</strong>{' '}
                <span className="ig-feed-comment-body">{c.body}</span>
              </p>
              <div className="ig-feed-comment-meta">
                {time && <span className="ig-feed-comment-time">{time}</span>}
                {edited && (
                  <span className="ig-feed-comment-edited"> · {t('discover', 'feedEdited')}</span>
                )}
              </div>
              <div className="ig-feed-comment-actions">
              <button
                type="button"
                className={`ig-feed-comment-action ig-feed-comment-action--like ${
                  likedComment ? 'ig-feed-comment-action--liked' : ''
                }`}
                onClick={() => handleToggleCommentLike(c.id)}
                aria-pressed={likedComment}
                title={
                  likedComment ? t('discover', 'feedCommentUnlike') : t('discover', 'feedCommentLike')
                }
                aria-label={
                  likedComment ? t('discover', 'feedCommentUnlike') : t('discover', 'feedCommentLike')
                }
              >
                <span className="ig-feed-comment-like-icons">
                  <Icon name={likedComment ? 'favorite' : 'favorite_border'} size={16} />
                </span>
                {clikes > 0 && <span className="ig-feed-comment-like-count">{clikes}</span>}
              </button>
              {!isReply && (
                <button
                  type="button"
                  className="ig-feed-comment-action"
                  onClick={() => {
                    if (!requireAuth()) return;
                    setReplyToId(c.id);
                    commentInputRef.current?.focus();
                  }}
                  disabled={writeBusy}
                >
                  {t('discover', 'feedCommentReply')}
                </button>
              )}
              {isOwn && (
                <>
                  <button
                    type="button"
                    className="ig-feed-comment-action"
                    onClick={() => startEdit(c)}
                    disabled={writeBusy}
                  >
                    {t('discover', 'feedCommentEdit')}
                  </button>
                  <button
                    type="button"
                    className="ig-feed-comment-action ig-feed-comment-action--danger"
                    onClick={() => deleteComment(c.id)}
                    disabled={writeBusy}
                  >
                    {t('discover', 'feedCommentDelete')}
                  </button>
                </>
              )}
            </div>
            </div>
          </>
        )}
        {c.replies?.map((r) => (
          <Fragment key={r.id}>{renderComment(r, { isReply: true })}</Fragment>
        ))}
      </div>
    );
  };

  const renderCommentsPanel = () => {
    if (commentsDisabled) return null;
    return (
    <div
      className={`ig-feed-comments-panel${commentsOpen ? ' ig-feed-comments-panel--expanded' : ''}${
        showReelTheater ? ' ig-feed-comments-panel--reel' : ''
      }`}
    >
      {commentsOpen && (
        <>
          <div className="ig-feed-comments-panel-head">
            <h3 className="ig-feed-comments-panel-title">{t('discover', 'feedCommentsHeading')}</h3>
            <div className="ig-feed-comments-panel-head-tools">
              {commentsCount > 0 && (
                <span className="ig-feed-comments-panel-badge">{commentsCount}</span>
              )}
              <button
                type="button"
                className="ig-feed-comments-panel-close"
                onClick={() => setCommentsOpen(false)}
                aria-label={t('discover', 'feedCloseComments')}
              >
                <Icon name="close" size={20} />
              </button>
            </div>
          </div>
          <div className="ig-feed-comments ig-feed-comments--boxed">
            {loadingComments && comments.length === 0 && (
              <p className="ig-feed-comments-loading">{t('discover', 'loading')}</p>
            )}
            {!loadingComments && nested.length === 0 && (
              <p className="ig-feed-comments-empty">{t('discover', 'feedNoCommentsYet')}</p>
            )}
            {nested.map((c) => (
              <Fragment key={c.id}>{renderComment(c, { isReply: false })}</Fragment>
            ))}
          </div>
        </>
      )}

      <form className="ig-feed-comment-form" onSubmit={handlePostComment}>
        {!user && <p className="ig-feed-signin-hint">{t('discover', 'feedSignIn')}</p>}
        {replyToId && (
          <div className="ig-feed-reply-banner">
            <span className="ig-feed-reply-banner-text">
              {t('discover', 'feedReplyingTo')} <strong>{replyTargetName || '…'}</strong>
            </span>
            <button
              type="button"
              className="ig-feed-reply-banner-cancel"
              onClick={() => setReplyToId(null)}
              aria-label={t('discover', 'feedCommentCancel')}
            >
              <Icon name="close" size={18} />
            </button>
          </div>
        )}
        <div className="ig-feed-comment-row">
          <input
            ref={commentInputRef}
            type="text"
            className="ig-feed-comment-input"
            placeholder={
              replyToId
                ? `${t('discover', 'feedCommentPlaceholder')} (${t('discover', 'feedCommentReply')})`
                : t('discover', 'feedCommentPlaceholder')
            }
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            maxLength={2000}
            disabled={posting}
            aria-label={t('discover', 'feedCommentPlaceholder')}
          />
          <button type="submit" className="ig-feed-comment-submit" disabled={posting || !commentText.trim()}>
            {t('discover', 'feedPost')}
          </button>
        </div>
      </form>
    </div>
    );
  };

  const renderOwnerActions = (itemClass) => {
    if (!iManagePost) return null;
    const closeMenus = () => {
      setFeedHeaderMoreOpen(false);
      setReelMoreOpen(false);
    };
    return (
      <>
        <button
          type="button"
          role="menuitem"
          className={itemClass}
          disabled={ownerSaving}
          onClick={() => {
            closeMenus();
            openOwnerEdit();
          }}
        >
          {t('discover', 'feedOwnerEdit')}
        </button>
        <button
          type="button"
          role="menuitem"
          className={itemClass}
          disabled={ownerSaving}
          onClick={() => {
            closeMenus();
            void patchOwnerSocial({ hide_likes: !hideLikes });
          }}
        >
          {hideLikes ? t('discover', 'feedOwnerShowLikes') : t('discover', 'feedOwnerHideLikes')}
        </button>
        <button
          type="button"
          role="menuitem"
          className={itemClass}
          disabled={ownerSaving}
          onClick={() => {
            closeMenus();
            void patchOwnerSocial({ comments_disabled: !commentsDisabled });
          }}
        >
          {commentsDisabled
            ? t('discover', 'feedOwnerEnableComments')
            : t('discover', 'feedOwnerDisableComments')}
        </button>
        <button
          type="button"
          role="menuitem"
          className={`${itemClass} ig-feed-more-item--danger`}
          disabled={ownerSaving}
          onClick={() => {
            closeMenus();
            void deleteOwnerPost();
          }}
        >
          {t('discover', 'feedOwnerDelete')}
        </button>
      </>
    );
  };

  return (
    <article
      className={`ig-feed-post${showReelTheater ? ' ig-feed-post--reel' : ''}`}
      id={`feed-post-${post.id}`}
    >
      {showReelTheater ? (
        <div className={`ig-reel-theater${commentsOpen ? ' ig-reel-theater--comments-open' : ''}`}>
          <div className="ig-reel-media-layer" role="presentation" {...mediaTapProps}>
            {showVideo ? (
              <video
                key={`${post.id}-${isActiveReel ? 'active' : 'idle'}`}
                ref={reelVideoRef}
                className="ig-reel-video"
                src={vid}
                poster={img || undefined}
                playsInline
                muted={reelMuted}
                loop
                autoPlay={isActiveReel}
                controls={isDesktop}
                preload={isDesktop ? 'auto' : 'metadata'}
                onTimeUpdate={(e) => {
                  const el = e.currentTarget;
                  if (el.duration) setReelProgress(el.currentTime / el.duration);
                }}
                onLoadedData={() => {
                  const v = reelVideoRef.current;
                  if (!v || !isActiveReel) return;
                  const p = v.play();
                  if (p && typeof p.catch === 'function') p.catch(() => {});
                }}
                onCanPlay={() => {
                  const v = reelVideoRef.current;
                  if (!v || !isActiveReel) return;
                  const p = v.play();
                  if (p && typeof p.catch === 'function') p.catch(() => {});
                }}
              />
            ) : img ? (
              <img src={img} alt="" className="ig-reel-img" loading="lazy" decoding="async" />
            ) : (
              <a
                href={String(post.video_url).trim()}
                target="_blank"
                rel="noopener noreferrer"
                className="ig-reel-ext"
              >
                {t('home', 'communityWatchVideo')}
              </a>
            )}
            {heartBurst && (
              <span className="ig-feed-heart-burst ig-feed-heart-burst--reel" aria-hidden="true">
                <Icon name="favorite" size={88} />
              </span>
            )}
          </div>

          <div className={`ig-reel-top${showVideo ? '' : ' ig-reel-top--solo-more'}`}>
            {showVideo && (
              <button
                type="button"
                className="ig-reel-top-btn"
                onClick={() => setReelMuted((m) => !m)}
                aria-pressed={!reelMuted}
                aria-label={reelMuted ? t('discover', 'feedUnmuteVideo') : t('discover', 'feedMuteVideo')}
                title={reelMuted ? t('discover', 'feedUnmuteVideo') : t('discover', 'feedMuteVideo')}
              >
                <Icon name={reelMuted ? 'volume_off' : 'volume_up'} size={22} />
              </button>
            )}
            <div className="ig-reel-more-wrap" ref={reelMoreRef}>
              <button
                type="button"
                className="ig-reel-top-btn"
                aria-expanded={reelMoreOpen}
                aria-haspopup="true"
                aria-label={t('discover', 'feedReelMore')}
                onClick={() => setReelMoreOpen((o) => !o)}
              >
                <Icon name="more_horiz" size={22} />
              </button>
              {reelMoreOpen && (
                <div className="ig-reel-more-menu" role="menu">
                  {renderOwnerActions('ig-reel-more-item')}
                  {iManagePost ? <div className="ig-reel-more-divider" aria-hidden="true" /> : null}
                  <button
                    type="button"
                    role="menuitem"
                    className="ig-reel-more-item"
                    onClick={() => {
                      setReelMoreOpen(false);
                      void handleShare();
                    }}
                  >
                    {t('discover', 'feedShare')}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="ig-reel-more-item"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(
                          `${window.location.origin}${discoverBasePath}#feed-post-${post.id}`
                        );
                      } catch {
                        /* ignore */
                      }
                      setReelMoreOpen(false);
                    }}
                  >
                    {t('discover', 'feedCopyLink')}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="ig-reel-rail" aria-label={t('discover', 'feedReelActions')}>
            {placeId ? (
              <div className="ig-reel-rail-avatar-link" role="presentation">
                <span className="ig-reel-rail-avatar">
                  {placeAvatarUrl ? (
                    <img src={placeAvatarUrl} alt="" width={48} height={48} />
                  ) : (
                    <Icon name="person" size={28} />
                  )}
                  <span className="ig-reel-follow-badge" aria-hidden="true">
                    <Icon name="add" size={14} />
                  </span>
                </span>
              </div>
            ) : (
              <div className="ig-reel-rail-avatar-link ig-reel-rail-avatar-link--static" aria-hidden="true">
                <span className="ig-reel-rail-avatar">
                  <Icon name="person" size={28} />
                  <span className="ig-reel-follow-badge">
                    <Icon name="add" size={14} />
                  </span>
                </span>
              </div>
            )}

            {!hideLikes ? (
              <div className="ig-reel-rail-item">
                <button
                  type="button"
                  className={`ig-reel-rail-btn ${liked ? 'ig-reel-rail-btn--liked' : ''}`}
                  onClick={onPostLikeClick}
                  aria-pressed={liked}
                  aria-label={liked ? t('discover', 'feedUnlike') : t('discover', 'feedLike')}
                >
                  <span
                    key={likePopKey}
                    className={`ig-feed-like-icon-wrap ig-feed-like-icon-wrap--${likeAnimDir}`}
                  >
                    <Icon name={liked ? 'favorite' : 'favorite_border'} size={26} />
                  </span>
                </button>
                <span className="ig-reel-rail-stat" aria-hidden="true">
                  {formatCompactCount(Math.max(likesCount, liked ? 1 : 0))}
                </span>
              </div>
            ) : null}

            {!commentsDisabled ? (
              <div className="ig-reel-rail-item">
                <button
                  type="button"
                  className={`ig-reel-rail-btn${commentsOpen ? ' ig-reel-rail-btn--open' : ''}`}
                  onClick={toggleComments}
                  aria-expanded={commentsOpen}
                  aria-label={t('discover', 'feedComment')}
                >
                  <Icon name="chat_bubble_outline" size={26} />
                </button>
                <span className="ig-reel-rail-stat" aria-hidden="true">
                  {formatCompactCount(commentsCount)}
                </span>
              </div>
            ) : null}

            <div className="ig-reel-rail-item">
              <button
                type="button"
                className={`ig-reel-rail-btn ${saved ? 'ig-reel-rail-btn--saved' : ''}`}
                onClick={handleSave}
                aria-pressed={saved}
                aria-label={t('discover', 'feedSave')}
              >
                <Icon name={saved ? 'bookmark' : 'bookmark_border'} size={26} />
              </button>
              <span className="ig-reel-rail-stat ig-reel-rail-stat--placeholder" aria-hidden="true" />
            </div>

            <div className="ig-reel-rail-item">
              <button type="button" className="ig-reel-rail-btn" onClick={handleShare} aria-label={t('discover', 'feedShare')}>
                <Icon name="share" size={24} />
              </button>
              <span className="ig-reel-rail-stat ig-reel-rail-stat--placeholder" aria-hidden="true" />
            </div>
          </div>

          <div className={`ig-reel-bottom${commentsOpen ? ' ig-reel-bottom--hidden' : ''}`}>
            <div className="ig-reel-user-row">
              {placeId && venueFeedPath ? (
                <Link to={venueFeedPath} className="ig-reel-place-meta ig-reel-handle--link">
                  <span className="ig-reel-place-avatar" aria-hidden="true">
                    {placeAvatarUrl ? (
                      <img src={placeAvatarUrl} alt="" width={24} height={24} />
                    ) : (
                      <Icon name="storefront" size={14} />
                    )}
                  </span>
                  <span className="ig-reel-handle">{reelOverlayPrimary}</span>
                </Link>
              ) : (
                <span className="ig-reel-place-meta">
                  <span className="ig-reel-place-avatar" aria-hidden="true">
                    <Icon name="person" size={14} />
                  </span>
                  <span className="ig-reel-handle">{reelOverlayPrimary}</span>
                </span>
              )}
              {showVerified && (
                <span className="ig-reel-verified" title={t('discover', 'feedVerifiedBusiness')} aria-label={t('discover', 'feedVerifiedBusiness')}>
                  <Icon name="verified" size={18} ariaHidden={false} />
                </span>
              )}
            </div>
            {post.caption && <p className="ig-reel-caption ig-reel-caption--clean">{String(post.caption)}</p>}
            {commentsDisabled && (
              <p className="ig-reel-comments-off-hint" role="note">
                {t('discover', 'feedCommentsDisabledNote')}
              </p>
            )}
          </div>

          {commentsOpen && (
            <button
              type="button"
              className="ig-reel-comments-backdrop"
              aria-label={t('discover', 'feedCloseComments')}
              onClick={() => setCommentsOpen(false)}
            />
          )}
          {!commentsDisabled && commentsOpen ? renderCommentsPanel() : null}

          {showVideo && (
            <div
              className="ig-reel-progress-track"
              role="slider"
              tabIndex={0}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(reelProgress * 100)}
              aria-label={t('discover', 'feedReelProgress')}
              onClick={onReelProgressClick}
              onKeyDown={(e) => {
                if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
                e.preventDefault();
                const v = reelVideoRef.current;
                if (!v || !v.duration) return;
                const delta = e.key === 'ArrowLeft' ? -5 : 5;
                v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + delta));
              }}
            >
              <div className="ig-reel-progress-fill" style={{ width: `${reelProgress * 100}%` }} />
            </div>
          )}
        </div>
      ) : (
        <>
          <header className={`ig-feed-post-header${iManagePost ? ' ig-feed-post-header--with-tools' : ''}`}>
            <div className="ig-feed-avatar" aria-hidden="true">
              {placeAvatarUrl ? (
                <img src={placeAvatarUrl} alt="" className="ig-feed-avatar-img" width={36} height={36} />
              ) : (
                <Icon name="person" size={22} />
              )}
            </div>
            <div className="ig-feed-post-meta">
              <div className="ig-feed-post-meta-row">
                {placeId && venueFeedPath && placeName ? (
                  <Link
                    to={venueFeedPath}
                    className="ig-feed-author ig-feed-place-name ig-feed-place-name--row"
                    title={t('discover', 'feedVenueHubTitle')}
                  >
                    {placeName}
                  </Link>
                ) : (
                  <span className="ig-feed-author">{displayName}</span>
                )}
                {timeLabel && <time className="ig-feed-time" dateTime={post.created_at || undefined}>{timeLabel}</time>}
              </div>
            </div>
            {iManagePost ? (
              <div className="ig-feed-header-tools">
                <div className="ig-feed-header-more-wrap" ref={feedHeaderMoreRef}>
                  <button
                    type="button"
                    className={`ig-feed-header-more-btn${feedHeaderMoreOpen ? ' ig-feed-header-more-btn--open' : ''}`}
                    aria-expanded={feedHeaderMoreOpen}
                    aria-haspopup="true"
                    aria-label={t('discover', 'feedOwnerMenu')}
                    onClick={() => setFeedHeaderMoreOpen((o) => !o)}
                  >
                    <Icon name="more_horiz" size={22} />
                  </button>
                  {feedHeaderMoreOpen && (
                    <div className="ig-feed-more-menu" role="menu">
                      {renderOwnerActions('ig-feed-more-item')}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </header>

          <div className="ig-feed-media-wrap" role="presentation" {...mediaTapProps}>
            <div className="ig-feed-media">
              {showVideo ? (
                <video className="ig-feed-video" src={vid} controls playsInline preload="metadata" poster={img || undefined} />
              ) : gallerySrcs.length > 1 ? (
                <div className="ig-feed-gallery">
                  <div
                    ref={galleryRef}
                    className="ig-feed-gallery-track"
                    onScroll={(e) => {
                      const el = e.currentTarget;
                      const w = el.clientWidth || 1;
                      const i = Math.round(el.scrollLeft / w);
                      setGalleryIndex(Math.min(gallerySrcs.length - 1, Math.max(0, i)));
                    }}
                  >
                    {gallerySrcs.map((src, i) => (
                      <div key={i} className="ig-feed-gallery-slide">
                        <img
                          src={src}
                          alt=""
                          className="ig-feed-img"
                          loading={i === 0 ? 'eager' : 'lazy'}
                          decoding="async"
                          onClick={() => {
                            setImageZoomSrc(src);
                            setImageZoomOpen(true);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="ig-feed-gallery-dots" aria-hidden="true">
                    {gallerySrcs.map((_, i) => (
                      <span
                        key={i}
                        className={`ig-feed-gallery-dot${i === galleryIndex ? ' ig-feed-gallery-dot--active' : ''}`}
                      />
                    ))}
                  </div>
                </div>
              ) : gallerySrcs.length === 1 ? (
                <img
                  src={gallerySrcs[0]}
                  alt=""
                  className="ig-feed-img"
                  loading="lazy"
                  decoding="async"
                  onClick={() => {
                    setImageZoomSrc(gallerySrcs[0]);
                    setImageZoomOpen(true);
                  }}
                />
              ) : externalVideo ? (
                <a href={String(post.video_url).trim()} target="_blank" rel="noopener noreferrer" className="ig-feed-ext">
                  {t('home', 'communityWatchVideo')}
                </a>
              ) : (
                <div className="ig-feed-media-empty" />
              )}
            </div>
            {heartBurst && (
              <span className="ig-feed-heart-burst" aria-hidden="true">
                <Icon name="favorite" size={88} />
              </span>
            )}
          </div>
        </>
      )}

      {!showReelTheater && (
        <div className="ig-feed-actions">
          {!hideLikes ? (
            <button
              type="button"
              className={`ig-feed-action ig-feed-action--like ${liked ? 'ig-feed-action--liked' : ''}`}
              onClick={onPostLikeClick}
              aria-pressed={liked}
              title={liked ? t('discover', 'feedUnlikeHint') : t('discover', 'feedLikeHint')}
              aria-label={liked ? t('discover', 'feedUnlike') : t('discover', 'feedLike')}
            >
              <span className="ig-feed-action-ring" aria-hidden="true" />
              <span
                key={likePopKey}
                className={`ig-feed-like-icon-wrap ig-feed-like-icon-wrap--${likeAnimDir}`}
              >
                <Icon name={liked ? 'favorite' : 'favorite_border'} size={28} />
              </span>
            </button>
          ) : null}
          {!commentsDisabled ? (
            <button
              type="button"
              className={`ig-feed-action ig-feed-action--comment${commentsOpen ? ' ig-feed-action--comment-open' : ''}`}
              onClick={toggleComments}
              aria-label={t('discover', 'feedComment')}
              aria-expanded={commentsOpen}
            >
              <span className="ig-feed-action-ring" aria-hidden="true" />
              <Icon name="chat_bubble_outline" size={26} />
              {commentsCount > 0 && (
                <span className="ig-feed-action-count" aria-hidden="true">
                  {commentsCount > 99 ? '99+' : commentsCount}
                </span>
              )}
            </button>
          ) : null}
          <button type="button" className="ig-feed-action ig-feed-action--share" onClick={handleShare} aria-label={t('discover', 'feedShare')}>
            <span className="ig-feed-action-ring" aria-hidden="true" />
            <Icon name="send" size={24} />
          </button>
          <button
            type="button"
            className={`ig-feed-action ig-feed-action--push ig-feed-action--save ${saved ? 'ig-feed-action--saved' : ''}`}
            onClick={handleSave}
            aria-pressed={saved}
            aria-label={t('discover', 'feedSave')}
          >
            <span className="ig-feed-action-ring" aria-hidden="true" />
            <Icon name={saved ? 'bookmark' : 'bookmark_border'} size={28} />
          </button>
        </div>
      )}

      {feedActionMsg && (
        <p className="ig-feed-action-msg" role="alert">
          {feedActionMsg}
        </p>
      )}

      {!showReelTheater && !hideLikes && (likesCount > 0 || liked) && (
        <p className="ig-feed-likes" role="status" aria-live="polite">
          <span className="ig-feed-likes-num">
            {Math.max(likesCount, liked ? 1 : 0).toLocaleString()}
          </span>{' '}
          {Math.max(likesCount, liked ? 1 : 0) === 1
            ? t('discover', 'feedLikeCount')
            : t('discover', 'feedLikesCount')}
        </p>
      )}

      {!showReelTheater && post.caption && (
        <p className="ig-feed-caption">
          <strong>{displayName}</strong> {String(post.caption)}
        </p>
      )}

      {!showReelTheater && commentsDisabled && (
        <p className="ig-feed-comments-disabled-hint" role="note">
          {t('discover', 'feedCommentsDisabledNote')}
        </p>
      )}

      {commentsCount > 0 && !commentsOpen && !showReelTheater && !commentsDisabled && (
        <button type="button" className="ig-feed-view-comments" onClick={openComments}>
          {t('discover', 'feedViewAllComments')} ({commentsCount})
        </button>
      )}

      {!showReelTheater && !commentsDisabled ? renderCommentsPanel() : null}

      {imageZoomOpen && imageZoomSrc ? (
        <div
          className="ig-feed-image-zoom-backdrop"
          role="presentation"
          onClick={() => setImageZoomOpen(false)}
        >
          <div className="ig-feed-image-zoom-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="ig-feed-image-zoom-close"
              aria-label="Close image"
              onClick={() => setImageZoomOpen(false)}
            >
              <Icon name="close" size={20} />
            </button>
            <img src={imageZoomSrc} alt="" className="ig-feed-image-zoom-img" />
          </div>
        </div>
      ) : null}

      {ownerEditOpen && (
        <div
          className="ig-feed-owner-edit-backdrop"
          role="presentation"
          onClick={() => {
            if (!ownerSaving) setOwnerEditOpen(false);
          }}
        >
          <div
            className="ig-feed-owner-edit-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="feed-owner-edit-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ig-feed-owner-edit-head">
              <h2 id="feed-owner-edit-title" className="ig-feed-owner-edit-title">
                {t('discover', 'feedOwnerEditTitle')}
              </h2>
              <button
                type="button"
                className="ig-feed-owner-edit-close"
                aria-label={t('discover', 'feedOwnerCancel')}
                disabled={ownerSaving}
                onClick={() => setOwnerEditOpen(false)}
              >
                <Icon name="close" size={22} />
              </button>
            </div>
            <label className="ig-feed-owner-edit-label">
              {t('discover', 'feedOwnerCaption')}
              <textarea
                className="ig-feed-owner-edit-textarea"
                value={ownerEditCaption}
                onChange={(e) => setOwnerEditCaption(e.target.value)}
                rows={4}
                maxLength={8000}
                disabled={ownerSaving}
              />
            </label>
            <div className="ig-feed-owner-edit-label">
              <span>{t('discover', 'feedOwnerImageUrl')}</span>
              <div
                className="ig-feed-owner-edit-upload-zone"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.add('ig-feed-owner-edit-upload-zone--drag');
                }}
                onDragLeave={(e) => e.currentTarget.classList.remove('ig-feed-owner-edit-upload-zone--drag')}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove('ig-feed-owner-edit-upload-zone--drag');
                  void uploadOwnerEditImages(e.dataTransfer?.files);
                }}
              >
                <input
                  id={`owner-edit-images-${post.id}`}
                  type="file"
                  accept="image/*"
                  multiple={contentKind(post.type) !== 'reel'}
                  style={{ display: 'none' }}
                  disabled={ownerSaving || ownerEditUploading !== null}
                  onChange={(e) => {
                    void uploadOwnerEditImages(e.target.files);
                    e.target.value = '';
                  }}
                />
                <label htmlFor={`owner-edit-images-${post.id}`}>
                  {ownerEditUploading === 'image' ? 'Uploading images…' : 'Drop images here or click to upload'}
                </label>
              </div>
              {ownerEditImages.length > 0 && (
                <div className="ig-feed-owner-edit-image-grid">
                  {ownerEditImages.map((url, idx) => (
                    <div key={`${url}-${idx}`} className="ig-feed-owner-edit-image-tile">
                      {mediaUrl(url) ? <img src={mediaUrl(url)} alt="" /> : null}
                      <div className="ig-feed-owner-edit-image-actions">
                        {idx > 0 ? (
                          <button
                            type="button"
                            onClick={() =>
                              setOwnerEditImages((prev) => {
                                const next = [...prev];
                                [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                                return next;
                              })
                            }
                          >
                            Up
                          </button>
                        ) : null}
                        <button type="button" onClick={() => setOwnerEditImages((prev) => prev.filter((_, i) => i !== idx))}>
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="ig-feed-owner-edit-label">
              <span>{t('discover', 'feedOwnerVideoUrl')}</span>
              <div
                className="ig-feed-owner-edit-upload-zone"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.add('ig-feed-owner-edit-upload-zone--drag');
                }}
                onDragLeave={(e) => e.currentTarget.classList.remove('ig-feed-owner-edit-upload-zone--drag')}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove('ig-feed-owner-edit-upload-zone--drag');
                  void uploadOwnerEditVideo(e.dataTransfer?.files?.[0]);
                }}
              >
                <input
                  id={`owner-edit-video-${post.id}`}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,video/x-m4v,.mp4,.webm,.mov,.m4v"
                  style={{ display: 'none' }}
                  disabled={ownerSaving || ownerEditUploading !== null}
                  onChange={(e) => {
                    void uploadOwnerEditVideo(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
                <label htmlFor={`owner-edit-video-${post.id}`}>
                  {ownerEditUploading === 'video' ? 'Uploading video…' : 'Drop video here or click to upload'}
                </label>
              </div>
              <button
                type="button"
                className="ig-feed-owner-edit-btn"
                style={{ marginTop: 8, width: 'fit-content' }}
                onClick={() => setOwnerEditShowAdvanced((x) => !x)}
                disabled={ownerSaving}
              >
                {ownerEditShowAdvanced ? 'Hide' : 'Show'} advanced URL fields
              </button>
              {ownerEditShowAdvanced && (
                <div className="ig-feed-owner-edit-advanced">
                  <textarea
                    className="ig-feed-owner-edit-textarea"
                    value={ownerEditImages.join('\n')}
                    onChange={(e) =>
                      setOwnerEditImages(
                        e.target.value
                          .split(/[\n\r]+/)
                          .map((s) => s.trim())
                          .filter(Boolean)
                          .slice(0, contentKind(post.type) === 'reel' ? 1 : MAX_FEED_POST_IMAGES)
                      )
                    }
                    disabled={ownerSaving}
                    rows={3}
                    placeholder="Image URLs, one per line"
                  />
                  <input
                    type="url"
                    className="ig-feed-owner-edit-input"
                    value={ownerEditVideoUrl}
                    onChange={(e) => setOwnerEditVideoUrl(e.target.value)}
                    disabled={ownerSaving}
                    autoComplete="off"
                    placeholder="Video URL"
                  />
                </div>
              )}
            </div>
            <div className="ig-feed-owner-edit-actions">
              <button
                type="button"
                className="ig-feed-owner-edit-btn ig-feed-owner-edit-btn--primary"
                disabled={ownerSaving || ownerEditUploading !== null || !ownerEditCaption.trim()}
                onClick={() => void saveOwnerEdit()}
              >
                {ownerSaving ? t('discover', 'feedOwnerSaving') : t('discover', 'feedOwnerSave')}
              </button>
              <button
                type="button"
                className="ig-feed-owner-edit-btn"
                disabled={ownerSaving}
                onClick={() => setOwnerEditOpen(false)}
              >
                {t('discover', 'feedOwnerCancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
