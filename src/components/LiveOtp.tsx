"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, KeyRound } from "lucide-react";
import { revealForEntryAction, type RevealResult } from "@/app/actions";
import { copyText } from "@/lib/clipboard";
import { toast, type Target } from "./commands";

// Stop refreshing after this long so codes are not left streaming on an unattended screen.
const MAX_LIVE_MS = 10 * 60_000;

export const formatCode = (code: string) =>
  code.length === 8 ? `${code.slice(0, 4)} ${code.slice(4)}` : `${code.slice(0, 3)} ${code.slice(3)}`;

export function Ring({ remaining, period, size = 34 }: { remaining: number; period: number; size?: number }) {
  const r = size / 2 - 3, c = 2 * Math.PI * r;
  const low = remaining <= 5;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={`otp-ring${low ? " low" : ""}`} aria-label={`${remaining} seconds left`}>
      <circle cx={size / 2} cy={size / 2} r={r} className="otp-ring-track" />
      <circle cx={size / 2} cy={size / 2} r={r} className="otp-ring-fill" strokeDasharray={c} strokeDashoffset={c * (1 - remaining / period)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle">{remaining}</text>
    </svg>
  );
}

// A live authenticator code: fetched from the server on request, counts down, and moves to the next
// code by itself. The secret key never reaches the browser.
export function LiveOtp({ target, canReveal, autoStart = false, large = false }: { target: Target; canReveal: boolean; autoStart?: boolean; large?: boolean }) {
  const [state, setState] = useState<RevealResult | null>(null);
  const [left, setLeft] = useState(0);
  const started = useRef(0);

  const fetchCode = useCallback(async () => {
    const r = await revealForEntryAction(target.orgId, target.kind, target.id, "totp", "view");
    setState(r);
    setLeft(r.remaining ?? 0);
  }, [target.orgId, target.kind, target.id]);

  const start = useCallback(() => { started.current = Date.now(); void fetchCode(); }, [fetchCode]);
  useEffect(() => { if (autoStart && canReveal) start(); }, [autoStart, canReveal, start]);

  useEffect(() => {
    if (!state?.value) return;
    const timer = setTimeout(() => {
      if (left > 1) { setLeft(left - 1); return; }
      if (Date.now() - started.current > MAX_LIVE_MS || document.visibilityState === "hidden") { setState(null); return; }
      // Roll over to the next code at once, then fetch so the following one is ready.
      setState((s) => (s?.next ? { ...s, value: s.next, next: undefined } : s));
      setLeft(state.period ?? 30);
      void fetchCode();
    }, 1000);
    return () => clearTimeout(timer);
  }, [state, left, fetchCode]);

  if (!canReveal) return <span className="muted">Editor access is required to generate codes.</span>;
  if (!state?.value) {
    return (
      <div className="row">
        <button type="button" className="btn btn-sm" onClick={start}><KeyRound size={14} />Show code</button>
        {state?.error ? <span className="small" style={{ color: "var(--mv-danger)" }}>{state.error}</span> : null}
      </div>
    );
  }
  return (
    <div className={`live-otp${large ? " large" : ""}`}>
      <button type="button" className="otp-code" title="Copy code" onClick={async () => {
        if (await copyText(state.value!)) toast("One-time code copied"); else toast("Your browser blocked the clipboard.", "error");
      }}>
        {formatCode(state.value)}
      </button>
      <Ring remaining={left} period={state.period ?? 30} size={large ? 44 : 34} />
      <button type="button" className="btn btn-sm" onClick={async () => { if (await copyText(state.value!)) toast("One-time code copied"); }}><Copy size={14} />Copy</button>
      {left <= 5 && state.next ? <span className="muted small">Next: {formatCode(state.next)}</span> : null}
    </div>
  );
}
