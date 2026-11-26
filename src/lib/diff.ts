// Minimal line diff (longest common subsequence) for version history.
export type DiffLine = { op: "same" | "add" | "del"; text: string };

export function diffLines(before: string, after: string): DiffLine[] {
  const a = before === "" ? [] : before.split("\n");
  const b = after === "" ? [] : after.split("\n");
  // Very large inputs fall back to a whole-block replacement to keep the table small.
  if (a.length * b.length > 4_000_000) {
    return [...a.map((text) => ({ op: "del" as const, text })), ...b.map((text) => ({ op: "add" as const, text }))];
  }
  const lcs: Uint32Array[] = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { out.push({ op: "same", text: a[i] }); i++; j++; }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) out.push({ op: "del", text: a[i++] });
    else out.push({ op: "add", text: b[j++] });
  }
  while (i < a.length) out.push({ op: "del", text: a[i++] });
  while (j < b.length) out.push({ op: "add", text: b[j++] });
  return out;
}
