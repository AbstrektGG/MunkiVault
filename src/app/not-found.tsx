import Link from "next/link";

export default function NotFound() {
  return (
    <main className="auth">
      <div className="card auth-card" style={{ textAlign: "center" }}>
        <h1>Not found</h1>
        <p className="muted" style={{ margin: "8px 0 16px" }}>This page does not exist, or you do not have access to it.</p>
        <Link href="/" className="btn btn-primary">Back to the dashboard</Link>
      </div>
    </main>
  );
}
