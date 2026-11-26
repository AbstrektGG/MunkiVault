import Link from "next/link";
import { can, requireOrg } from "@/lib/access";
import { upcomingExpirations } from "@/lib/expirations";
import { FolderContents } from "@/components/FolderContents";
import { ExpiryBadge, fmtDate } from "@/components/server";

export default async function OrgOverview({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const { org, level } = await requireOrg(orgId);
  const expiring = await upcomingExpirations([org], 90);
  return (
    <div className="stack">
      {org.description ? <p className="muted">{org.description}</p> : null}
      <FolderContents orgId={orgId} folderId={null} canEdit={can(level, "editor")} />
      {expiring.length ? (
        <section className="card">
          <div className="card-head"><h2>Expiring within 90 days</h2></div>
          <div className="table-wrap"><table>
            <thead><tr><th>Item</th><th>Type</th><th>Date</th><th>Status</th></tr></thead>
            <tbody>{expiring.map((e) => (
              <tr key={`${e.kind}-${e.id}`}>
                <td className="primary"><Link href={`/orgs/${orgId}/${e.kind}/${e.id}`}>{e.name}</Link></td>
                <td>{e.what}</td><td className="nowrap">{fmtDate(e.date)}</td><td><ExpiryBadge date={e.date} /></td>
              </tr>
            ))}</tbody>
          </table></div>
        </section>
      ) : null}
    </div>
  );
}
