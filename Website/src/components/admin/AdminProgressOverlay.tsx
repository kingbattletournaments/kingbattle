"use client";

const DEFAULT_WARNING =
  "Please don't close this window or navigate away until this process completes.";

type AdminProgressOverlayProps = {
  open: boolean;
  title: string;
  message?: string;
  progress: number;
  warning?: string;
  /** Show numeric percent (default true). */
  showPercent?: boolean;
};

export function AdminProgressOverlay({
  open,
  title,
  message,
  progress,
  warning = DEFAULT_WARNING,
  showPercent = true,
}: AdminProgressOverlayProps) {
  if (!open) return null;

  const clamped = Math.max(0, Math.min(100, progress));
  const rounded = Math.round(clamped);

  return (
    <div
      className="admin-progress-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-progress-title"
      aria-busy="true"
    >
      <div className="admin-progress-card">
        <div className="admin-progress-spinner" aria-hidden />
        <h2 id="admin-progress-title" className="admin-progress-title">
          {title}
        </h2>
        {message ? <p className="admin-progress-message">{message}</p> : null}

        <div className="admin-progress-track-wrap">
          <div className="admin-progress-track">
            <div
              className="admin-progress-fill"
              style={{ width: `${clamped}%` }}
            />
          </div>
          {showPercent ? (
            <span className="admin-progress-percent">{rounded}%</span>
          ) : null}
        </div>

        <p className="admin-progress-warning">{warning}</p>
      </div>
    </div>
  );
}
