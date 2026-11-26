"use client";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card">
      <div className="empty">
        <strong>That did not work</strong>
        <p>You may not have permission for this action, or something went wrong on the server.</p>
        <p style={{ marginTop: 12 }}><button type="button" className="btn" onClick={reset}>Try again</button></p>
      </div>
    </div>
  );
}
