import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { accessibleOrgs } from "@/lib/access";
import { upcomingExpirations } from "@/lib/expirations";
import { Empty, ExpiryBadge, PageHead, fmtDate } from "@/components/server";

export const metadata = { title: "Expirations" };
const WINDOWS = [30, 60, 90, 365];

export default async function ExpirationsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const user = await requireUser();
  const requested = Number((await searchParams).days);
  const days = WINDOWS.includes(requested) ? requested : 90;
  const rows = await upcomingExpirations(await accessibleOrgs(user), days);
  return (
    <div className="stack">
      <PageHead title="Expirations">
        {WINDOWS.map((w) => <Link key={w} href={`/expirations?days=${w}`} className={`btn btn-sm ${w === days ? "btn-primary" : ""}`}>{w === 365 ? "1 year" : `${w} days`}</Link>)}
      </PageHead>
      <p className="muted">Certificates, passwords and warranties that have expired or will expire within {days} days, across every organization you can access.</p>
      <section className="card">
        {rows.length ? (
          <div className="table-wrap"><table>
            <thead><tr><th>Item</th><th>Type</th><th>Organization</th><th>Date</th><th>Status</th></tr></thead>
            <tbody>{rows.map((e) => (
              <tr key={`${e.kind}-${e.id}`}>
                <td className="primary"><Link href={`/orgs/${e.orgId}/${e.kind}/${e.id}`}>{e.name}</Link></td>
                <td>{e.what}</td><td><Link href={`/orgs/${e.orgId}`}>{e.orgName}</Link></td>
                <td className="nowrap">{fmtDate(e.date)}</td><td><ExpiryBadge date={e.date} /></td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <Empty title={`Nothing expires in the next ${days} days`} />}
      </section>
    </div>
  );
}
