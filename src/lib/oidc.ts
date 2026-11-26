import "server-only";
import * as oidc from "openid-client";

export type SsoSettings = { issuer: string; clientId: string; name: string; redirectUri: string; allowedDomains: string[]; autoProvision: boolean };

export function ssoSettings(): SsoSettings | null {
  const issuer = process.env.OIDC_ISSUER?.trim();
  const clientId = process.env.OIDC_CLIENT_ID?.trim();
  if (!issuer || !clientId) return null;
  return {
    issuer, clientId,
    name: process.env.OIDC_NAME?.trim() || "Single sign-on",
    redirectUri: `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}/api/auth/sso/callback`,
    allowedDomains: (process.env.OIDC_ALLOWED_DOMAINS ?? "").split(",").map((d) => d.trim().toLowerCase()).filter(Boolean),
    autoProvision: process.env.OIDC_AUTO_PROVISION !== "false",
  };
}

let cached: { key: string; config: oidc.Configuration } | undefined;

async function configuration(settings: SsoSettings): Promise<oidc.Configuration> {
  const secret = process.env.OIDC_CLIENT_SECRET?.trim();
  const key = `${settings.issuer}|${settings.clientId}`;
  if (cached?.key === key) return cached.config;
  const issuerUrl = new URL(settings.issuer);
  const config = await oidc.discovery(
    issuerUrl, settings.clientId, secret || undefined, secret ? undefined : oidc.None(),
    // Plain http issuers are only accepted for local development providers.
    issuerUrl.protocol === "http:" ? { execute: [oidc.allowInsecureRequests] } : undefined,
  );
  cached = { key, config };
  return config;
}

export type SsoFlow = { state: string; nonce: string; verifier: string };

export async function beginSso(settings: SsoSettings): Promise<{ url: string; flow: SsoFlow }> {
  const config = await configuration(settings);
  const flow = { state: oidc.randomState(), nonce: oidc.randomNonce(), verifier: oidc.randomPKCECodeVerifier() };
  const url = oidc.buildAuthorizationUrl(config, {
    redirect_uri: settings.redirectUri,
    scope: "openid email profile",
    state: flow.state,
    nonce: flow.nonce,
    code_challenge: await oidc.calculatePKCECodeChallenge(flow.verifier),
    code_challenge_method: "S256",
  });
  return { url: url.href, flow };
}

export type SsoIdentity = { subject: string; email: string; name: string };

export async function completeSso(settings: SsoSettings, search: string, flow: SsoFlow): Promise<SsoIdentity> {
  const config = await configuration(settings);
  const tokens = await oidc.authorizationCodeGrant(config, new URL(settings.redirectUri + search), {
    pkceCodeVerifier: flow.verifier, expectedState: flow.state, expectedNonce: flow.nonce,
  });
  const claims = tokens.claims();
  if (!claims) throw new Error("The identity provider did not return an ID token.");
  if (claims.email_verified === false) throw new Error("Your email address is not verified with the identity provider.");
  // Entra ID puts the sign-in address in preferred_username when no email claim is configured.
  const email = String(claims.email ?? claims.preferred_username ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+$/.test(email)) throw new Error("The identity provider did not supply an email address.");
  const domain = email.split("@")[1];
  if (settings.allowedDomains.length && !settings.allowedDomains.includes(domain)) {
    throw new Error("Your email domain is not allowed to sign in.");
  }
  return { subject: `${claims.iss}|${claims.sub}`, email, name: String(claims.name ?? email.split("@")[0]) };
}
