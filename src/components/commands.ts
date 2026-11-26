"use client";

import { revealForEntryAction } from "@/app/actions";
import { copyText } from "@/lib/clipboard";

export type Field = "password" | "totp";
export type Target = { orgId: string; kind: string; id: string; name: string };

export function toast(text: string, tone: "ok" | "error" = "ok") {
  window.dispatchEvent(new CustomEvent("mv:toast", { detail: { text, tone } }));
}

export async function copyPlain(text: string, label: string) {
  if (await copyText(text)) toast(`${label} copied`); else toast("Your browser blocked the clipboard.", "error");
}

export async function copySecret(t: Target, field: Field) {
  const r = await revealForEntryAction(t.orgId, t.kind, t.id, field, "copy");
  if (!r.value) { toast(r.error ?? "Could not copy.", "error"); return; }
  if (!(await copyText(r.value))) { toast("Your browser blocked the clipboard.", "error"); return; }
  toast(field === "totp" ? `One-time code copied, valid for ${r.remaining}s` : "Password copied");
}

// The dialog lives in <Overlays/>; this asks it to open.
export function viewSecret(t: Target, field: Field) {
  window.dispatchEvent(new CustomEvent("mv:view-secret", { detail: { ...t, field } }));
}
