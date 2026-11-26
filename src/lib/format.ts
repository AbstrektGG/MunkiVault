const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
const dateTimeFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export const fmtDate = (value: string | Date | null | undefined) => (value ? dateFmt.format(new Date(value)) : "");
export const fmtDateTime = (value: Date | null | undefined) => (value ? dateTimeFmt.format(value) : "");

export function daysUntil(date: string | null | undefined, now = new Date()): number | null {
  if (!date) return null;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((Date.parse(date) - today) / 86_400_000);
}

export type Urgency = "expired" | "critical" | "warning" | "ok";

export function urgency(days: number | null): Urgency {
  if (days === null) return "ok";
  if (days < 0) return "expired";
  if (days <= 14) return "critical";
  if (days <= 45) return "warning";
  return "ok";
}

export function expiryLabel(days: number | null): string {
  if (days === null) return "";
  if (days < 0) return `Expired ${-days} day${days === -1 ? "" : "s"} ago`;
  if (days === 0) return "Expires today";
  return `${days} day${days === 1 ? "" : "s"} left`;
}
