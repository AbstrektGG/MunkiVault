import { redirect } from "next/navigation";
import { setupAction } from "@/app/actions";
import { hasAnyUser } from "@/lib/auth";
import { masterKeyConfigured } from "@/lib/crypto";
import { Brand } from "@/components/Brand";
import { ActionForm, Submit } from "@/components/ui";

export const metadata = { title: "Set up" };
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (await hasAnyUser()) redirect("/login");
  return (
    <main className="auth">
      <div className="card auth-card">
        <Brand href="/setup" />
        <h1>Create the first administrator</h1>
        <p className="muted" style={{ margin: "6px 0 16px" }}>This account manages users, organizations and access. Keep it as a break-glass account even after enabling single sign-on.</p>
        {!masterKeyConfigured() ? (
          <div className="alert alert-error" style={{ marginBottom: 14 }}>
            MUNKIVAULT_MASTER_KEY is missing or invalid. Secrets cannot be stored until it is set to 32 random bytes, base64 encoded.
          </div>
        ) : null}
        <ActionForm action={setupAction} className="stack">
          <div><label htmlFor="name">Full name</label><input id="name" name="name" type="text" required autoFocus /></div>
          <div><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="username" required /></div>
          <div>
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete="new-password" minLength={12} required />
            <div className="help">At least 12 characters.</div>
          </div>
          <Submit className="btn btn-primary btn-block">Create account</Submit>
        </ActionForm>
      </div>
    </main>
  );
}
