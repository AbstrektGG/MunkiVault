import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLog } from "@/db/schema";
import { can, requireOrg } from "@/lib/access";
import { AuditTable } from "@/components/server";

export default async function OrgActivity({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const { level } = await requireOrg(orgId);
  const rows = await db.select().from(auditLog).where(eq(auditLog.orgId, orgId)).orderBy(desc(auditLog.createdAt)).limit(200);
  // IP addresses are only shown to managers.
  const shown = can(level, "manager") ? rows : rows.map((r) => ({ ...r, ip: null }));
  return <section className="card"><div className="card-head"><h2>Activity</h2><span className="muted small">Latest 200 events</span></div><AuditTable rows={shown} /></section>;
}
