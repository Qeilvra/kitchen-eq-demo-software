export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? "compact" : ""}`}>
      <span className="brand-mark">
        <svg viewBox="0 0 36 36" aria-hidden="true">
          <path d="m6 27 10-19h4l10 19h-6l-6-12-6 12z" fill="currentColor" />
          <path d="M7 31h23" stroke="currentColor" strokeWidth="2" />
        </svg>
      </span>
      <span>
        <strong>
          AIRMECH<span className="brand-one"> ONE</span>
        </strong>
        <small>Built by Qeilvra</small>
      </span>
    </div>
  );
}
