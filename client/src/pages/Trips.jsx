import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import './Trips.css';

function formatTripRange(startDate, endDate) {
  const a = startDate ? new Date(startDate).toLocaleDateString() : '';
  const b = endDate ? new Date(endDate).toLocaleDateString() : '';
  if (a && b) return `${a} - ${b}`;
  return a || b || '';
}

function shiftDateOnly(dateInput, days) {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  if (!Number.isFinite(d.getTime())) return null;
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function Trips() {
  const { showToast } = useToast();
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
  const [viewMode, setViewMode] = useState('cards');
  const [archivedTripIds, setArchivedTripIds] = useState(() => {
    try {
      const raw = localStorage.getItem('tripoli-archived-trip-ids');
      const parsed = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
    } catch {
      return new Set();
    }
  });
  const [selectedTripIds, setSelectedTripIds] = useState(new Set());
  const [visibleCount, setVisibleCount] = useState(12);
  const [bulkBusy, setBulkBusy] = useState(false);
  const loadMoreRef = useRef(null);

  const saveArchivedIds = useCallback((nextSet) => {
    setArchivedTripIds(new Set(nextSet));
    try {
      localStorage.setItem('tripoli-archived-trip-ids', JSON.stringify(Array.from(nextSet)));
    } catch {
      // Ignore storage failures.
    }
  }, []);

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
          _isArchived: archivedTripIds.has(String(trip.id)),
        };
      }),
    [trips, now, archivedTripIds]
  );

  const tripCounts = useMemo(() => {
    const counts = { total: normalizedTrips.length, upcoming: 0, ongoing: 0, past: 0, undated: 0, archived: 0 };
    normalizedTrips.forEach((trip) => {
      if (trip._isArchived) {
        counts.archived += 1;
        return;
      }
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
      if (tripFilter === 'archived') return trip._isArchived;
      if (trip._isArchived) return false;
      if (tripFilter === 'all') return true;
      return trip._phase === tripFilter;
    });

    const bySearch = byFilter.filter((trip) => {
      if (!query) return true;
      const haystack = `${trip?.name || ''} ${formatTripRange(trip?.startDate, trip?.endDate)}`.toLowerCase();
      return haystack.includes(query);
    });

    return [...bySearch].sort((a, b) => {
      if (tripSort === 'nameAsc') return (a?.name || '').localeCompare(b?.name || '');
      if (tripSort === 'nameDesc') return (b?.name || '').localeCompare(a?.name || '');
      if (tripSort === 'startAsc') return (a._safeStart || Number.MAX_SAFE_INTEGER) - (b._safeStart || Number.MAX_SAFE_INTEGER);
      return (b._safeStart || 0) - (a._safeStart || 0);
    });
  }, [normalizedTrips, tripFilter, tripSearch, tripSort]);

  const renderedTrips = useMemo(() => visibleTrips.slice(0, visibleCount), [visibleTrips, visibleCount]);
  const hasMoreTrips = renderedTrips.length < visibleTrips.length;

  const timelineGroups = useMemo(() => {
    const groups = new Map();
    renderedTrips.forEach((trip) => {
      const key = trip._safeStart
        ? new Date(trip._safeStart).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
        : 'Undated';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(trip);
    });
    return Array.from(groups.entries()).map(([month, items]) => ({ month, items }));
  }, [renderedTrips]);

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

  const selectedVisibleCount = useMemo(
    () => renderedTrips.filter((trip) => selectedTripIds.has(String(trip.id))).length,
    [renderedTrips, selectedTripIds]
  );

  const handleRespond = useCallback(
    async (requestId, decision) => {
      try {
        await api.user.respondTripShareRequest(requestId, decision);
        await loadAll();
      } catch (err) {
        showToast(err?.message || 'Failed to respond to request', 'error');
      }
    },
    [loadAll, showToast]
  );

  const toggleTripSelected = useCallback((tripId) => {
    setSelectedTripIds((prev) => {
      const next = new Set(prev);
      const key = String(tripId);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedTripIds(new Set()), []);

  const selectAllRendered = useCallback(() => {
    setSelectedTripIds((prev) => {
      const next = new Set(prev);
      renderedTrips.forEach((trip) => next.add(String(trip.id)));
      return next;
    });
  }, [renderedTrips]);

  const archiveSelected = useCallback(() => {
    if (selectedTripIds.size === 0) return;
    const next = new Set(archivedTripIds);
    selectedTripIds.forEach((id) => next.add(String(id)));
    saveArchivedIds(next);
    clearSelection();
    showToast('Trips archived', 'success');
  }, [selectedTripIds, archivedTripIds, saveArchivedIds, clearSelection, showToast]);

  const unarchiveSelected = useCallback(() => {
    if (selectedTripIds.size === 0) return;
    const next = new Set(archivedTripIds);
    selectedTripIds.forEach((id) => next.delete(String(id)));
    saveArchivedIds(next);
    clearSelection();
    showToast('Trips moved out of archive', 'success');
  }, [selectedTripIds, archivedTripIds, saveArchivedIds, clearSelection, showToast]);

  const deleteSelected = useCallback(async () => {
    if (selectedTripIds.size === 0 || bulkBusy) return;
    if (!window.confirm(`Delete ${selectedTripIds.size} selected trip(s)? This cannot be undone.`)) return;
    setBulkBusy(true);
    try {
      const ids = Array.from(selectedTripIds);
      const results = await Promise.allSettled(ids.map((id) => api.user.deleteTrip(id)));
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      const fail = results.length - ok;
      if (ok > 0) showToast(`${ok} trip(s) deleted`, 'success');
      if (fail > 0) showToast(`${fail} trip(s) failed to delete`, 'error');
      clearSelection();
      await loadAll();
    } finally {
      setBulkBusy(false);
    }
  }, [selectedTripIds, bulkBusy, clearSelection, loadAll, showToast]);

  const moveSelectedByDays = useCallback(async () => {
    if (selectedTripIds.size === 0 || bulkBusy) return;
    const raw = window.prompt('Move selected trips by how many days? (e.g. 7 or -3)', '7');
    if (raw == null) return;
    const days = Number.parseInt(String(raw).trim(), 10);
    if (!Number.isFinite(days) || days === 0) {
      showToast('Enter a valid non-zero day number.', 'error');
      return;
    }
    setBulkBusy(true);
    try {
      const selected = normalizedTrips.filter((trip) => selectedTripIds.has(String(trip.id)));
      const jobs = selected.map((trip) => {
        const nextStart = shiftDateOnly(trip.startDate, days);
        const nextEnd = shiftDateOnly(trip.endDate, days);
        if (!nextStart || !nextEnd) return Promise.resolve(null);
        return api.user.updateTrip(trip.id, { startDate: nextStart, endDate: nextEnd });
      });
      const results = await Promise.allSettled(jobs);
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      const fail = results.length - ok;
      if (ok > 0) showToast(`${ok} trip(s) moved by ${days} day(s)`, 'success');
      if (fail > 0) showToast(`${fail} trip(s) failed to move`, 'error');
      clearSelection();
      await loadAll();
    } finally {
      setBulkBusy(false);
    }
  }, [selectedTripIds, bulkBusy, normalizedTrips, clearSelection, loadAll, showToast]);

  const duplicateTrip = useCallback(
    async (tripId) => {
      try {
        const source = await api.user.getTrip(tripId);
        const created = await api.user.createTrip({
          name: `${source?.name || 'Trip'} (Copy)`,
          startDate: source?.startDate,
          endDate: source?.endDate,
          description: source?.description || '',
        });
        if (Array.isArray(source?.days) && source.days.length > 0) {
          await api.user.updateTrip(created.id, { days: source.days });
        }
        showToast('Trip duplicated', 'success');
        await loadAll();
      } catch (err) {
        showToast(err?.message || 'Failed to duplicate trip', 'error');
      }
    },
    [loadAll, showToast]
  );

  const shareTrip = useCallback(
    async (trip) => {
      const url = `${window.location.origin}/trips/${encodeURIComponent(trip.id)}`;
      if (navigator?.share) {
        try {
          await navigator.share({ title: trip.name || 'Trip', text: trip.name || 'Trip', url });
          return;
        } catch {
          // Fallback to clipboard when share is canceled or unsupported.
        }
      }
      try {
        await navigator.clipboard.writeText(url);
        showToast('Trip link copied', 'success');
      } catch {
        showToast('Unable to share trip link', 'error');
      }
    },
    [showToast]
  );

  useEffect(() => {
    setVisibleCount(12);
    setSelectedTripIds(new Set());
  }, [tripSearch, tripFilter, tripSort, viewMode]);

  useEffect(() => {
    if (!hasMoreTrips || !loadMoreRef.current) return undefined;
    const node = loadMoreRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setVisibleCount((prev) => Math.min(prev + 12, visibleTrips.length));
        });
      },
      { rootMargin: '140px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMoreTrips, visibleTrips.length]);

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
          <div className="trips-stat"><strong>{tripCounts.archived}</strong><span>Archived</span></div>
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
                    <button type="button" className="trips-share-btn trips-share-btn--accept" onClick={() => handleRespond(req.id, 'accept')}>
                      Accept
                    </button>
                    <button type="button" className="trips-share-btn trips-share-btn--reject" onClick={() => handleRespond(req.id, 'reject')}>
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
            <button type="button" className={`trips-chip ${tripFilter === 'archived' ? 'is-active' : ''}`} onClick={() => setTripFilter('archived')}>Archived</button>
          </div>
          <div className="trips-controls-right">
            <div className="trips-segmented">
              <button type="button" className={`trips-segmented-btn ${viewMode === 'cards' ? 'is-active' : ''}`} onClick={() => setViewMode('cards')}>Cards</button>
              <button type="button" className={`trips-segmented-btn ${viewMode === 'timeline' ? 'is-active' : ''}`} onClick={() => setViewMode('timeline')}>Timeline</button>
            </div>
            <select className="trips-select" value={tripSort} onChange={(e) => setTripSort(e.target.value)} aria-label="Sort trips">
              <option value="startDesc">Newest first</option>
              <option value="startAsc">Oldest first</option>
              <option value="nameAsc">Name A-Z</option>
              <option value="nameDesc">Name Z-A</option>
            </select>
          </div>
        </div>
      </section>

      {renderedTrips.length > 0 ? (
        <section className="card trips-bulk-panel">
          <div className="trips-bulk-head">
            <p>{selectedTripIds.size} selected</p>
            <div className="trips-bulk-actions">
              <button type="button" className="trips-ghost-btn" onClick={selectAllRendered}>Select visible</button>
              <button type="button" className="trips-ghost-btn" onClick={clearSelection}>Clear</button>
              <button type="button" className="trips-ghost-btn" onClick={archiveSelected} disabled={selectedTripIds.size === 0 || bulkBusy}>Archive</button>
              <button type="button" className="trips-ghost-btn" onClick={unarchiveSelected} disabled={selectedTripIds.size === 0 || bulkBusy}>Unarchive</button>
              <button type="button" className="trips-ghost-btn" onClick={moveSelectedByDays} disabled={selectedTripIds.size === 0 || bulkBusy}>Move dates</button>
              <button type="button" className="trips-danger-btn" onClick={deleteSelected} disabled={selectedTripIds.size === 0 || bulkBusy}>Delete</button>
            </div>
          </div>
          <p className="trips-footnote">Selected in current view: {selectedVisibleCount} of {renderedTrips.length}</p>
        </section>
      ) : null}

      {visibleTrips.length === 0 ? (
        <div className="card trips-empty">
          <p>
            {trips.length === 0
              ? 'No trips yet. Save places and tours from the app to see them here.'
              : 'No trips match your current search/filter.'}
          </p>
        </div>
      ) : viewMode === 'cards' ? (
        <ul className="trips-list">
          {renderedTrips.map((trip) => (
            <li key={trip.id} className="card trip-item">
              <div className="trip-item-select">
                <input
                  type="checkbox"
                  checked={selectedTripIds.has(String(trip.id))}
                  onChange={() => toggleTripSelected(trip.id)}
                  aria-label={`Select ${trip.name || 'trip'}`}
                />
              </div>
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
              <div className="trip-item-quick-actions">
                <button type="button" className="trips-mini-btn" onClick={() => duplicateTrip(trip.id)}>Duplicate</button>
                <button type="button" className="trips-mini-btn" onClick={() => shareTrip(trip)}>Share</button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="trips-timeline">
          {timelineGroups.map((group) => (
            <section key={group.month} className="trips-timeline-group">
              <h3 className="trips-timeline-month">{group.month}</h3>
              <ul className="trips-timeline-list">
                {group.items.map((trip) => (
                  <li key={trip.id} className="card trips-timeline-item">
                    <div className="trip-item-select">
                      <input
                        type="checkbox"
                        checked={selectedTripIds.has(String(trip.id))}
                        onChange={() => toggleTripSelected(trip.id)}
                        aria-label={`Select ${trip.name || 'trip'}`}
                      />
                    </div>
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
                    <div className="trip-item-quick-actions">
                      <button type="button" className="trips-mini-btn" onClick={() => duplicateTrip(trip.id)}>Duplicate</button>
                      <button type="button" className="trips-mini-btn" onClick={() => shareTrip(trip)}>Share</button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {hasMoreTrips ? <div ref={loadMoreRef} className="trips-load-more-sentinel" aria-hidden="true" /> : null}
      {hasMoreTrips ? (
        <button type="button" className="trips-ghost-btn trips-load-more-btn" onClick={() => setVisibleCount((prev) => Math.min(prev + 12, visibleTrips.length))}>
          Load more
        </button>
      ) : null}
      {pendingInbox.length > 0 ? <p className="trips-footnote">You have {pendingInbox.length} pending request(s) waiting for response.</p> : null}
    </div>
  );
}
