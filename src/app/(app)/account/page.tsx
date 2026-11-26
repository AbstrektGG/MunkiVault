import { changePasswordAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { ActionForm, Submit } from "@/components/ui";
import { PageHead } from "@/components/server";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <div className="stack" style={{ maxWidth: 520 }}>
      <PageHead title="Account" />
      <section className="card card-body">
        <dl className="fields">
          <div><dt>Name</dt><dd>{user.name}</dd></div>
          <div><dt>Email</dt><dd>{user.email}</dd></div>
          <div><dt>Role</dt><dd>{user.role === "admin" ? "Administrator" : "Member"}</dd></div>
          <div><dt>Sign-in</dt><dd>{[user.passwordHash ? "Local password" : null, user.ssoSubject ? "Single sign-on" : null].filter(Boolean).join(", ") || "Single sign-on (not yet linked)"}</dd></div>
        </dl>
      </section>
      {user.passwordHash ? (
        <section className="card card-body">
          <h2 style={{ marginBottom: 12 }}>Change password</h2>
          <ActionForm action={changePasswordAction} className="stack">
            <div><label htmlFor="current">Current password</label><input id="current" name="current" type="password" autoComplete="current-password" required /></div>
            <div><label htmlFor="next">New password</label><input id="next" name="next" type="password" autoComplete="new-password" minLength={12} required /></div>
            <div><label htmlFor="confirm">Confirm new password</label><input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={12} required /></div>
            <div><Submit>Update password</Submit></div>
          </ActionForm>
        </section>
      ) : null}
    </div>
  );
}
