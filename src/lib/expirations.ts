import "server-only";
import { and, asc, inArray, isNotNull, lte } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { assets, certificates, credentials } from "@/db/schema";
import type { Org } from "./access";
import type { Kind } from "./entities";
import { daysUntil } from "./format";

export type Expiration = { kind: Kind; what: string; id: string; orgId: string; orgName: string; name: string; date: string; days: number };

// Everything with a date that falls within `withinDays` (already expired items included).
export async function upcomingExpirations(orgs: Org[], withinDays: number): Promise<Expiration[]> {
  if (!orgs.length) return [];
  const ids = orgs.map((o) => o.id);
  const names = new Map(orgs.map((o) => [o.id, o.name]));
  const cutoff = new Date(Date.now() + withinDays * 86_400_000).toISOString().slice(0, 10);
  type Row = { id: string; orgId: string; name: string; date: string | null };
  const where = (orgCol: PgColumn, dateCol: PgColumn) => and(inArray(orgCol, ids), isNotNull(dateCol), lte(dateCol, cutoff));
  const [certs, creds, warranties]: Row[][] = await Promise.all([
    db.select({ id: certificates.id, orgId: certificates.orgId, name: certificates.name, date: certificates.notAfter })
      .from(certificates).where(where(certificates.orgId, certificates.notAfter)).orderBy(asc(certificates.notAfter)),
    db.select({ id: credentials.id, orgId: credentials.orgId, name: credentials.name, date: credentials.expiresAt })
      .from(credentials).where(where(credentials.orgId, credentials.expiresAt)).orderBy(asc(credentials.expiresAt)),
    db.select({ id: assets.id, orgId: assets.orgId, name: assets.name, date: assets.warrantyExpires })
      .from(assets).where(where(assets.orgId, assets.warrantyExpires)).orderBy(asc(assets.warrantyExpires)),
  ]);
  const map = (rows: Row[], kind: Kind, what: string): Expiration[] =>
    rows.map((r) => ({ kind, what, id: r.id, orgId: r.orgId, name: r.name, date: String(r.date), orgName: names.get(r.orgId) ?? "", days: daysUntil(String(r.date)) ?? 0 }));
  return [...map(certs, "certificates", "Certificate"), ...map(creds, "credentials", "Password"), ...map(warranties, "assets", "Warranty")]
    .sort((a, b) => a.days - b.days);
}
