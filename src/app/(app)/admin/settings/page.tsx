import { requireAdmin } from "@/lib/auth";
import { masterKeyConfigured } from "@/lib/crypto";
import { ssoSettings } from "@/lib/oidc";
import { CopyButton } from "@/components/ui";
import { PageHead } from "@/components/server";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireAdmin();
  const sso = ssoSettings();
  const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const redirectUri = `${appUrl}/api/auth/sso/callback`;
  const keyOk = masterKeyConfigured();
  return (
    <div className="stack" style={{ maxWidth: 820 }}>
      <PageHead title="Settings" />
      <p className="muted">These settings come from environment variables and are read when the server starts.</p>
      <section className="card card-body">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
          <h2>Single sign-on (OpenID Connect)</h2>
          <span className={`badge ${sso ? "badge-ok" : ""}`}>{sso ? "Enabled" : "Not configured"}</span>
        </div>
        <dl className="fields">
          <div className="wide"><dt>Redirect URI to register with your identity provider</dt><dd className="row"><span className="mono">{redirectUri}</span><CopyButton value={redirectUri} /></dd></div>
          {sso ? (
            <>
              <div className="wide"><dt>Issuer</dt><dd className="mono">{sso.issuer}</dd></div>
              <div><dt>Client ID</dt><dd className="mono">{sso.clientId}</dd></div>
              <div><dt>Button label</dt><dd>{sso.name}</dd></div>
              <div><dt>Allowed email domains</dt><dd>{sso.allowedDomains.join(", ") || "Any"}</dd></div>
              <div><dt>Create accounts on first sign-in</dt><dd>{sso.autoProvision ? "Yes, as members with no organization access" : "No"}</dd></div>
            </>
          ) : (
            <div className="wide"><dt>How to enable</dt><dd>Set OIDC_ISSUER, OIDC_CLIENT_ID and OIDC_CLIENT_SECRET, then restart. For Microsoft Entra ID the issuer is https://login.microsoftonline.com/TENANT_ID/v2.0. Any OpenID Connect provider works (Entra ID, Google Workspace, Okta, Keycloak, Authentik).</dd></div>
          )}
        </dl>
      </section>
      <section className="card card-body">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
          <h2>Secret encryption</h2>
          <span className={`badge ${keyOk ? "badge-ok" : "badge-expired"}`}>{keyOk ? "Key loaded" : "Key missing"}</span>
        </div>
        <p>Passwords and one-time password seeds are encrypted with AES-256-GCM using MUNKIVAULT_MASTER_KEY before they are written to the database. Back the key up separately from the database: without it, stored secrets cannot be recovered.</p>
      </section>
      <section className="card card-body">
        <h2 style={{ marginBottom: 12 }}>Sessions</h2>
        <dl className="fields">
          <div><dt>Session lifetime</dt><dd>{Number(process.env.SESSION_HOURS ?? 12) || 12} hours</dd></div>
          <div><dt>Secure cookies</dt><dd>{appUrl.startsWith("https://") ? "On" : "Off (APP_URL is not https)"}</dd></div>
        </dl>
      </section>
    </div>
  );
}
