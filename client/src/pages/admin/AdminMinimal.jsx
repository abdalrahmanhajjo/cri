import { Link } from 'react-router-dom';

/** Minimal admin page - no deps, for debugging blank page */
export default function AdminMinimal() {
  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', background: '#1e5631', color: '#fff', minHeight: '100vh' }}>
      <h1>Admin Works</h1>
      <p>If you see this, routing is fine.</p>
      <p>
        <Link to="/admin-full" style={{ color: '#fff', textDecoration: 'underline' }}>Open full admin dashboard →</Link>
      </p>
    </div>
  );
}
