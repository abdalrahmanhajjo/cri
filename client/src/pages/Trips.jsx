import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import './css/Trips.css';

function formatTripRange(startDate, endDate) {
  const a = startDate ? new Date(startDate).toLocaleDateString() : '';
  const b = endDate ? new Date(endDate).toLocaleDateString() : '';
  if (a && b) return `${a} - ${b}`;
  return a || b || '';
}

export default function Trips() {
  const { showToast } = useToast();
  const [trips, setTrips] = useState([]);
  const [inboxRequests, setInboxRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tripSearch, setTripSearch] = useState('');
  const [tripFilter, setTripFilter] = useState('all');
  const [tripSort, setTripSort] = useState('startDesc');
  const [respondingId, setRespondingId] = useState(null);

  const loadAll = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.user.trips(),
      api.user.tripShareRequests({ box: 'inbox', status: 'pending' }),
    ])
      .then(([tripsData, inboxData]) => {
        setTrips(Array.isArray(tripsData?.trips) ? tripsData.trips : []);
        setInboxRequests(Array.isArray(inboxData?.requests) ? inboxData.requests : []);
      })
      .catch((err) => setError(err?.message || 'Failed to load trips'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const now = Date.now();
  const normalizedTrips = useMemo(
    () =>
      trips.map((trip) => {
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
          _phase: phase,
          _days: Array.isArray(trip?.days) ? trip.days.length : 0,
        };
      }),
    [trips, now]
  );

  const tripCounts = useMemo(() => {
    const counts = { total: normalizedTrips.length, upcoming: 0, ongoing: 0, past: 0 };
    normalizedTrips.forEach((trip) => {
      if (trip._phase === 'upcoming') counts.upcoming += 1;
      else if (trip._phase === 'ongoing') counts.ongoing += 1;
      else if (trip._phase === 'past') counts.past += 1;
    });
    return counts;
  }, [normalizedTrips]);

  const visibleTrips = useMemo(() => {
    const query = tripSearch.trim().toLowerCase();
    const filtered = normalizedTrips
      .filter((trip) => (tripFilter === 'all' ? true : trip._phase === tripFilter))
      .filter((trip) => {
        if (!query) return true;
        const haystack = `${trip?.name || ''} ${formatTripRange(trip?.startDate, trip?.endDate)}`.toLowerCase();
        return haystack.includes(query);
      });
    return [...filtered].sort((a, b) => {
      if (tripSort === 'nameAsc') return (a?.name || '').localeCompare(b?.name || '');
      if (tripSort === 'nameDesc') return (b?.name || '').localeCompare(a?.name || '');
      if (tripSort === 'startAsc') return (a._safeStart || Number.MAX_SAFE_INTEGER) - (b._safeStart || Number.MAX_SAFE_INTEGER);
      return (b._safeStart || 0) - (a._safeStart || 0);
    });
  }, [normalizedTrips, tripFilter, tripSearch, tripSort]);

  const handleRespond = useCallback(async (requestId, decision) => {
    if (!requestId || respondingId) return;
    setRespondingId(requestId);
    try {
      await api.user.respondTripShareRequest(requestId, decision);
      showToast(decision === 'accept' ? 'Trip request accepted.' : 'Trip request rejected.', 'success');
      await loadAll();
    } catch (err) {
      showToast(err?.message || 'Failed to respond to request', 'error');
    } finally {
      setRespondingId(null);
    }
  }, [respondingId, showToast, loadAll]);

  if (loading) return <div className="trips-loading">Loading your trips...</div>;
  if (error) return <div className="trips-error">{error}</div>;

  return (
    <div className="trips-page">
      <section className="trips-hero">
        <div className="trips-hero-head">
          <div>
            <h1 className="page-title">My Trips</h1>
            <p className="trips-hero-sub">A simple view of your trips and pending share requests.</p>
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
          <div className="trips-stat"><strong>{inboxRequests.length}</strong><span>Pending shares</span></div>
        </div>
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
          {visibleTrips.map((trip) => (
            <li key={trip.id} className="card trip-item">
              <Link to={`/trips/${encodeURIComponent(trip.id)}`} className="trip-item-link">
                <div className="trip-item-row">
                  <h3>{trip.name || 'Trip'}</h3>
                  <span className={`trip-phase trip-phase--${trip._phase}`}>{trip._phase}</span>
                </div>
                <p className="trip-meta">
                  {formatTripRange(trip.startDate, trip.endDate) || 'No date selected'}
                  {trip._days > 0 && ` - ${trip._days} day(s)`}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section className="card trips-share-panel">
        <h2 className="trips-share-title">Pending share requests</h2>
        {inboxRequests.length === 0 ? (
          <p className="trips-share-empty">No pending requests.</p>
        ) : (
          <ul className="trips-share-list">
            {inboxRequests.map((req) => (
              <li key={req.id} className="trips-share-item">
                <div className="trips-share-head">
                  <p className="trips-share-user">
                    From <strong>{req.fromUser?.name || req.fromUser?.username || 'User'}</strong>
                  </p>
                  <span className="trips-share-status">{req.status}</span>
                </div>
                <p className="trips-share-trip">{req.trip?.name || 'Trip'}</p>
                <p className="trips-share-meta">{formatTripRange(req.trip?.startDate, req.trip?.endDate)}</p>
                {req.message ? <p className="trips-share-message">"{req.message}"</p> : null}
                <div className="trips-share-actions">
                  <button
                    type="button"
                    className="trips-share-btn trips-share-btn--accept"
                    onClick={() => handleRespond(req.id, 'accept')}
                    disabled={respondingId === req.id}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="trips-share-btn trips-share-btn--reject"
                    onClick={() => handleRespond(req.id, 'reject')}
                    disabled={respondingId === req.id}
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
