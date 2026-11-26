import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { orgAccess, users } from "@/db/schema";
import { setAccessAction } from "@/app/actions";
import { requireOrg } from "@/lib/access";
import { LEVELS, LEVEL_HELP } from "@/lib/entities";
import { ActionForm, Submit } from "@/components/ui";

export default async function AccessPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  await requireOrg(orgId, "manager");
  const [all, grants] = await Promise.all([
    db.select().from(users).where(eq(users.disabled, false)).orderBy(asc(users.name)),
    db.select().from(orgAccess).where(eq(orgAccess.orgId, orgId)),
  ]);
  const levelOf = new Map(grants.map((g) => [g.userId, g.level]));
  const admins = all.filter((u) => u.role === "admin");
  const members = all.filter((u) => u.role !== "admin");
  const action = setAccessAction.bind(null, orgId);
  return (
    <div className="stack">
      <section className="card card-body">
        <h2 style={{ marginBottom: 8 }}>Access levels</h2>
        <dl className="fields" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
          {LEVELS.map((l) => <div key={l}><dt>{l}</dt><dd>{LEVEL_HELP[l]}</dd></div>)}
        </dl>
      </section>
      <section className="card">
        <div className="card-head"><h2>People</h2></div>
        <div className="table-wrap"><table>
          <thead><tr><th>Name</th><th>Email</th><th>Access to this organization</th></tr></thead>
          <tbody>
            {admins.map((u) => (
              <tr key={u.id}><td className="primary">{u.name}</td><td>{u.email}</td><td><span className="badge badge-accent">Administrator</span> <span className="muted small">Full access to every organization</span></td></tr>
            ))}
            {members.map((u) => (
              <tr key={u.id}>
                <td className="primary">{u.name}</td><td>{u.email}</td>
                <td>
                  <ActionForm action={action}>
                    <div className="row">
                      <input type="hidden" name="userId" value={u.id} />
                      <select name="level" defaultValue={levelOf.get(u.id) ?? "none"} aria-label={`Access for ${u.name}`} style={{ width: 160 }}>
                        <option value="none">No access</option>
                        {LEVELS.map((l) => <option key={l} value={l}>{l[0].toUpperCase() + l.slice(1)}</option>)}
                      </select>
                      <Submit className="btn btn-sm">Save</Submit>
                    </div>
                  </ActionForm>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
        {!members.length ? <div className="card-body muted">There are no non-administrator users yet. Add users under Administration, or let them sign in with single sign-on.</div> : null}
      </section>
    </div>
  );
}
