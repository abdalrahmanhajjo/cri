import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import api, { getPlaceImageUrl } from '../api/client';
import DeliveryImg from '../components/DeliveryImg';
import Icon from '../components/Icon';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import {
  getDayCount,
  toDateOnly,
  dayFromApiShape,
  placeIdsFromDay,
  getDateForDayIndex,
} from '../utils/tripPlannerHelpers';
import './TripDetail.css';

function formatClockHm(t) {
  if (t == null || String(t).trim() === '') return null;
  const s = String(t).trim().slice(0, 8);
  return s.length >= 5 ? s.slice(0, 5) : s;
}

function slotTimeLabel(slot) {
  const a = formatClockHm(slot.startTime);
  const b = formatClockHm(slot.endTime);
  if (a && b) return `${a}–${b}`;
  if (a) return a;
  if (b) return b;
  return null;
}

export default function TripDetail() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [trip, setTrip] = useState(null);
  const [placesById, setPlacesById] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [shareRequestOpen, setShareRequestOpen] = useState(false);
  const [recipientUsername, setRecipientUsername] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [recipientOptions, setRecipientOptions] = useState([]);
  const [searchingRecipients, setSearchingRecipients] = useState(false);
  const [shareMessage, setShareMessage] = useState('');
  const [sendingShareRequest, setSendingShareRequest] = useState(false);
  const [shareRequestError, setShareRequestError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.user
      .getTrip(tripId)
      .then((data) => {
        if (cancelled) return;
        setTrip(data);
        const ids = Array.isArray(data?.days)
          ? [...new Set(data.days.flatMap((d) => placeIdsFromDay(d)))]
          : [];
        if (ids.length === 0) {
          setPlacesById({});
          return;
        }
        return Promise.all(ids.map((id) => api.places.get(id).catch(() => null))).then((rows) => {
          if (cancelled) return;
          const map = {};
          rows.filter(Boolean).forEach((p) => {
            map[String(p.id)] = p;
          });
          setPlacesById(map);
        });
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || t('home', 'tripDetailLoadFailed'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tripId, t]);

  const dayBlocks = useMemo(() => {
    if (!trip) return [];
    const start = toDateOnly(trip.startDate);
    const end = toDateOnly(trip.endDate);
    const n = getDayCount(start || trip.startDate, end || trip.endDate);
    return Array.from({ length: n }, (_, i) => {
      const dayRow = Array.isArray(trip.days) ? trip.days[i] : null;
      const slots = dayRow ? dayFromApiShape(dayRow).slots : [];
      const dateStr = getDateForDayIndex(trip.startDate, i);
      let dateLabel = '';
      if (dateStr) {
        try {
          dateLabel = new Date(`${dateStr}T12:00:00`).toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
        } catch {
          dateLabel = dateStr;
        }
      }
      return { index: i, dateLabel, slots };
    });
  }, [trip]);

  const totalStops = useMemo(
    () => dayBlocks.reduce((acc, d) => acc + d.slots.length, 0),
    [dayBlocks]
  );

  const openMap = useCallback(() => {
    if (!trip) return;
    showToast(t('feedback', 'tripMapOpened'), 'info');
    const placeIds = dayBlocks.flatMap((d) => d.slots.map((s) => s.placeId));
    const days = Array.isArray(trip.days) ? trip.days : [{ placeIds }];
    navigate('/map', {
      state: {
        tripPlaceIds: placeIds,
        tripDays: days,
        tripName: trip.name || t('home', 'planTitle'),
        tripStartDate: trip.startDate || '',
      },
    });
  }, [trip, dayBlocks, navigate, t, showToast]);

  const handleShare = useCallback(() => {
    if (!trip) return;
    const name = trip.name || t('home', 'planTitle');
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator
        .share({ title: name, text: name, url })
        .then(() => showToast(t('feedback', 'tripShareOpened'), 'success'))
        .catch(() => {});
    } else {
      navigator.clipboard
        ?.writeText(url)
        .then(() => showToast(t('feedback', 'tripLinkCopied'), 'success'))
        .catch(() => showToast(t('feedback', 'actionFailed'), 'error'));
    }
  }, [trip, t, showToast]);

  const handleDeleteTrip = useCallback(() => {
    if (!trip || deleting) return;
    if (!window.confirm(t('home', 'deleteTrip') + '?')) return;
    setDeleting(true);
    setDeleteError(null);
    api.user
      .deleteTrip(trip.id)
      .then(() => {
        showToast(t('feedback', 'tripDeleted'), 'success');
        navigate('/plan');
      })
      .catch((e) => {
        setDeleteError(e?.message || t('home', 'tripDeleteFailed'));
        setDeleting(false);
        showToast(t('feedback', 'actionFailed'), 'error');
      });
  }, [trip, deleting, t, navigate, showToast]);

  const handleSendShareRequest = useCallback(
    (e) => {
      e.preventDefault();
      if (!trip || sendingShareRequest) return;
      if (!selectedRecipient?.id) {
        setShareRequestError('Select a recipient from the list.');
        return;
      }
      setSendingShareRequest(true);
      setShareRequestError(null);
      api.user
        .sendTripShareRequest({
          tripId: trip.id,
          recipientUserId: selectedRecipient.id,
          recipientUsername: selectedRecipient.username || recipientUsername.trim(),
          message: shareMessage.trim(),
        })
        .then(() => {
          showToast('Trip share request sent.', 'success');
          setShareRequestOpen(false);
          setRecipientUsername('');
          setSelectedRecipient(null);
          setRecipientOptions([]);
          setShareMessage('');
        })
        .catch((err) => {
          setShareRequestError(err?.message || 'Failed to send share request');
          showToast(t('feedback', 'actionFailed'), 'error');
        })
        .finally(() => setSendingShareRequest(false));
    },
    [trip, sendingShareRequest, selectedRecipient, recipientUsername, shareMessage, showToast, t]
  );

  useEffect(() => {
    if (!shareRequestOpen) return undefined;
    const q = recipientUsername.trim();
    if (selectedRecipient && q === (selectedRecipient.username || selectedRecipient.name || '').trim()) return undefined;
    setSelectedRecipient(null);
    if (q.length < 2) {
      setRecipientOptions([]);
      setSearchingRecipients(false);
      return undefined;
    }
    let cancelled = false;
    setSearchingRecipients(true);
    const timer = setTimeout(() => {
      api.user
        .searchTripShareUsers(q)
        .then((data) => {
          if (cancelled) return;
          setRecipientOptions(Array.isArray(data?.users) ? data.users : []);
        })
        .catch(() => {
          if (!cancelled) setRecipientOptions([]);
        })
        .finally(() => {
          if (!cancelled) setSearchingRecipients(false);
        });
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [recipientUsername, shareRequestOpen, selectedRecipient]);

  if (loading) {
    return (
      <div className="trip-detail trip-detail--loading">
        <div className="trip-detail-loading-inner">
          <div className="trip-detail-spinner" aria-hidden="true" />
          <p>{t('home', 'loading')}</p>
        </div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="trip-detail trip-detail--error">
        <div className="trip-detail-container">
          <Link to="/plan" className="trip-detail-back">
            <Icon name="arrow_back" size={20} /> {t('home', 'tripDetailBackPlanner')}
          </Link>
          <p className="trip-detail-error-msg">{error || t('home', 'tripDetailNotFound')}</p>
        </div>
      </div>
    );
  }

  const rangeLabel = (() => {
    const a = trip.startDate ? new Date(`${toDateOnly(trip.startDate)}T12:00:00`).toLocaleDateString() : '';
    const b = trip.endDate ? new Date(`${toDateOnly(trip.endDate)}T12:00:00`).toLocaleDateString() : '';
    if (a && b) return `${a} – ${b}`;
    return a || b || '';
  })();

  return (
    <div className="trip-detail">
      <div className="trip-detail-container">
        <nav className="trip-detail-breadcrumb" aria-label="Breadcrumb">
          <ol>
            <li><Link to="/">{t('nav', 'home')}</Link></li>
            <li><Link to="/plan">{t('home', 'tripDetailBackPlanner')}</Link></li>
            <li aria-current="page">{trip.name || t('home', 'planTitle')}</li>
          </ol>
        </nav>

        <Link to="/plan" className="trip-detail-back">
          <Icon name="arrow_back" size={20} /> {t('home', 'tripDetailBackPlanner')}
        </Link>

        <header className="trip-detail-hero">
          <h1 className="trip-detail-title">{trip.name || t('home', 'planTitle')}</h1>
          {rangeLabel && (
            <p className="trip-detail-dates">
              <Icon name="calendar_month" size={20} aria-hidden />
              {rangeLabel}
            </p>
          )}
          <p className="trip-detail-summary">
            {dayBlocks.length} {dayBlocks.length === 1 ? t('home', 'tripDetailDayWord') : t('home', 'tripDetailDaysWord')}
            {totalStops > 0 && ` · ${totalStops} ${totalStops === 1 ? t('home', 'tripDetailStopWord') : t('home', 'tripDetailStopsWord')}`}
          </p>
          {trip.description && (
            <p className="trip-detail-description">{trip.description}</p>
          )}
          <div className="trip-detail-actions">
            <button type="button" className="trip-detail-btn trip-detail-btn--primary" onClick={openMap} disabled={totalStops === 0}>
              <Icon name="map" size={20} /> {t('detail', 'viewOnMap')}
            </button>
            <button type="button" className="trip-detail-btn trip-detail-btn--ghost" onClick={handleShare}>
              <Icon name="share" size={20} /> {t('detail', 'share')}
            </button>
            {trip.isHost !== false && (
              <button
                type="button"
                className="trip-detail-btn trip-detail-btn--outline"
                onClick={() => {
                  setShareRequestError(null);
                  if (shareRequestOpen) {
                    setRecipientUsername('');
                    setSelectedRecipient(null);
                    setRecipientOptions([]);
                  }
                  setShareRequestOpen((v) => !v);
                }}
              >
                <Icon name="person_add" size={20} /> {shareRequestOpen ? 'Close request' : 'Send request'}
              </button>
            )}
            {trip.isHost !== false && (
              <Link to={`/plan?edit=${encodeURIComponent(trip.id)}`} className="trip-detail-btn trip-detail-btn--outline">
                <Icon name="edit" size={20} /> {t('home', 'tripDetailEdit')}
              </Link>
            )}
            {trip.isHost !== false && (
              <button
                type="button"
                className="trip-detail-btn trip-detail-btn--danger trip-detail-btn--icon-only"
                onClick={handleDeleteTrip}
                disabled={deleting}
                aria-busy={deleting}
                aria-label={deleting ? t('home', 'loading') : t('home', 'deleteTrip')}
              >
                <Icon name="delete" size={22} ariaHidden />
              </button>
            )}
          </div>
          {deleteError && (
            <p className="trip-detail-delete-error" role="alert">
              {deleteError}
            </p>
          )}
          {shareRequestOpen && (
            <form className="trip-share-request-form" onSubmit={handleSendShareRequest}>
              <label className="trip-share-request-field">
                <span>Recipient username</span>
                <input
                  type="text"
                  value={recipientUsername}
                  onChange={(ev) => {
                    setRecipientUsername(ev.target.value);
                    setShareRequestError(null);
                  }}
                  placeholder="Type name or username"
                  autoComplete="off"
                  maxLength={80}
                  required
                />
              </label>
              {searchingRecipients && <p className="trip-share-request-hint">Searching users...</p>}
              {!searchingRecipients && recipientOptions.length > 0 && (
                <ul className="trip-share-request-suggestions" role="listbox" aria-label="Recipients">
                  {recipientOptions.map((u) => {
                    const handle = u.username || '';
                    const label = u.name || handle || u.email || 'User';
                    return (
                      <li key={u.id}>
                        <button
                          type="button"
                          className="trip-share-request-suggestion"
                          onClick={() => {
                            setSelectedRecipient(u);
                            setRecipientUsername(handle || u.name || u.email || '');
                            setRecipientOptions([]);
                            setShareRequestError(null);
                          }}
                        >
                          <span className="trip-share-request-suggestion-name">{label}</span>
                          {handle ? <span className="trip-share-request-suggestion-username">{handle}</span> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {!searchingRecipients && recipientUsername.trim().length >= 2 && recipientOptions.length === 0 && !selectedRecipient && (
                <p className="trip-share-request-hint">No matching users found.</p>
              )}
              {selectedRecipient && (
                <p className="trip-share-request-selected">
                  Selected: <strong>{selectedRecipient.name || selectedRecipient.username || selectedRecipient.email}</strong>
                </p>
              )}
              <label className="trip-share-request-field">
                <span>Message (optional)</span>
                <textarea
                  value={shareMessage}
                  onChange={(ev) => setShareMessage(ev.target.value)}
                  placeholder="Would you like to share this trip with me?"
                  rows={3}
                  maxLength={1200}
                />
              </label>
              <div className="trip-share-request-actions">
                <button type="submit" className="trip-detail-btn trip-detail-btn--primary" disabled={sendingShareRequest}>
                  <Icon name="send" size={18} />
                  {sendingShareRequest ? 'Sending...' : 'Send request'}
                </button>
              </div>
              {shareRequestError && (
                <p className="trip-detail-delete-error" role="alert">
                  {shareRequestError}
                </p>
              )}
            </form>
          )}
        </header>

        {Array.isArray(trip.users) && trip.users.length > 0 && (
          <section className="trip-detail-section trip-detail-section--users" aria-labelledby="trip-users-head">
            <h2 id="trip-users-head" className="trip-detail-section-title">
              Trip users
            </h2>
            <ul className="trip-detail-users-list">
              {trip.users.map((u) => (
                <li key={u.id || `${u.username}-${u.name}`} className="trip-detail-user-row">
                  <div className="trip-detail-user-main">
                    <span className="trip-detail-user-name">{u.name || u.username || 'User'}</span>
                    {u.username ? <span className="trip-detail-user-username">{u.username}</span> : null}
                  </div>
                  <span className={`trip-detail-user-role ${u.role === 'host' ? 'trip-detail-user-role--host' : ''}`}>
                    {u.role === 'host' ? 'Host' : 'Member'}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="trip-detail-section" aria-labelledby="trip-itin-head">
          <h2 id="trip-itin-head" className="trip-detail-section-title">
            {t('home', 'tripDetailItinerary')}
          </h2>
          <div className="trip-detail-days">
            {dayBlocks.map((block) => (
              <div key={block.index} className="trip-detail-day-card">
                <div className="trip-detail-day-head">
                  <span className="trip-detail-day-badge">{t('home', 'tripDetailDayLabel').replace('{n}', String(block.index + 1))}</span>
                  {block.dateLabel && <span className="trip-detail-day-date">{block.dateLabel}</span>}
                </div>
                {block.slots.length === 0 ? (
                  <p className="trip-detail-day-empty">{t('home', 'tripDetailEmptyDay')}</p>
                ) : (
                  <ul className="trip-detail-stop-list">
                    {block.slots.map((slot, si) => {
                      const pid = String(slot.placeId);
                      const place = placesById[pid];
                      const name = place?.name || pid;
                      const loc = place?.location || '';
                      const img = place ? getPlaceImageUrl(place.image || (Array.isArray(place.images) && place.images[0])) : null;
                      const timeLine = slotTimeLabel(slot);
                      const notes = slot.notes ? String(slot.notes).trim() : '';
                      return (
                        <li key={`${pid}-${si}`} className="trip-detail-stop">
                          <Link to={`/place/${encodeURIComponent(pid)}`} className="trip-detail-stop-link">
                            <div className="trip-detail-stop-media">
                              {img ? <DeliveryImg url={img} preset="tripStop" alt="" /> : null}
                              {!img && <Icon name="place" size={28} aria-hidden />}
                            </div>
                            <div className="trip-detail-stop-body">
                              {timeLine && (
                                <span className="trip-detail-stop-time">
                                  <Icon name="schedule" size={16} aria-hidden />
                                  {timeLine}
                                </span>
                              )}
                              <span className="trip-detail-stop-name">{name}</span>
                              {loc && <span className="trip-detail-stop-loc">{loc}</span>}
                              {notes && (
                                <span className="trip-detail-stop-notes">
                                  <strong>{t('home', 'tripDetailSlotNotes')}:</strong> {notes}
                                </span>
                              )}
                            </div>
                            <Icon name="chevron_right" size={22} className="trip-detail-stop-chevron" aria-hidden />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
