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
  const [tripSearch, setTripSearch] = useState('');
  const [tripFilter, setTripFilter] = useState('all');
  const [tripSort, setTripSort] = useState('startDesc');
  const [requestView, setRequestView] = useState('inbox');
  const [requestStatusFilter, setRequestStatusFilter] = useState('all');

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

  const now = Date.now();

  const normalizedTrips = useMemo(
    () =>
      (trips || []).map((trip) => {
        const startsAt = trip?.startDate ? new Date(trip.startDate).getTime() : null;
        const endsAt = trip?.endDate ? new Date(trip.endDate).getTime() : startsAt;
        const safeStart = Number.isFinite(startsAt) ? startsAt : null;
        const safeEnd = Number.isFinite(endsAt) ? endsAt : safeStart;

        let phase = 'undated';
        if (safeStart && safeEnd) {
          if (safeStart > now) phase = 'upcoming';
          else if (safeEnd < now) phase = 'past';
          else phase = 'ongoing';
        }

        return {
          ...trip,
          _safeStart: safeStart,
          _safeEnd: safeEnd,
          _phase: phase,
          _days: Array.isArray(trip?.days) ? trip.days.length : 0,
        };
      }),
    [trips, now]
  );

  const tripCounts = useMemo(() => {
    const counts = { total: normalizedTrips.length, upcoming: 0, ongoing: 0, past: 0, undated: 0 };
    normalizedTrips.forEach((trip) => {
      if (trip._phase === 'upcoming') counts.upcoming += 1;
      else if (trip._phase === 'ongoing') counts.ongoing += 1;
      else if (trip._phase === 'past') counts.past += 1;
      else counts.undated += 1;
    });
    return counts;
  }, [normalizedTrips]);

  const visibleTrips = useMemo(() => {
    const query = tripSearch.trim().toLowerCase();

    const byFilter = normalizedTrips.filter((trip) => {
      if (tripFilter === 'all') return true;
      return trip._phase === tripFilter;
    });

    const bySearch = byFilter.filter((trip) => {
      if (!query) return true;
      const haystack = `${trip?.name || ''} ${formatTripRange(trip?.startDate, trip?.endDate)}`.toLowerCase();
      return haystack.includes(query);
    });

    const sorted = [...bySearch].sort((a, b) => {
      if (tripSort === 'nameAsc') return (a?.name || '').localeCompare(b?.name || '');
      if (tripSort === 'nameDesc') return (b?.name || '').localeCompare(a?.name || '');
      if (tripSort === 'startAsc') return (a._safeStart || Number.MAX_SAFE_INTEGER) - (b._safeStart || Number.MAX_SAFE_INTEGER);
      return (b._safeStart || 0) - (a._safeStart || 0);
    });

    return sorted;
  }, [normalizedTrips, tripFilter, tripSearch, tripSort]);

  const pendingInbox = useMemo(() => inboxRequests.filter((r) => r.status === 'pending'), [inboxRequests]);
  const allRequests = useMemo(() => [...inboxRequests, ...sentRequests], [inboxRequests, sentRequests]);
  const activeRequests = useMemo(() => {
    if (requestView === 'inbox') return inboxRequests;
    if (requestView === 'sent') return sentRequests;
    return allRequests;
  }, [requestView, inboxRequests, sentRequests, allRequests]);

  const filteredRequests = useMemo(() => {
    if (requestStatusFilter === 'all') return activeRequests;
    return activeRequests.filter((request) => request.status === requestStatusFilter);
  }, [activeRequests, requestStatusFilter]);

  const requestCounts = useMemo(
    () => ({
      inbox: inboxRequests.length,
      sent: sentRequests.length,
      all: allRequests.length,
      pending: allRequests.filter((request) => request.status === 'pending').length,
    }),
    [inboxRequests, sentRequests, allRequests]
  );

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
      <section className="trips-hero">
        <div className="trips-hero-head">
          <div>
            <h1 className="page-title">My Trips</h1>
            <p className="trips-hero-sub">Organize your itinerary, track timing, and manage sharing in one place.</p>
          </div>
          <div className="trips-hero-actions">
            <button type="button" className="trips-ghost-btn" onClick={loadAll}>Refresh</button>
            <Link to="/plan" className="trips-primary-btn">Create trip</Link>
          </div>
        </div>
        <div className="trips-stats">
          <div className="trips-stat"><strong>{tripCounts.total}</strong><span>Total</span></div>
          <div className="trips-stat"><strong>{tripCounts.upcoming}</strong><span>Upcoming</span></div>
          <div className="trips-stat"><strong>{tripCounts.ongoing}</strong><span>Ongoing</span></div>
          <div className="trips-stat"><strong>{tripCounts.past}</strong><span>Past</span></div>
          <div className="trips-stat"><strong>{requestCounts.pending}</strong><span>Pending shares</span></div>
        </div>
      </section>

      <section className="card trips-share-panel">
        <h2 className="trips-share-title">Trip share requests</h2>
        <div className="trips-share-toolbar">
          <div className="trips-segmented">
            <button type="button" className={`trips-segmented-btn ${requestView === 'inbox' ? 'is-active' : ''}`} onClick={() => setRequestView('inbox')}>
              Inbox ({requestCounts.inbox})
            </button>
            <button type="button" className={`trips-segmented-btn ${requestView === 'sent' ? 'is-active' : ''}`} onClick={() => setRequestView('sent')}>
              Sent ({requestCounts.sent})
            </button>
            <button type="button" className={`trips-segmented-btn ${requestView === 'all' ? 'is-active' : ''}`} onClick={() => setRequestView('all')}>
              All ({requestCounts.all})
            </button>
          </div>
          <select className="trips-select" value={requestStatusFilter} onChange={(e) => setRequestStatusFilter(e.target.value)} aria-label="Filter share requests">
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="accept">Accepted</option>
            <option value="accepted">Accepted</option>
            <option value="reject">Rejected</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        {filteredRequests.length === 0 ? (
          <p className="trips-share-empty">
            {requestStatusFilter === 'all'
              ? 'No requests in this view.'
              : `No ${requestStatusFilter} requests in this view.`}
          </p>
        ) : (
          <ul className="trips-share-list">
            {filteredRequests.slice(0, 12).map((req) => (
              <li key={req.id} className="trips-share-item">
                <div className="trips-share-head">
                  <p className="trips-share-user">
                    {requestView === 'sent' ? 'To' : 'From'}{' '}
                    <strong>
                      {requestView === 'sent'
                        ? req.toUser?.name || req.toUser?.username || 'User'
                        : req.fromUser?.name || req.fromUser?.username || 'User'}
                    </strong>
                  </p>
                  <span className="trips-share-status">{req.status}</span>
                </div>
                <p className="trips-share-trip">{req.trip?.name || 'Trip'}</p>
                <p className="trips-share-meta">
                  {formatTripRange(req.trip?.startDate, req.trip?.endDate)}
                  {` - ${req.trip?.dayCount || 0} day(s), ${req.trip?.stopCount || 0} stop(s)`}
                </p>
                {req.message ? <p className="trips-share-message">"{req.message}"</p> : null}
                {(requestView === 'inbox' || requestView === 'all') && req.status === 'pending' ? (
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
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="trips-controls">
        <div className="trips-search-wrap">
          <input
            type="search"
            className="trips-search"
            placeholder="Search trips by name or date..."
            value={tripSearch}
            onChange={(e) => setTripSearch(e.target.value)}
            aria-label="Search trips"
          />
        </div>
        <div className="trips-filters">
          <div className="trips-filter-chips">
            <button type="button" className={`trips-chip ${tripFilter === 'all' ? 'is-active' : ''}`} onClick={() => setTripFilter('all')}>All</button>
            <button type="button" className={`trips-chip ${tripFilter === 'upcoming' ? 'is-active' : ''}`} onClick={() => setTripFilter('upcoming')}>Upcoming</button>
            <button type="button" className={`trips-chip ${tripFilter === 'ongoing' ? 'is-active' : ''}`} onClick={() => setTripFilter('ongoing')}>Ongoing</button>
            <button type="button" className={`trips-chip ${tripFilter === 'past' ? 'is-active' : ''}`} onClick={() => setTripFilter('past')}>Past</button>
          </div>
          <select className="trips-select" value={tripSort} onChange={(e) => setTripSort(e.target.value)} aria-label="Sort trips">
            <option value="startDesc">Newest first</option>
            <option value="startAsc">Oldest first</option>
            <option value="nameAsc">Name A-Z</option>
            <option value="nameDesc">Name Z-A</option>
          </select>
        </div>
      </section>

      {visibleTrips.length === 0 ? (
        <div className="card trips-empty">
          <p>
            {trips.length === 0
              ? 'No trips yet. Save places and tours from the app to see them here.'
              : 'No trips match your current search/filter.'}
          </p>
        </div>
      ) : (
        <ul className="trips-list">
          {visibleTrips.map((t) => (
            <li key={t.id} className="card trip-item">
              <Link to={`/trips/${encodeURIComponent(t.id)}`} className="trip-item-link">
                <div className="trip-item-row">
                  <h3>{t.name || 'Trip'}</h3>
                  <span className={`trip-phase trip-phase--${t._phase}`}>{t._phase}</span>
                </div>
                <p className="trip-meta">
                  {formatTripRange(t.startDate, t.endDate) || 'No date selected'}
                  {t._days > 0 && ` - ${t._days} day(s)`}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {pendingInbox.length > 0 ? <p className="trips-footnote">You have {pendingInbox.length} pending request(s) waiting for response.</p> : null}
    </div>
  );
}
