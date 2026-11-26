import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { assets, certificates, credentials, documents, revisions, users } from "@/db/schema";
import { encryptSecret, parseTotpSeed } from "./crypto";
import { ENTITIES, type FieldDef, type Kind } from "./entities";
import { isUuid } from "./access";

// The four entry tables share the columns in `entry()`; everything else is driven by ENTITIES.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TABLES: Record<Kind, any> = { assets, credentials, certificates, documents };

export type Entry = { id: string; orgId: string; name: string; version: number; createdAt: Date; updatedAt: Date; updatedBy: string | null } & Record<string, unknown>;
export type Values = Record<string, string | number | null>;

export async function listEntries(kind: Kind, orgId: string): Promise<Entry[]> {
  const t = TABLES[kind];
  return (await db.select().from(t).where(eq(t.orgId, orgId)).orderBy(asc(t.name))) as Entry[];
}

export async function getEntry(kind: Kind, orgId: string, id: string): Promise<Entry | null> {
  if (!isUuid(id)) return null;
  const t = TABLES[kind];
  const [row] = await db.select().from(t).where(and(eq(t.id, id), eq(t.orgId, orgId))).limit(1);
  return (row as Entry | undefined) ?? null;
}

export function snapshotOf(kind: Kind, row: Record<string, unknown>): Values {
  const out: Values = {};
  for (const f of ENTITIES[kind].fields) out[f.name] = (row[f.name] as string | number | null) ?? null;
  return out;
}

const MAX = { text: 500, textarea: 20_000, markdown: 500_000, secret: 10_000 };

async function parseField(f: FieldDef, raw: string, orgId: string): Promise<string | number | null> {
  // Browsers submit textarea line breaks as CRLF; store LF so unchanged text never looks edited.
  const text = f.kind === "secret" ? raw : raw.replace(/\r\n?/g, "\n");
  const value = f.kind === "markdown" || f.kind === "secret" ? text : text.trim();
  if (value === "") return null;
  switch (f.kind) {
    case "number": {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 0 || n > 65535) throw new Error(`${f.label} must be a number between 0 and 65535.`);
      return n;
    }
    case "date":
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) throw new Error(`${f.label} is not a valid date.`);
      return value;
    case "select":
      if (!f.options?.some(([v]) => v === value)) throw new Error(`${f.label} has an unknown value.`);
      return value;
    case "asset": {
      const [row] = isUuid(value)
        ? await db.select({ id: assets.id }).from(assets).where(and(eq(assets.id, value), eq(assets.orgId, orgId))).limit(1)
        : [];
      if (!row) throw new Error("The linked system does not exist in this organization.");
      return value;
    }
    case "secret":
      if (value.length > MAX.secret) throw new Error(`${f.label} is too long.`);
      return encryptSecret(f.name === "totp" ? parseTotpSeed(value) : value);
    default:
      if (value.length > MAX[f.kind]) throw new Error(`${f.label} is too long.`);
      return value;
  }
}

// Parses submitted form data into column values. For secrets, an empty value keeps what is stored
// unless the matching "clear_<name>" box is ticked.
export async function parseForm(kind: Kind, orgId: string, form: FormData, existing: Entry | null): Promise<Values> {
  const out: Values = {};
  for (const f of ENTITIES[kind].fields) {
    const raw = String(form.get(f.name) ?? "");
    let value = await parseField(f, raw, orgId);
    if (f.kind === "secret" && value === null) {
      value = form.get(`clear_${f.name}`) ? null : ((existing?.[f.name] as string | null) ?? null);
    }
    if (f.required && value === null) throw new Error(`${f.label} is required.`);
    out[f.name] = value;
  }
  if (kind === "assets") {
    if (out.credentialSource === "user" && !out.userVaultKey) throw new Error("Enter the credential name each user keeps in their personal vault.");
    if (out.credentialSource !== "user") out.userVaultKey = null;
  }
  return out;
}

type Action = "create" | "update" | "restore" | "delete";

async function writeRevision(tx: Pick<typeof db, "insert">, kind: Kind, orgId: string, entityId: string, version: number, action: Action, snapshot: Values, userId: string) {
  await tx.insert(revisions).values({ orgId, entityType: kind, entityId, version, action, snapshot, userId });
}

export async function createEntry(kind: Kind, orgId: string, values: Values, userId: string, folderId: string | null = null): Promise<string> {
  const t = TABLES[kind];
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(t).values({ ...values, orgId, folderId, updatedBy: userId }).returning({ id: t.id });
    await writeRevision(tx, kind, orgId, row.id, 1, "create", values, userId);
    return row.id as string;
  });
}

export async function updateEntry(kind: Kind, existing: Entry, values: Values, userId: string, action: Action = "update"): Promise<boolean> {
  const before = snapshotOf(kind, existing);
  if (Object.keys(values).every((k) => before[k] === values[k])) return false;
  const t = TABLES[kind];
  const version = existing.version + 1;
  await db.transaction(async (tx) => {
    await tx.update(t).set({ ...values, version, updatedAt: new Date(), updatedBy: userId }).where(eq(t.id, existing.id));
    await writeRevision(tx, kind, existing.orgId, existing.id, version, action, values, userId);
  });
  return true;
}

export async function deleteEntry(kind: Kind, existing: Entry, userId: string) {
  const t = TABLES[kind];
  await db.transaction(async (tx) => {
    await writeRevision(tx, kind, existing.orgId, existing.id, existing.version + 1, "delete", snapshotOf(kind, existing), userId);
    await tx.delete(t).where(eq(t.id, existing.id));
  });
}

export async function listRevisions(kind: Kind, orgId: string, entityId: string) {
  return db.select({
    id: revisions.id, version: revisions.version, action: revisions.action, snapshot: revisions.snapshot,
    createdAt: revisions.createdAt, userName: users.name,
  }).from(revisions).leftJoin(users, eq(users.id, revisions.userId))
    .where(and(eq(revisions.entityType, kind), eq(revisions.entityId, entityId), eq(revisions.orgId, orgId)))
    .orderBy(desc(revisions.version));
}

export async function restoreRevision(kind: Kind, existing: Entry, version: number, userId: string): Promise<boolean> {
  const [rev] = await db.select().from(revisions).where(and(
    eq(revisions.entityType, kind), eq(revisions.entityId, existing.id), eq(revisions.version, version))).limit(1);
  if (!rev) throw new Error("That version no longer exists.");
  const values: Values = {};
  for (const f of ENTITIES[kind].fields) values[f.name] = (rev.snapshot[f.name] as string | number | null) ?? null;
  // A linked system may have been deleted since the snapshot was taken.
  if (values.assetId) {
    const [a] = await db.select({ id: assets.id }).from(assets)
      .where(and(eq(assets.id, String(values.assetId)), eq(assets.orgId, existing.orgId))).limit(1);
    if (!a) values.assetId = null;
  }
  return updateEntry(kind, existing, values, userId, "restore");
}

export async function countEntries(orgId: string): Promise<Record<Kind, number>> {
  const counts = await Promise.all((Object.keys(TABLES) as Kind[]).map(async (kind) => {
    const t = TABLES[kind];
    return [kind, await db.$count(t, eq(t.orgId, orgId))] as const;
  }));
  return Object.fromEntries(counts) as Record<Kind, number>;
}

export async function linkedEntries(kind: "credentials" | "certificates", orgId: string, assetId: string): Promise<Entry[]> {
  const t = TABLES[kind];
  return (await db.select().from(t).where(and(eq(t.orgId, orgId), eq(t.assetId, assetId))).orderBy(asc(t.name))) as Entry[];
}
