import { desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, organizations } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { AuditTable, PageHead } from "@/components/server";

export const metadata = { title: "Audit log" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const q = String((await searchParams).q ?? "").trim().slice(0, 100);
  const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  const rows = await db.select({
    id: auditLog.id, createdAt: auditLog.createdAt, actor: auditLog.actor, action: auditLog.action,
    detail: auditLog.detail, ip: auditLog.ip, orgName: organizations.name,
  }).from(auditLog).leftJoin(organizations, eq(organizations.id, auditLog.orgId))
    .where(q ? or(ilike(auditLog.actor, like), ilike(auditLog.action, like), ilike(auditLog.detail, like)) : undefined)
    .orderBy(desc(auditLog.createdAt)).limit(500);
  return (
    <div className="stack">
      <PageHead title="Audit log" />
      <form className="row" style={{ maxWidth: 520 }}>
        <input type="search" name="q" defaultValue={q} placeholder="Filter by person, action or detail (for example: revealed)" aria-label="Filter" />
        <button className="btn" type="submit">Filter</button>
      </form>
      <section className="card"><div className="card-head"><h2>Events</h2><span className="muted small">Latest 500</span></div><AuditTable rows={rows} showOrg /></section>
    </div>
  );
}
