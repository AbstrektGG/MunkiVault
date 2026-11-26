import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { Search } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { accessibleOrgs } from "@/lib/access";
import { Sidebar } from "@/components/Sidebar";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const orgs = await accessibleOrgs(user);
  const collapsed = (await cookies()).get("mv_sidebar")?.value === "collapsed";
  return (
    <div className={`shell${collapsed ? " shell-collapsed" : ""}`}>
      <Sidebar
        orgs={orgs.map((o) => ({ id: o.id, name: o.name, kind: o.kind }))}
        user={{ name: user.name, email: user.email, isAdmin: user.role === "admin" }}
        initialCollapsed={collapsed}
      />
      <div className="main">
        <header className="topbar">
          <form action="/search" className="search" role="search">
            <Search size={15} />
            <input type="search" name="q" placeholder="Search systems, credentials, certificates, documents" aria-label="Search" />
          </form>
        </header>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
