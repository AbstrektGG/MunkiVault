import Link from "next/link";
import type { ReactNode } from "react";
import { daysUntil, expiryLabel, fmtDate, fmtDateTime, urgency } from "@/lib/format";

export function PageHead({ title, crumbs, children }: { title: ReactNode; crumbs?: [string, string][]; children?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        {crumbs?.length ? (
          <div className="crumbs">
            {crumbs.map(([label, href], i) => <span key={href}>{i ? " / " : ""}<Link href={href}>{label}</Link></span>)}
          </div>
        ) : null}
        <h1>{title}</h1>
      </div>
      {children ? <div className="actions">{children}</div> : null}
    </div>
  );
}

export function ExpiryBadge({ date }: { date: string | null | undefined }) {
  if (!date) return null;
  const days = daysUntil(date);
  return <span className={`badge badge-${urgency(days)}`}>{expiryLabel(days)}</span>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="empty"><strong>{title}</strong>{children}</div>;
}

export type AuditRow = { id: string; createdAt: Date; actor: string | null; action: string; detail: string | null; ip: string | null; orgName?: string | null };

export function AuditTable({ rows, showOrg }: { rows: AuditRow[]; showOrg?: boolean }) {
  if (!rows.length) return <Empty title="No activity yet" />;
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>When</th><th>Who</th><th>Action</th>{showOrg ? <th>Organization</th> : null}<th>Detail</th><th>IP</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="nowrap muted">{fmtDateTime(r.createdAt)}</td>
              <td>{r.actor ?? "Unknown"}</td>
              <td><span className="badge">{r.action}</span></td>
              {showOrg ? <td>{r.orgName ?? ""}</td> : null}
              <td>{r.detail ?? ""}</td>
              <td className="mono muted">{r.ip ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { fmtDate };
