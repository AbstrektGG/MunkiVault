import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { assetCredentials, assets, credentials } from "@/db/schema";
import type { User } from "./auth";
import type { Entry } from "./store";

import { ensurePersonalVault } from "./vault";
import type { Kind } from "./entities";

export type Credential = typeof credentials.$inferSelect;
export type Resolution = {
  credential: Credential | null;
  // direct: the entry is itself a credential. linked: the device's default linked credential.
  // user: the signed-in user's own credential from their personal vault.
  source: "direct" | "linked" | "user" | "none";
  problem?: string;
};

export async function linkedCredentials(assetId: string): Promise<Credential[]> {
  const rows = await db.select({ c: credentials }).from(assetCredentials)
    .innerJoin(credentials, eq(credentials.id, assetCredentials.credentialId))
    .where(eq(assetCredentials.assetId, assetId)).orderBy(asc(assetCredentials.position), asc(credentials.name));
  return rows.map((r) => r.c);
}

export async function devicesUsing(credentialId: string) {
  return db.select({ id: assets.id, name: assets.name, type: assets.type, hostname: assets.hostname }).from(assetCredentials)
    .innerJoin(assets, eq(assets.id, assetCredentials.assetId))
    .where(eq(assetCredentials.credentialId, credentialId)).orderBy(asc(assets.name));
}

// Replaces a device's linked credentials. Every id must be a credential in the same vault.
export async function setLinkedCredentials(asset: { id: string; orgId: string }, ids: string[]): Promise<boolean> {
  const unique = [...new Set(ids)];
  if (unique.length) {
    const found = await db.select({ id: credentials.id }).from(credentials)
      .where(and(eq(credentials.orgId, asset.orgId), inArray(credentials.id, unique)));
    if (found.length !== unique.length) throw new Error("A selected credential does not exist in this organization.");
  }
  const before = (await linkedCredentials(asset.id)).map((c) => c.id);
  if (before.length === unique.length && before.every((id, i) => id === unique[i])) return false;
  await db.transaction(async (tx) => {
    await tx.delete(assetCredentials).where(eq(assetCredentials.assetId, asset.id));
    if (unique.length) await tx.insert(assetCredentials).values(unique.map((credentialId, position) => ({ assetId: asset.id, credentialId, position })));
  });
  return true;
}

export async function appendLink(assetId: string, credentialId: string) {
  const [row] = await db.select({ n: sql<number>`coalesce(max(${assetCredentials.position}) + 1, 0)::int` }).from(assetCredentials).where(eq(assetCredentials.assetId, assetId));
  await db.insert(assetCredentials).values({ assetId, credentialId, position: row.n }).onConflictDoNothing();
}

export async function findInPersonalVault(user: Pick<User, "id" | "name">, name: string): Promise<Credential | null> {
  const vault = await ensurePersonalVault(user);
  const [row] = await db.select().from(credentials)
    .where(and(eq(credentials.orgId, vault.id), sql`lower(${credentials.name}) = lower(${name.trim()})`))
    .orderBy(asc(credentials.createdAt)).limit(1);
  return row ?? null;
}

export async function resolveCredential(user: Pick<User, "id" | "name">, kind: Kind, entry: Entry): Promise<Resolution> {
  if (kind === "credentials") return { credential: entry as unknown as Credential, source: "direct" };
  // An OTP entry is its own authenticator: its account stands in for a username.
  if (kind === "otp") return { credential: { ...(entry as unknown as Credential), username: (entry.account as string | null) ?? null, password: null }, source: "direct" };
  if (kind !== "assets") return { credential: null, source: "none" };
  const mode = String(entry.credentialSource ?? "none");
  if (mode === "linked") {
    const [first] = await linkedCredentials(entry.id);
    return first ? { credential: first, source: "linked" } : { credential: null, source: "linked", problem: "No credential is linked to this device." };
  }
  if (mode === "user") {
    const key = String(entry.userVaultKey ?? "").trim();
    if (!key) return { credential: null, source: "user", problem: "This device has no personal vault credential name set." };
    const found = await findInPersonalVault(user, key);
    return found ? { credential: found, source: "user" } : { credential: null, source: "user", problem: `Your personal vault has no credential named "${key}".` };
  }
  return { credential: null, source: "none", problem: "No credential is set for this device." };
}

