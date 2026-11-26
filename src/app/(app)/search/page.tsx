import Link from "next/link";
import { and, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { assets, certificates, credentials, documents, otps } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { accessibleOrgs } from "@/lib/access";
import { ENTITIES, type Kind } from "@/lib/entities";
import { Empty, PageHead } from "@/components/server";

export const metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const q = String((await searchParams).q ?? "").trim().slice(0, 100);
  const orgs = await accessibleOrgs(user);
  const ids = orgs.map((o) => o.id);
  const orgName = new Map(orgs.map((o) => [o.id, o.name]));
  type Hit = { kind: Kind; id: string; orgId: string; name: string; extra: string | null };
  let hits: Hit[] = [];
  if (q.length >= 2 && ids.length) {
    const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
    const any = (...cols: Parameters<typeof ilike>[0][]) => or(...cols.map((c) => ilike(c, like))) as SQL;
    const [a, c, s, d, o] = await Promise.all([
      db.select({ id: assets.id, orgId: assets.orgId, name: assets.name, extra: assets.hostname }).from(assets)
        .where(and(inArray(assets.orgId, ids), any(assets.name, assets.hostname, assets.ipAddress, assets.serialNumber, assets.os, assets.notes))).limit(50),
      db.select({ id: credentials.id, orgId: credentials.orgId, name: credentials.name, extra: credentials.username }).from(credentials)
        .where(and(inArray(credentials.orgId, ids), any(credentials.name, credentials.username, credentials.url, credentials.notes))).limit(50),
      db.select({ id: certificates.id, orgId: certificates.orgId, name: certificates.name, extra: certificates.host }).from(certificates)
        .where(and(inArray(certificates.orgId, ids), any(certificates.name, certificates.host, certificates.subject, certificates.sans, certificates.issuer))).limit(50),
      db.select({ id: documents.id, orgId: documents.orgId, name: documents.name, extra: sql<string | null>`null` }).from(documents)
        .where(and(inArray(documents.orgId, ids), any(documents.name, documents.content))).limit(50),
      db.select({ id: otps.id, orgId: otps.orgId, name: otps.name, extra: otps.account }).from(otps)
        .where(and(inArray(otps.orgId, ids), any(otps.name, otps.issuer, otps.account, otps.notes))).limit(50),
    ]);
    const tag = (rows: Omit<Hit, "kind">[], kind: Kind) => rows.map((r) => ({ ...r, kind }));
    hits = [...tag(a, "assets"), ...tag(c, "credentials"), ...tag(s, "certificates"), ...tag(d, "documents"), ...tag(o, "otp")];
  }
  const matchedOrgs = q.length >= 2 ? orgs.filter((o) => o.name.toLowerCase().includes(q.toLowerCase())) : [];
  return (
    <div className="stack">
      <PageHead title={q ? `Results for "${q}"` : "Search"} />
      {q.length < 2 ? <p className="muted">Type at least two characters in the search box above. Secrets are never searched.</p> : null}
      {matchedOrgs.length ? (
        <section className="card"><div className="card-head"><h2>Organizations</h2></div>
          <table><tbody>{matchedOrgs.map((o) => <tr key={o.id}><td className="primary"><Link href={`/orgs/${o.id}`}>{o.name}</Link></td></tr>)}</tbody></table>
        </section>
      ) : null}
      {q.length >= 2 ? (
        <section className="card">
          {hits.length ? (
            <div className="table-wrap"><table>
              <thead><tr><th>Name</th><th>Type</th><th>Detail</th><th>Organization</th></tr></thead>
              <tbody>{hits.map((h) => (
                <tr key={`${h.kind}-${h.id}`}>
                  <td className="primary"><Link href={`/orgs/${h.orgId}/${h.kind}/${h.id}`}>{h.name}</Link></td>
                  <td><span className="badge">{ENTITIES[h.kind].singular}</span></td>
                  <td className="mono">{h.extra ?? ""}</td>
                  <td><Link href={`/orgs/${h.orgId}`}>{orgName.get(h.orgId)}</Link></td>
                </tr>
              ))}</tbody>
            </table></div>
          ) : !matchedOrgs.length ? <Empty title="No matches" /> : null}
        </section>
      ) : null}
    </div>
  );
}
