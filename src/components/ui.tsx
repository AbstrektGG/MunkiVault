"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Check, Copy } from "lucide-react";
import type { FormState } from "@/app/actions";
import { copyText } from "@/lib/clipboard";

const PendingContext = createContext(false);

export function Submit({ children, className = "btn btn-primary" }: { children: ReactNode; className?: string }) {
  const status = useFormStatus();
  const pending = useContext(PendingContext) || status.pending;
  return <button type="submit" className={className} disabled={pending}>{pending ? "Working..." : children}</button>;
}

export function Message({ state }: { state: FormState }) {
  if (state?.error) return <div className="alert alert-error" role="alert">{state.error}</div>;
  if (state?.ok) return <div className="alert alert-ok" role="status">{state.ok}</div>;
  return null;
}

// A form bound to a server action that reports { error } or { ok }. It is submitted by hand so
// that React does not clear what was typed when the server reports an error.
export function ActionForm({ action, children, className, resetOnOk }: {
  action: (prev: FormState, form: FormData) => Promise<FormState>; children: ReactNode; className?: string; resetOnOk?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!state?.ok || !ref.current) return;
    if (resetOnOk) ref.current.reset();
    ref.current.querySelectorAll<HTMLInputElement>("input[type=password]").forEach((el) => { el.value = ""; });
  }, [state, resetOnOk]);
  return (
    <form ref={ref} className={className} onSubmit={(e) => {
      e.preventDefault();
      const data = new FormData(e.currentTarget);
      startTransition(() => formAction(data));
    }}>
      <PendingContext.Provider value={pending}>{children}</PendingContext.Provider>
      {state ? <div style={{ marginTop: 12 }}><Message state={state} /></div> : null}
    </form>
  );
}

export function NavLink({ href, exact, children }: { href: string; exact?: boolean; children: ReactNode }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(`${href}/`);
  return <Link href={href} aria-current={active ? "page" : undefined}>{children}</Link>;
}

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="btn btn-sm" onClick={async () => {
      if (!(await copyText(value))) return;
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    }}>
      {done ? <Check size={14} /> : <Copy size={14} />}{done ? "Copied" : label}
    </button>
  );
}

// A button that asks for confirmation before running a server action.
export function ConfirmButton({ action, question, children, className = "btn btn-danger" }: {
  action: () => Promise<void>; question: string; children: ReactNode; className?: string;
}) {
  return (
    <form action={action} onSubmit={(e) => { if (!window.confirm(question)) e.preventDefault(); }}>
      <Submit className={className}>{children}</Submit>
    </form>
  );
}
