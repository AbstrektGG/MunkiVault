import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { beginSso, ssoSettings } from "@/lib/oidc";
import { secureCookies } from "@/lib/auth";

export const dynamic = "force-dynamic";

const base = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

export async function GET() {
  const settings = ssoSettings();
  if (!settings) return NextResponse.redirect(`${base()}/login?error=${encodeURIComponent("Single sign-on is not configured.")}`);
  try {
    const { url, flow } = await beginSso(settings);
    (await cookies()).set("mv_sso", JSON.stringify(flow), {
      httpOnly: true, sameSite: "lax", secure: secureCookies(), path: "/api/auth/sso", maxAge: 600,
    });
    return NextResponse.redirect(url);
  } catch (err) {
    console.error("SSO start failed", err);
    return NextResponse.redirect(`${base()}/login?error=${encodeURIComponent("Could not reach the identity provider.")}`);
  }
}
