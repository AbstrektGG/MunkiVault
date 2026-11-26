import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { randomToken, sha256 } from "./crypto";

const COOKIE = "mv_session";

export type User = typeof users.$inferSelect;

const sessionHours = () => Math.max(1, Number(process.env.SESSION_HOURS ?? 12) || 12);
export const secureCookies = () => (process.env.APP_URL ?? "").startsWith("https://");

export async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}

export async function createSession(userId: string) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + sessionHours() * 3600_000);
  await db.insert(sessions).values({ id: sha256(token), userId, expiresAt });
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: secureCookies(), path: "/", expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, sha256(token)));
  jar.delete(COOKIE);
}

export async function destroyUserSessions(userId: string) {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export const currentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const rows = await db.select({ user: users }).from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sha256(token)), gt(sessions.expiresAt, new Date()), eq(users.disabled, false)))
    .limit(1);
  return rows[0]?.user ?? null;
});

export async function hasAnyUser(): Promise<boolean> {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(users);
  return row.n > 0;
}

export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (user) return user;
  redirect((await hasAnyUser()) ? "/login" : "/setup");
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return user;
}

// ---- Login throttling (in memory, per process) ----

const failures = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 15 * 60_000;
const MAX_FAILURES = 8;

export function loginBlocked(key: string): boolean {
  const entry = failures.get(key);
  if (!entry) return false;
  if (Date.now() - entry.first > WINDOW_MS) { failures.delete(key); return false; }
  return entry.count >= MAX_FAILURES;
}

export function recordLoginFailure(key: string) {
  const entry = failures.get(key);
  if (!entry || Date.now() - entry.first > WINDOW_MS) failures.set(key, { count: 1, first: Date.now() });
  else entry.count += 1;
}

export const clearLoginFailures = (key: string) => failures.delete(key);

export function passwordProblem(password: string): string | null {
  if (password.length < 12) return "Use at least 12 characters.";
  if (password.length > 256) return "Password is too long.";
  return null;
}
