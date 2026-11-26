import { redirect } from "next/navigation";
import { LogIn } from "lucide-react";
import { loginAction } from "@/app/actions";
import { currentUser, hasAnyUser } from "@/lib/auth";
import { ssoSettings } from "@/lib/oidc";
import { Brand } from "@/components/Brand";
import { ActionForm, Submit } from "@/components/ui";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await currentUser()) redirect("/");
  if (!(await hasAnyUser())) redirect("/setup");
  const { error } = await searchParams;
  const sso = ssoSettings();
  return (
    <main className="auth">
      <div className="card auth-card">
        <Brand href="/login" />
        <h1 style={{ marginBottom: 16 }}>Sign in</h1>
        {error ? <div className="alert alert-error" role="alert" style={{ marginBottom: 14 }}>{error.slice(0, 200)}</div> : null}
        {sso ? (
          <>
            {/* A plain link on purpose: this must be a full navigation to the identity provider. */}
            <a className="btn btn-primary btn-block" href="/api/auth/sso/start"><LogIn size={15} />Continue with {sso.name}</a>
            <div className="divider">or use a local account</div>
          </>
        ) : null}
        <ActionForm action={loginAction} className="stack">
          <div>
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="username" required autoFocus={!sso} />
          </div>
          <div>
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          <Submit className={`btn btn-block ${sso ? "" : "btn-primary"}`}>Sign in</Submit>
        </ActionForm>
      </div>
    </main>
  );
}
