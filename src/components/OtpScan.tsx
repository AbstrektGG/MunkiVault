"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { ImageUp, MonitorSmartphone } from "lucide-react";

export type ScannedOtp = { uri: string; issuer?: string; account?: string; algorithm: string; digits: string; period: string };

// Reads an otpauth://totp/ link from QR code text. Validation of the key itself happens on the server.
export function readOtpUri(text: string): ScannedOtp {
  const value = text.trim();
  if (/^otpauth-migration:/i.test(value)) throw new Error("That is a Google Authenticator export code. Scan the QR code from the service itself instead.");
  if (!/^otpauth:\/\/totp\//i.test(value)) throw new Error(/^otpauth:\/\/hotp/i.test(value) ? "Counter-based (HOTP) codes are not supported." : "That QR code is not an authenticator setup code.");
  const url = new URL(value);
  const p = url.searchParams;
  if (!p.get("secret")) throw new Error("The QR code has no secret key.");
  const label = decodeURIComponent(url.pathname.replace(/^\//, ""));
  const i = label.indexOf(":");
  return {
    uri: value,
    issuer: (p.get("issuer") ?? (i >= 0 ? label.slice(0, i) : "")).trim() || undefined,
    account: (i >= 0 ? label.slice(i + 1) : label).trim() || undefined,
    algorithm: (p.get("algorithm") ?? "SHA1").toUpperCase().replace("-", ""),
    digits: p.get("digits") ?? "6",
    period: p.get("period") ?? "30",
  };
}

function decode(source: CanvasImageSource, width: number, height: number): string | null {
  // Large screenshots are scaled down first; jsQR is quicker and just as accurate on a 1600px image.
  const scale = Math.min(1, 1600 / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return jsQR(img.data, img.width, img.height, { inversionAttempts: "attemptBoth" })?.data ?? null;
}

async function decodeBlob(blob: Blob): Promise<string | null> {
  const bitmap = await createImageBitmap(blob);
  try { return decode(bitmap, bitmap.width, bitmap.height); } finally { bitmap.close(); }
}

async function decodeScreen(): Promise<string | null> {
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  try {
    const video = document.createElement("video");
    video.srcObject = stream; video.muted = true;
    await video.play();
    await new Promise((r) => setTimeout(r, 400));
    return decode(video, video.videoWidth, video.videoHeight);
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}

// QR code input for an authenticator: upload an image, paste a screenshot, or capture the screen.
export function OtpScan({ onScan, formRef }: { onScan: (r: ScannedOtp) => void; formRef: React.RefObject<HTMLFormElement | null> }) {
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);
  const [canCapture, setCanCapture] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => { setCanCapture(Boolean(navigator.mediaDevices?.getDisplayMedia) && window.isSecureContext); }, []);

  const handle = async (get: () => Promise<string | null>) => {
    setStatus({ text: "Reading QR code..." });
    try {
      const text = await get();
      if (!text) { setStatus({ text: "No QR code found. Try a closer crop, or enter the setup key manually below.", error: true }); return; }
      const r = readOtpUri(text);
      onScan(r);
      setStatus({ text: `Read ${[r.issuer, r.account].filter(Boolean).join(" · ") || "authenticator"} (${r.algorithm}, ${r.digits} digits, every ${r.period}s). Review and save.` });
    } catch (err) {
      setStatus({ text: err instanceof Error && err.name !== "NotAllowedError" ? err.message : "Screen capture was cancelled.", error: true });
    }
  };

  // A screenshot pasted anywhere in the form is scanned.
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith("image/"));
      if (!item) return;
      e.preventDefault();
      const blob = item.getAsFile();
      if (blob) void handle(() => decodeBlob(blob));
    };
    form.addEventListener("paste", onPaste);
    return () => form.removeEventListener("paste", onPaste);
  });

  return (
    <div className="otp-scan"
      onDragOver={(e) => { e.preventDefault(); }}
      onDrop={(e) => { const f = e.dataTransfer.files[0]; if (f?.type.startsWith("image/")) { e.preventDefault(); void handle(() => decodeBlob(f)); } }}>
      <div className="row">
        <button type="button" className="btn btn-sm" onClick={() => file.current?.click()}><ImageUp size={14} />Scan QR image</button>
        {canCapture ? <button type="button" className="btn btn-sm" onClick={() => handle(decodeScreen)}><MonitorSmartphone size={14} />Scan QR on screen</button> : null}
        <span className="muted small">or paste a screenshot (Ctrl+V), or drop an image here</span>
      </div>
      <input ref={file} type="file" accept="image/*" hidden aria-label="QR code image"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void handle(() => decodeBlob(f)); }} />
      {status ? <div className="help" role="status" style={status.error ? { color: "var(--mv-danger)" } : undefined}>{status.text}</div> : null}
    </div>
  );
}
