/** Lightweight full-viewport placeholder while a lazy route chunk loads. */
export default function RoutePageFallback() {
  return (
    <div className="route-page-fallback" role="status" aria-live="polite" aria-busy="true">
      <div className="route-page-fallback-spinner" aria-hidden="true" />
      <span className="route-page-fallback-sr">Loading…</span>
    </div>
  );
}
