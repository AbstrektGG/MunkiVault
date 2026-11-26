import { asc } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createUserAction, updateUserAction } from "@/app/actions";
import { requireAdmin } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { ActionForm, Submit } from "@/components/ui";
import { PageHead } from "@/components/server";

export const metadata = { title: "Users" };

export default async function UsersPage() {
  const admin = await requireAdmin();
  const all = await db.select().from(users).orderBy(asc(users.name));
  return (
    <div className="stack">
      <PageHead title="Users" />
      <section className="card">
        <div className="table-wrap"><table>
          <thead><tr><th>User</th><th>Sign-in</th><th>Last sign-in</th><th>Role, status and password</th></tr></thead>
          <tbody>
            {all.map((u) => (
              <tr key={u.id}>
                <td className="primary">{u.name}{u.id === admin.id ? <span className="muted small"> (you)</span> : null}<div className="muted small">{u.email}</div></td>
                <td>{[u.passwordHash ? "Password" : null, u.ssoSubject ? "SSO" : null].filter(Boolean).join(" + ") || "SSO (not yet linked)"}</td>
                <td className="muted small nowrap">{fmtDateTime(u.lastLoginAt) || "Never"}</td>
                <td>
                  <ActionForm action={updateUserAction.bind(null, u.id)}>
                    <div className="row">
                      <select name="role" defaultValue={u.role} aria-label={`Role for ${u.name}`} style={{ width: 150 }}>
                        <option value="member">Member</option><option value="admin">Administrator</option>
                      </select>
                      <input name="password" type="password" autoComplete="new-password" placeholder="New password" aria-label={`New password for ${u.name}`} style={{ width: 170 }} />
                      <label className="check"><input type="checkbox" name="disabled" defaultChecked={u.disabled} />Disabled</label>
                      {u.passwordHash ? <label className="check" title="Removes the local password so the account can only sign in with SSO"><input type="checkbox" name="ssoOnly" />SSO only</label> : null}
                      <Submit className="btn btn-sm">Save</Submit>
                    </div>
                  </ActionForm>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </section>
      <section className="card card-body" style={{ maxWidth: 720 }}>
        <h2 style={{ marginBottom: 12 }}>Add a user</h2>
        <ActionForm action={createUserAction} resetOnOk>
          <div className="form-grid">
            <div><label htmlFor="name">Full name</label><input id="name" name="name" type="text" required /></div>
            <div><label htmlFor="email">Email</label><input id="email" name="email" type="email" required autoComplete="off" /></div>
            <div>
              <label htmlFor="password">Password</label>
              <input id="password" name="password" type="password" autoComplete="new-password" minLength={12} />
              <div className="help">Leave empty for an account that signs in with SSO only.</div>
            </div>
            <div>
              <label htmlFor="role">Role</label>
              <select id="role" name="role" defaultValue="member"><option value="member">Member</option><option value="admin">Administrator</option></select>
              <div className="help">Members only see organizations they are granted.</div>
            </div>
          </div>
          <div className="form-foot"><Submit>Add user</Submit></div>
        </ActionForm>
      </section>
    </div>
  );
}
