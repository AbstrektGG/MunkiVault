"use client";

import Link from "next/link";
import { useState } from "react";
import { Eye, Search } from "lucide-react";
import { LiveOtp } from "./LiveOtp";
import { EntryIcon } from "./icons";

type Row = { kind: "otp" | "credentials"; id: string; name: string; issuer: string | null; account: string | null; folder: string };

export function AuthenticatorList({ orgId, rows, canReveal }: { orgId: string; rows: Row[]; canReveal: boolean }) {
  const [filter, setFilter] = useState("");
  const [round, setRound] = useState(0); // bumping this restarts every row with its code showing
  const q = filter.trim().toLowerCase();
  const shown = rows.filter((r) => !q || [r.name, r.issuer, r.account, r.folder].some((v) => v?.toLowerCase().includes(q)));
  return (
    <section className="card">
      <div className="card-head">
        <div className="tree-search" style={{ maxWidth: 320 }}>
          <Search size={14} aria-hidden />
          <input type="search" placeholder="Filter" aria-label="Filter authenticators" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
        {canReveal && rows.length ? <button type="button" className="btn btn-sm" onClick={() => setRound(round + 1)}><Eye size={14} />Show all codes</button> : null}
      </div>
      {shown.length ? (
        <ul className="auth-list">
          {shown.map((r) => (
            <li key={`${r.kind}-${r.id}`}>
              <div className="auth-meta">
                <Link href={`/orgs/${orgId}/${r.kind}/${r.id}`} className="with-icon auth-name"><EntryIcon icon={r.kind === "otp" ? "otp" : "credential"} />{r.name}</Link>
                <div className="muted small">{[r.issuer, r.account, r.folder].filter(Boolean).join(" · ")}</div>
              </div>
              <LiveOtp key={`${r.id}-${round}`} target={{ orgId, kind: r.kind, id: r.id, name: r.name }} canReveal={canReveal} autoStart={round > 0} />
            </li>
          ))}
        </ul>
      ) : <div className="empty"><strong>{rows.length ? "No matches" : "No authenticators in this vault"}</strong></div>}
    </section>
  );
}
