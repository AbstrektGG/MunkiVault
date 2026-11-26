"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { revealSecretAction } from "@/app/actions";
import { CopyButton } from "./ui";

const HIDE_AFTER_SECONDS = 30;

// Secrets never reach the browser until someone asks; each reveal is written to the audit log.
export function SecretReveal({ orgId, id, field, canReveal }: { orgId: string; id: string; field: "password" | "totp"; canReveal: boolean }) {
  const [value, setValue] = useState<string | null>(null);
  const [left, setLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (value === null) return;
    if (left <= 0) { setValue(null); return; }
    const timer = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [value, left]);

  if (!canReveal) return <span className="muted">Hidden. Editor access is required to reveal secrets.</span>;

  async function reveal() {
    setBusy(true); setError(null);
    const result = await revealSecretAction(orgId, id, field);
    setBusy(false);
    if (result.error || result.value === undefined) { setError(result.error ?? "Could not reveal."); return; }
    setValue(result.value);
    setLeft(field === "totp" ? result.remaining ?? 30 : HIDE_AFTER_SECONDS);
  }

  return (
    <div className="secret">
      {value === null ? (
        <>
          <output className="muted">{field === "totp" ? "••• •••" : "••••••••••••"}</output>
          <button type="button" className="btn btn-sm" onClick={reveal} disabled={busy}>
            {field === "totp" ? <KeyRound size={14} /> : <Eye size={14} />}{field === "totp" ? "Get code" : "Reveal"}
          </button>
        </>
      ) : (
        <>
          <output>{field === "totp" ? `${value.slice(0, 3)} ${value.slice(3)}` : value}</output>
          <CopyButton value={value} />
          <button type="button" className="btn btn-sm" onClick={() => setValue(null)}><EyeOff size={14} />Hide</button>
          <span className="muted small">{field === "totp" ? `valid for ${left}s` : `hides in ${left}s`}</span>
        </>
      )}
      {error ? <span className="small" style={{ color: "var(--mv-danger)" }}>{error}</span> : null}
    </div>
  );
}
