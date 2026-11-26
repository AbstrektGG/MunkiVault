import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { Search } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { accessibleOrgs, levelsFor } from "@/lib/access";
import { ensurePersonalVault } from "@/lib/vault";
import { AppNav } from "@/components/AppNav";
import { TreePanel } from "@/components/TreePanel";
import { Overlays } from "@/components/Overlays";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const vault = await ensurePersonalVault(user);
  const orgs = await accessibleOrgs(user);
  const levels = await levelsFor(user, orgs);
  const collapsed = (await cookies()).get("mv_sidebar")?.value === "collapsed";
  return (
    <div className="shell">
      <AppNav user={{ name: user.name, email: user.email, isAdmin: user.role === "admin" }} vaultId={vault.id} initialCollapsed={collapsed} />
      <TreePanel personalId={vault.id} vaults={orgs.filter((o) => levels[o.id]).map((o) => ({ id: o.id, name: o.name, kind: o.kind, level: levels[o.id] }))} />
      <div className="main">
        <header className="topbar">
          <form action="/search" className="search" role="search">
            <Search size={15} />
            <input type="search" name="q" placeholder="Search systems, credentials, certificates, documents" aria-label="Search" />
          </form>
        </header>
        <div className="content">{children}</div>
      </div>
      <Overlays />
    </div>
  );
}
