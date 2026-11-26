import Link from "next/link";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { assets, auditLog, certificates, credentials, documents, organizations } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { accessibleOrgs } from "@/lib/access";
import { upcomingExpirations } from "@/lib/expirations";
import { AuditTable, Empty, ExpiryBadge, PageHead, fmtDate } from "@/components/server";

export const metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const user = await requireUser();
  const orgs = await accessibleOrgs(user);
  const ids = orgs.map((o) => o.id);
  const count = async (t: typeof assets | typeof credentials | typeof certificates | typeof documents) =>
    ids.length ? db.$count(t, inArray(t.orgId, ids)) : 0;
  const [nAssets, nCreds, nCerts, nDocs, expiring, activity] = await Promise.all([
    count(assets), count(credentials), count(certificates), count(documents),
    upcomingExpirations(orgs, 60),
    ids.length
      ? db.select({ id: auditLog.id, createdAt: auditLog.createdAt, actor: auditLog.actor, action: auditLog.action, detail: auditLog.detail, ip: sql<null>`null`, orgName: organizations.name })
          .from(auditLog).innerJoin(organizations, eq(organizations.id, auditLog.orgId))
          .where(inArray(auditLog.orgId, ids)).orderBy(desc(auditLog.createdAt)).limit(12)
      : [],
  ]);
  const stats: [string, number, string][] = [
    ["Organizations", orgs.length, "/orgs"], ["Systems", nAssets, "/orgs"], ["Credentials", nCreds, "/orgs"],
    ["Certificates", nCerts, "/expirations"], ["Documents", nDocs, "/orgs"],
    ["Expiring within 60 days", expiring.length, "/expirations"],
  ];
  return (
    <div className="stack">
      <PageHead title={`Welcome, ${user.name.split(" ")[0]}`} />
      {!orgs.length ? (
        <div className="card"><Empty title="No organizations yet">
          {user.role === "admin"
            ? <p>Create an organization for a customer or for your own infrastructure. <Link href="/orgs/new">Create one</Link></p>
            : <p>An administrator has not given you access to any organization yet.</p>}
        </Empty></div>
      ) : (
        <>
          <div className="grid-stats">
            {stats.map(([label, value, href]) => (
              <Link key={label} href={href} className="card stat"><div className="value">{value}</div><div className="label">{label}</div></Link>
            ))}
          </div>
          <section className="card">
            <div className="card-head"><h2>Expiring soon</h2><Link href="/expirations" className="small">View all</Link></div>
            {expiring.length ? (
              <div className="table-wrap"><table>
                <thead><tr><th>Item</th><th>Type</th><th>Organization</th><th>Date</th><th>Status</th></tr></thead>
                <tbody>
                  {expiring.slice(0, 8).map((e) => (
                    <tr key={`${e.kind}-${e.id}`}>
                      <td className="primary"><Link href={`/orgs/${e.orgId}/${e.kind}/${e.id}`}>{e.name}</Link></td>
                      <td>{e.what}</td>
                      <td><Link href={`/orgs/${e.orgId}`}>{e.orgName}</Link></td>
                      <td className="nowrap">{fmtDate(e.date)}</td>
                      <td><ExpiryBadge date={e.date} /></td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            ) : <Empty title="Nothing expires in the next 60 days" />}
          </section>
          <section className="card">
            <div className="card-head"><h2>Recent activity</h2></div>
            <AuditTable rows={activity} showOrg />
          </section>
        </>
      )}
    </div>
  );
}
