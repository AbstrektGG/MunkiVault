import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { completeSso, ssoSettings, type SsoFlow } from "@/lib/oidc";
import { createSession, hasAnyUser } from "@/lib/auth";
import { audit } from "@/lib/access";

export const dynamic = "force-dynamic";

const base = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const fail = (text: string) => NextResponse.redirect(`${base()}/login?error=${encodeURIComponent(text)}`);

export async function GET(request: NextRequest) {
  const settings = ssoSettings();
  if (!settings) return fail("Single sign-on is not configured.");
  const jar = await cookies();
  const raw = jar.get("mv_sso")?.value;
  jar.delete({ name: "mv_sso", path: "/api/auth/sso" });
  if (!raw) return fail("Your sign-in attempt expired. Try again.");

  let identity;
  try {
    identity = await completeSso(settings, request.nextUrl.search, JSON.parse(raw) as SsoFlow);
  } catch (err) {
    console.error("SSO callback failed", err);
    const text = err instanceof Error && /email|domain/.test(err.message) ? err.message : "Sign-in with the identity provider failed.";
    return fail(text);
  }

  if (!(await hasAnyUser())) return fail("Finish first-time setup before using single sign-on.");

  let [user] = await db.select().from(users).where(eq(users.ssoSubject, identity.subject)).limit(1);
  if (!user) {
    const [byEmail] = await db.select().from(users).where(eq(users.email, identity.email)).limit(1);
    if (byEmail && !byEmail.ssoSubject && !byEmail.passwordHash) {
      // First SSO sign-in for a passwordless account an administrator created: link it to this
      // identity. Accounts with a local password are never linked by email alone, so an identity
      // provider that lets people choose their email claim cannot take over a local account.
      [user] = await db.update(users).set({ ssoSubject: identity.subject }).where(eq(users.id, byEmail.id)).returning();
    } else if (byEmail) {
      return fail("This email belongs to an account that is not enabled for single sign-on. Ask an administrator for help.");
    } else if (settings.autoProvision) {
      [user] = await db.insert(users).values({ email: identity.email, name: identity.name, ssoSubject: identity.subject, role: "member" }).returning();
      await audit(user, "user.provisioned", { detail: "Created on first single sign-on" });
    } else {
      return fail("You do not have a MunkiVault account. Ask an administrator to add you.");
    }
  }
  if (user.disabled) {
    await audit(user, "login.failed", { detail: "Account disabled" });
    return fail("Your account is disabled.");
  }
  await createSession(user.id);
  await audit(user, "login", { detail: "Single sign-on" });
  return NextResponse.redirect(`${base()}/`);
}
