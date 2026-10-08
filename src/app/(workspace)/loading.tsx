export default function Loading() {
  return (
    <div className="loading-state" role="status">
      <div className="loading-line" />
      <div className="loading-cards">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} />
        ))}
      </div>
      <p>Loading your workspace…</p>
    </div>
  );
}
