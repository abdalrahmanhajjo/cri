import './Business.css';

const DEFAULT_MESSAGE = 'Verifying your workspace…';

/** Full-screen gate while auth or portal access is resolved. */
export default function BusinessGateLoader({ message = DEFAULT_MESSAGE }) {
  return (
    <div className="business-gate-loader" role="status" aria-live="polite" aria-busy="true">
      <div className="business-gate-loader-inner">
        <div className="business-gate-loader-mark" aria-hidden="true">
          VT
        </div>
        <p className="business-gate-loader-text">{message}</p>
      </div>
    </div>
  );
}
