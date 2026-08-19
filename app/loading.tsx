export default function Loading() {
  return (
    <div className="route-loading" role="status" aria-live="polite">
      <span className="route-loading-label">Opening this space…</span>
      <div className="route-loading-line" aria-hidden="true" />
      <div className="route-loading-line" aria-hidden="true" />
      <div className="route-loading-line short" aria-hidden="true" />
    </div>
  );
}
