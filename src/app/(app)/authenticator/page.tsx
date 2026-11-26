import Link from "next/link";
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { Plus } from "lucide-react";
import { db } from "@/db";
import { credentials, otps } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { accessibleOrgs, can, levelsFor } from "@/lib/access";
import { ensurePersonalVault } from "@/lib/vault";
import { listFolders, pathTo } from "@/lib/folders";
import { AuthenticatorList } from "@/components/AuthenticatorList";
import { PageHead } from "@/components/server";

export const metadata = { title: "Authenticator" };

export default async function AuthenticatorPage({ searchParams }: { searchParams: Promise<{ vault?: string }> }) {
  const user = await requireUser();
  const personal = await ensurePersonalVault(user);
  const orgs = await accessibleOrgs(user);
  const levels = await levelsFor(user, orgs);
  const requested = (await searchParams).vault;
  const org = orgs.find((o) => o.id === requested && levels[o.id]) ?? personal;
  const level = levels[org.id] ?? "manager";
  const [otpRows, credRows, folders] = await Promise.all([
    db.select({ id: otps.id, name: otps.name, issuer: otps.issuer, account: otps.account, folderId: otps.folderId }).from(otps)
      .where(eq(otps.orgId, org.id)).orderBy(asc(otps.name)),
    db.select({ id: credentials.id, name: credentials.name, account: credentials.username, folderId: credentials.folderId }).from(credentials)
      .where(and(eq(credentials.orgId, org.id), isNotNull(credentials.totp))).orderBy(asc(credentials.name)),
    listFolders(org.id),
  ]);
  const folderLabel = (id: string | null) => pathTo(folders, id).map((f) => f.name).join(" / ");
  const rows = [
    ...otpRows.map((r) => ({ kind: "otp" as const, id: r.id, name: r.name, issuer: r.issuer, account: r.account, folder: folderLabel(r.folderId) })),
    ...credRows.map((r) => ({ kind: "credentials" as const, id: r.id, name: r.name, issuer: null, account: r.account, folder: folderLabel(r.folderId) })),
  ].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  const shared = orgs.filter((o) => !o.ownerId && levels[o.id]);
  return (
    <div className="stack">
      <PageHead title="Authenticator">
        <form className="row">
          <select name="vault" defaultValue={org.id} aria-label="Vault" style={{ width: 240 }}>
            <option value={personal.id}>My vault (private)</option>
            {shared.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <button type="submit" className="btn">Open</button>
        </form>
        {can(level, "editor") ? <Link href={`/orgs/${org.id}/otp/new`} className="btn btn-primary"><Plus size={15} />New OTP</Link> : null}
      </PageHead>
      <p className="muted">One-time codes for every OTP entry and every credential with a one-time code in {org.id === personal.id ? "your personal vault" : org.name}. Codes are generated on the server; the secret keys never reach your browser. Click a code to copy it.</p>
      <AuthenticatorList orgId={org.id} rows={rows} canReveal={can(level, "editor")} />
    </div>
  );
}
