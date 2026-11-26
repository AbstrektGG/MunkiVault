import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { assets, certificates, credentials, documents, folders } from "@/db/schema";
import { isUuid } from "./access";
import type { Kind } from "./entities";

export type Folder = typeof folders.$inferSelect;
export type FolderOption = { id: string; label: string };
export type TreeEntry = { kind: Kind; id: string; name: string; folderId: string | null; icon: string };
export type OrgTree = { folders: { id: string; parentId: string | null; name: string; icon: string }[]; entries: TreeEntry[] };

const ENTRY_TABLES = { assets, credentials, certificates, documents } as const;

export async function listFolders(orgId: string): Promise<Folder[]> {
  return db.select().from(folders).where(eq(folders.orgId, orgId)).orderBy(asc(folders.name));
}

export async function getFolder(orgId: string, id: string): Promise<Folder | null> {
  if (!isUuid(id)) return null;
  const [row] = await db.select().from(folders).where(and(eq(folders.id, id), eq(folders.orgId, orgId))).limit(1);
  return row ?? null;
}

// Root-first chain of folders from the top of the organization down to `id`.
export function pathTo(all: Folder[], id: string | null): Folder[] {
  const byId = new Map(all.map((f) => [f.id, f]));
  const out: Folder[] = [];
  const seen = new Set<string>();
  let cur = id ? byId.get(id) : undefined;
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    out.unshift(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return out;
}

export function descendantIds(all: Folder[], id: string): Set<string> {
  const out = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of all) if (f.parentId && out.has(f.parentId) && !out.has(f.id)) { out.add(f.id); grew = true; }
  }
  return out;
}

// Folder choices for a select, labelled with their full path and sorted in tree order.
export function folderOptions(all: Folder[], exclude?: Set<string>): FolderOption[] {
  return all
    .filter((f) => !exclude?.has(f.id))
    .map((f) => ({ id: f.id, label: pathTo(all, f.id).map((p) => p.name).join(" / ") }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
}

// Validates a submitted folder id: empty means the organization root.
export async function resolveFolder(orgId: string, raw: unknown): Promise<string | null> {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  const folder = await getFolder(orgId, value);
  if (!folder) throw new Error("The selected folder does not exist in this organization.");
  return folder.id;
}

export async function loadTree(orgId: string): Promise<OrgTree> {
  const [f, a, c, s, d] = await Promise.all([
    db.select({ id: folders.id, parentId: folders.parentId, name: folders.name, icon: folders.icon }).from(folders).where(eq(folders.orgId, orgId)),
    db.select({ id: assets.id, name: assets.name, folderId: assets.folderId, icon: assets.type }).from(assets).where(eq(assets.orgId, orgId)),
    db.select({ id: credentials.id, name: credentials.name, folderId: credentials.folderId }).from(credentials).where(eq(credentials.orgId, orgId)),
    db.select({ id: certificates.id, name: certificates.name, folderId: certificates.folderId }).from(certificates).where(eq(certificates.orgId, orgId)),
    db.select({ id: documents.id, name: documents.name, folderId: documents.folderId }).from(documents).where(eq(documents.orgId, orgId)),
  ]);
  return {
    folders: f,
    entries: [
      ...a.map((r) => ({ ...r, kind: "assets" as const })),
      ...c.map((r) => ({ ...r, kind: "credentials" as const, icon: "credential" })),
      ...s.map((r) => ({ ...r, kind: "certificates" as const, icon: "certificate" })),
      ...d.map((r) => ({ ...r, kind: "documents" as const, icon: "document" })),
    ],
  };
}

// Entries that sit directly in a folder (or at the root when folderId is null).
export async function entriesIn(orgId: string, folderId: string | null) {
  const where = <T extends (typeof ENTRY_TABLES)[Kind]>(t: T) => and(eq(t.orgId, orgId), folderId ? eq(t.folderId, folderId) : isNull(t.folderId));
  const [a, c, s, d] = await Promise.all([
    db.select().from(assets).where(where(assets)).orderBy(asc(assets.name)),
    db.select().from(credentials).where(where(credentials)).orderBy(asc(credentials.name)),
    db.select().from(certificates).where(where(certificates)).orderBy(asc(certificates.name)),
    db.select().from(documents).where(where(documents)).orderBy(asc(documents.name)),
  ]);
  return { assets: a, credentials: c, certificates: s, documents: d };
}

// Deleting a folder never deletes what is in it: sub-folders and entries move up one level.
export async function deleteFolder(folder: Folder) {
  await db.transaction(async (tx) => {
    await tx.update(folders).set({ parentId: folder.parentId }).where(eq(folders.parentId, folder.id));
    for (const t of Object.values(ENTRY_TABLES)) {
      await tx.update(t).set({ folderId: folder.parentId }).where(eq(t.folderId, folder.id));
    }
    await tx.delete(folders).where(eq(folders.id, folder.id));
  });
}

export async function moveEntry(kind: Kind, id: string, folderId: string | null) {
  const t = ENTRY_TABLES[kind];
  await db.update(t).set({ folderId }).where(eq(t.id, id));
}

export const childFolders = (orgId: string, parentId: string | null) =>
  db.select().from(folders).where(and(eq(folders.orgId, orgId), parentId ? eq(folders.parentId, parentId) : isNull(folders.parentId))).orderBy(asc(folders.name));

