import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import './Trips.css';

function formatTripRange(startDate, endDate) {
  const a = startDate ? new Date(startDate).toLocaleDateString() : '';
  const b = endDate ? new Date(endDate).toLocaleDateString() : '';
  if (a && b) return `${a} - ${b}`;
  return a || b || '';
}

export default function Trips() {
  const [trips, setTrips] = useState([]);
  const [inboxRequests, setInboxRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadAll = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.user.trips(),
      api.user.tripShareRequests({ box: 'inbox' }),
      api.user.tripShareRequests({ box: 'sent' }),
    ])
      .then(([tripsData, inboxData, sentData]) => {
        setTrips(tripsData.trips || []);
        setInboxRequests(inboxData.requests || []);
        setSentRequests(sentData.requests || []);
      })
      .catch((err) => setError(err.message || 'Failed to load trips'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const pendingInbox = useMemo(() => inboxRequests.filter((r) => r.status === 'pending'), [inboxRequests]);

  const handleRespond = useCallback(
    async (requestId, decision) => {
      try {
        await api.user.respondTripShareRequest(requestId, decision);
        await loadAll();
      } catch (err) {
        window.alert(err?.message || 'Failed to respond to request');
      }
    },
    [loadAll]
  );

  if (loading) return <div className="trips-loading">Loading your trips...</div>;
  if (error) return <div className="trips-error">{error}</div>;

  return (
    <div className="trips-page">
      <h1 className="page-title">My Trips</h1>

      <section className="card trips-share-panel">
        <h2 className="trips-share-title">Trip share requests</h2>
        {pendingInbox.length === 0 ? (
          <p className="trips-share-empty">No pending requests.</p>
        ) : (
          <ul className="trips-share-list">
            {pendingInbox.map((req) => (
              <li key={req.id} className="trips-share-item">
                <div className="trips-share-head">
                  <p className="trips-share-user">
                    From <strong>{req.fromUser?.name || req.fromUser?.username || 'User'}</strong>
                  </p>
                  <span className="trips-share-status">{req.status}</span>
                </div>
                <p className="trips-share-trip">{req.trip?.name || 'Trip'}</p>
                <p className="trips-share-meta">
                  {formatTripRange(req.trip?.startDate, req.trip?.endDate)}
                  {` - ${req.trip?.dayCount || 0} day(s), ${req.trip?.stopCount || 0} stop(s)`}
                </p>
                {req.message ? <p className="trips-share-message">"{req.message}"</p> : null}
                <div className="trips-share-actions">
                  <button
                    type="button"
                    className="trips-share-btn trips-share-btn--accept"
                    onClick={() => handleRespond(req.id, 'accept')}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="trips-share-btn trips-share-btn--reject"
                    onClick={() => handleRespond(req.id, 'reject')}
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {trips.length === 0 ? (
        <div className="card trips-empty"><p>No trips yet. Save places and tours from the app to see them here.</p></div>
      ) : (
        <ul className="trips-list">
          {trips.map((t) => (
            <li key={t.id} className="card trip-item">
              <Link to={`/trips/${encodeURIComponent(t.id)}`} className="trip-item-link">
                <h3>{t.name || 'Trip'}</h3>
                <p className="trip-meta">
                  {t.startDate && new Date(t.startDate).toLocaleDateString()} - {t.endDate && new Date(t.endDate).toLocaleDateString()}
                  {Array.isArray(t.days) && t.days.length > 0 && ` - ${t.days.length} day(s)`}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {sentRequests.length > 0 && (
        <section className="card trips-share-panel trips-share-panel--sent">
          <h2 className="trips-share-title">Sent requests</h2>
          <ul className="trips-share-list">
            {sentRequests.slice(0, 10).map((req) => (
              <li key={req.id} className="trips-share-item">
                <div className="trips-share-head">
                  <p className="trips-share-user">
                    To <strong>{req.toUser?.name || req.toUser?.username || 'User'}</strong>
                  </p>
                  <span className="trips-share-status">{req.status}</span>
                </div>
                <p className="trips-share-trip">{req.trip?.name || 'Trip'}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
