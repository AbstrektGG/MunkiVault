import "server-only";
import { notFound } from "next/navigation";
import { and, eq, asc, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, orgAccess, organizations } from "@/db/schema";
import { clientIp, requireUser, type User } from "./auth";
import { LEVELS, type Level } from "./entities";

export type Org = typeof organizations.$inferSelect;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID.test(value);

export const can = (level: Level, min: Level) => LEVELS.indexOf(level) >= LEVELS.indexOf(min);

// A personal vault belongs to one user only; nobody else, administrators included, can open it.
export async function levelFor(user: User, org: Pick<Org, "id" | "ownerId">): Promise<Level | null> {
  if (org.ownerId) return org.ownerId === user.id ? "manager" : null;
  if (user.role === "admin") return "manager";
  const [row] = await db.select().from(orgAccess)
    .where(and(eq(orgAccess.userId, user.id), eq(orgAccess.orgId, org.id))).limit(1);
  return (row?.level as Level | undefined) ?? null;
}

// Every organization-scoped page and action goes through this. Responds 404 when the caller has no
// access so that organization ids cannot be probed.
export async function requireOrg(orgId: string, min: Level = "viewer") {
  const user = await requireUser();
  if (!isUuid(orgId)) notFound();
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
  if (!org) notFound();
  const level = await levelFor(user, org);
  if (!level) notFound();
  if (!can(level, min)) throw new Error("You do not have permission to do that in this organization.");
  return { user, org, level };
}

export async function accessibleOrgs(user: User): Promise<Org[]> {
  const own = eq(organizations.ownerId, user.id);
  if (user.role === "admin") {
    return db.select().from(organizations).where(or(isNull(organizations.ownerId), own)).orderBy(asc(organizations.name));
  }
  const rows = await db.select({ id: orgAccess.orgId }).from(orgAccess).where(eq(orgAccess.userId, user.id));
  const granted = rows.length ? and(isNull(organizations.ownerId), inArray(organizations.id, rows.map((r) => r.id))) : undefined;
  return db.select().from(organizations).where(granted ? or(granted, own) : own).orderBy(asc(organizations.name));
}

export const isPersonal = (org: Pick<Org, "ownerId">) => Boolean(org.ownerId);

export async function audit(user: Pick<User, "id" | "email"> | null, action: string, opts: {
  orgId?: string | null; entityType?: string; entityId?: string; detail?: string; actor?: string;
} = {}) {
  await db.insert(auditLog).values({
    userId: user?.id ?? null,
    actor: user?.email ?? opts.actor ?? null,
    orgId: opts.orgId ?? null,
    action,
    entityType: opts.entityType,
    entityId: opts.entityId,
    detail: opts.detail?.slice(0, 500),
    ip: await clientIp(),
  });
}

export async function levelsFor(user: User, orgs: Org[]): Promise<Record<string, Level>> {
  const grants = user.role === "admin" ? [] : await db.select().from(orgAccess).where(eq(orgAccess.userId, user.id));
  const granted = new Map(grants.map((g) => [g.orgId, g.level as Level]));
  const out: Record<string, Level> = {};
  for (const o of orgs) {
    const level = o.ownerId ? (o.ownerId === user.id ? "manager" : null) : user.role === "admin" ? "manager" : granted.get(o.id) ?? null;
    if (level) out[o.id] = level;
  }
  return out;
}
