import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { assets, documents } from "@/db/schema";
import { requireOrg } from "@/lib/access";
import { upcomingExpirations } from "@/lib/expirations";
import { ASSET_TYPES } from "@/lib/entities";
import { fmtDateTime } from "@/lib/format";
import { Empty, ExpiryBadge, fmtDate } from "@/components/server";

export default async function OrgOverview({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const { org } = await requireOrg(orgId);
  const [expiring, recentAssets, recentDocs] = await Promise.all([
    upcomingExpirations([org], 90),
    db.select().from(assets).where(eq(assets.orgId, orgId)).orderBy(desc(assets.updatedAt)).limit(6),
    db.select().from(documents).where(eq(documents.orgId, orgId)).orderBy(desc(documents.updatedAt)).limit(6),
  ]);
  const typeLabel = (t: string) => ASSET_TYPES.find(([v]) => v === t)?.[1] ?? t;
  return (
    <div className="stack">
      {org.description ? <p className="muted">{org.description}</p> : null}
      <section className="card">
        <div className="card-head"><h2>Expiring within 90 days</h2></div>
        {expiring.length ? (
          <div className="table-wrap"><table>
            <thead><tr><th>Item</th><th>Type</th><th>Date</th><th>Status</th></tr></thead>
            <tbody>{expiring.map((e) => (
              <tr key={`${e.kind}-${e.id}`}>
                <td className="primary"><Link href={`/orgs/${orgId}/${e.kind}/${e.id}`}>{e.name}</Link></td>
                <td>{e.what}</td><td className="nowrap">{fmtDate(e.date)}</td><td><ExpiryBadge date={e.date} /></td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <Empty title="Nothing is due to expire" />}
      </section>
      <div className="grid-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <section className="card">
          <div className="card-head"><h2>Recently updated systems</h2><Link className="small" href={`/orgs/${orgId}/assets`}>All systems</Link></div>
          {recentAssets.length ? <table><tbody>{recentAssets.map((a) => (
            <tr key={a.id}><td className="primary"><Link href={`/orgs/${orgId}/assets/${a.id}`}>{a.name}</Link></td><td className="muted">{typeLabel(a.type)}</td><td className="muted small nowrap">{fmtDateTime(a.updatedAt)}</td></tr>
          ))}</tbody></table> : <Empty title="No systems yet" />}
        </section>
        <section className="card">
          <div className="card-head"><h2>Recently updated documents</h2><Link className="small" href={`/orgs/${orgId}/documents`}>All documents</Link></div>
          {recentDocs.length ? <table><tbody>{recentDocs.map((d) => (
            <tr key={d.id}><td className="primary"><Link href={`/orgs/${orgId}/documents/${d.id}`}>{d.name}</Link></td><td className="muted">{d.folder ?? ""}</td><td className="muted small nowrap">{fmtDateTime(d.updatedAt)}</td></tr>
          ))}</tbody></table> : <Empty title="No documents yet" />}
        </section>
      </div>
    </div>
  );
}
