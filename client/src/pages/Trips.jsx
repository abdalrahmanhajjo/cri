import { useState, useEffect } from 'react';
import api from '../api/client';
import './Trips.css';

export default function Trips() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => {
    api.user.trips().then((data) => setTrips(data.trips || [])).catch((err) => setError(err.message || 'Failed to load trips')).finally(() => setLoading(false));
  }, []);
  if (loading) return <div className="trips-loading">Loading your trips…</div>;
  if (error) return <div className="trips-error">{error}</div>;
  return (
    <div className="trips-page">
      <h1 className="page-title">My Trips</h1>
      {trips.length === 0 ? (
        <div className="card trips-empty"><p>No trips yet. Save places and tours from the app to see them here.</p></div>
      ) : (
        <ul className="trips-list">
          {trips.map((t) => (
          <li key={t.id} className="card trip-item">
            <h3>{t.name || 'Trip'}</h3>
            <p className="trip-meta">
              {t.startDate && new Date(t.startDate).toLocaleDateString()} – {t.endDate && new Date(t.endDate).toLocaleDateString()}
              {Array.isArray(t.days) && t.days.length > 0 && ` · ${t.days.length} day(s)`}
            </p>
          </li>
        ))}
        </ul>
      )}
    </div>
  );
}
