import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { accessibleOrgs } from "@/lib/access";
import { countEntries } from "@/lib/store";
import { Empty, PageHead } from "@/components/server";

export const metadata = { title: "Organizations" };

export default async function OrgsPage() {
  const user = await requireUser();
  const orgs = await accessibleOrgs(user);
  const counts = await Promise.all(orgs.map((o) => countEntries(o.id)));
  const groups = [["internal", "Internal infrastructure"], ["customer", "Customers"]] as const;
  return (
    <div className="stack">
      <PageHead title="Organizations">
        {user.role === "admin" ? <Link href="/orgs/new" className="btn btn-primary"><Plus size={15} />New organization</Link> : null}
      </PageHead>
      {!orgs.length ? <div className="card"><Empty title="No organizations to show" /></div> : null}
      {groups.map(([kind, title]) => {
        const rows = orgs.map((o, i) => ({ org: o, count: counts[i] })).filter((r) => r.org.kind === kind);
        if (!rows.length) return null;
        return (
          <section className="card" key={kind}>
            <div className="card-head"><h2>{title}</h2><span className="muted small">{rows.length}</span></div>
            <div className="table-wrap"><table>
              <thead><tr><th>Name</th><th>Systems</th><th>Credentials</th><th>Certificates</th><th>Documents</th></tr></thead>
              <tbody>
                {rows.map(({ org, count }) => (
                  <tr key={org.id}>
                    <td className="primary"><Link href={`/orgs/${org.id}`}>{org.name}</Link>{org.description ? <div className="muted small">{org.description}</div> : null}</td>
                    <td>{count.assets}</td><td>{count.credentials}</td><td>{count.certificates}</td><td>{count.documents}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </section>
        );
      })}
    </div>
  );
}
