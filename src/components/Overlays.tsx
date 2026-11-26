"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, X } from "lucide-react";
import { revealForEntryAction } from "@/app/actions";
import { copyText } from "@/lib/clipboard";
import { toast, type Field, type Target } from "./commands";
import { LiveOtp } from "./LiveOtp";

type Toast = { id: number; text: string; tone: "ok" | "error" };
type View = Target & { field: Field; value?: string; error?: string; left: number };

const HIDE_AFTER = 30;

// App-wide toasts and the "view password / one-time code" dialog.
export function Overlays() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [view, setView] = useState<View | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let n = 0;
    const onToast = (e: Event) => {
      const { text, tone } = (e as CustomEvent).detail;
      const id = ++n;
      setToasts((t) => [...t.slice(-2), { id, text, tone }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
    };
    const onView = async (e: Event) => {
      const t = (e as CustomEvent).detail as Target & { field: Field };
      setView({ ...t, left: 0 });
      dialog.current?.showModal();
      if (t.field === "totp") return; // <LiveOtp/> fetches and refreshes codes itself
      const r = await revealForEntryAction(t.orgId, t.kind, t.id, t.field, "view");
      setView({ ...t, value: r.value, error: r.value ? undefined : r.error ?? "Could not reveal.", left: HIDE_AFTER });
    };
    window.addEventListener("mv:toast", onToast);
    window.addEventListener("mv:view-secret", onView);
    return () => { window.removeEventListener("mv:toast", onToast); window.removeEventListener("mv:view-secret", onView); };
  }, []);

  // Count down and clear the secret from the page when time is up.
  useEffect(() => {
    if (!view?.value) return;
    if (view.left <= 0) { setView({ ...view, value: undefined, error: "Hidden after 30 seconds." }); return; }
    const timer = setTimeout(() => setView((v) => (v ? { ...v, left: v.left - 1 } : v)), 1000);
    return () => clearTimeout(timer);
  }, [view]);

  const close = () => { dialog.current?.close(); setView(null); };

  return (
    <>
      <dialog ref={dialog} className="modal" onClose={() => setView(null)} onClick={(e) => { if (e.target === dialog.current) close(); }}>
        {view ? (
          <div className="modal-body">
            <div className="modal-head">
              <div>
                <div className="muted small">{view.name}</div>
                <h2>{view.field === "totp" ? "One-time code" : "Password"}</h2>
              </div>
              <button type="button" className="btn btn-ghost btn-icon" aria-label="Close" onClick={close}><X size={16} /></button>
            </div>
            {view.field === "totp" ? <LiveOtp target={view} canReveal autoStart large /> : view.value ? (
              <>
                <output className="secret-view">{view.value}</output>
                <div className="row" style={{ justifyContent: "space-between", marginTop: 12 }}>
                  <span className="muted small">Hides in {view.left}s</span>
                  <button type="button" className="btn btn-primary" autoFocus onClick={async () => {
                    if (await copyText(view.value!)) { toast("Password copied"); close(); }
                    else toast("Your browser blocked the clipboard.", "error");
                  }}><Copy size={14} />Copy</button>
                </div>
              </>
            ) : view.error ? <p className="alert alert-error">{view.error}</p> : <p className="muted">Loading...</p>}
          </div>
        ) : null}
      </dialog>
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={`toast toast-${t.tone}`}>{t.text}</div>)}
      </div>
    </>
  );
}
