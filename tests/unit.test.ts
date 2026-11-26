import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

process.env.MUNKIVAULT_MASTER_KEY = randomBytes(32).toString("base64");

import { decryptSecret, encryptSecret, hashPassword, parseTotpSeed, totp, verifyPassword } from "../src/lib/crypto";
import { diffLines } from "../src/lib/diff";
import { daysUntil, urgency } from "../src/lib/format";
import { DEFAULT_OPTIONS, charsets, generatePassword } from "../src/lib/password";

test("secrets round-trip and ciphertext is unique per write", () => {
  const a = encryptSecret("correct horse");
  const b = encryptSecret("correct horse");
  assert.notEqual(a, b);
  assert.equal(decryptSecret(a), "correct horse");
  assert.ok(!a.includes("correct"));
});

test("tampered ciphertext is rejected", () => {
  const parts = encryptSecret("secret").split(":");
  parts[3] = Buffer.from("other!").toString("base64");
  assert.throws(() => decryptSecret(parts.join(":")));
});

test("a different master key cannot decrypt", () => {
  const payload = encryptSecret("secret");
  const original = process.env.MUNKIVAULT_MASTER_KEY;
  process.env.MUNKIVAULT_MASTER_KEY = randomBytes(32).toString("base64");
  assert.throws(() => decryptSecret(payload));
  process.env.MUNKIVAULT_MASTER_KEY = original;
});

test("password hashes verify and reject", async () => {
  const hash = await hashPassword("a long enough password");
  assert.ok(await verifyPassword("a long enough password", hash));
  assert.ok(!(await verifyPassword("a long enough passwore", hash)));
  assert.ok(!(await verifyPassword("anything", null)));
});

test("TOTP matches the RFC 6238 SHA-1 vector", () => {
  const seed = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  assert.equal(totp(seed, 59_000).code, "287082");
  assert.equal(totp(seed, 1111111109_000).code, "081804");
  assert.equal(parseTotpSeed(`otpauth://totp/x?secret=${seed.toLowerCase()}&issuer=y`), seed);
  assert.throws(() => parseTotpSeed("not base32!"));
});

test("line diff reports additions and removals", () => {
  const ops = diffLines("a\nb\nc", "a\nc\nd").map((l) => `${l.op}:${l.text}`);
  assert.deepEqual(ops, ["same:a", "del:b", "same:c", "add:d"]);
  assert.deepEqual(diffLines("", "x"), [{ op: "add", text: "x" }]);
});

test("generated passwords honour the options", () => {
  for (let i = 0; i < 200; i++) {
    const pw = generatePassword({ ...DEFAULT_OPTIONS, length: 16 });
    assert.equal(pw.length, 16);
    assert.ok(!/[Il1O0o|]/.test(pw));
    for (const set of charsets(DEFAULT_OPTIONS)) assert.ok([...pw].some((ch) => set.includes(ch)));
  }
  assert.match(generatePassword({ ...DEFAULT_OPTIONS, lower: false, upper: false, symbols: false, length: 12 }), /^\d{12}$/);
  assert.equal(generatePassword({ ...DEFAULT_OPTIONS, lower: false, upper: false, symbols: false, digits: false }), "");
});

test("expiry urgency thresholds", () => {
  const now = new Date("2026-06-15T10:00:00Z");
  assert.equal(daysUntil("2026-06-15", now), 0);
  assert.equal(daysUntil("2026-06-14", now), -1);
  assert.equal(urgency(-1), "expired");
  assert.equal(urgency(14), "critical");
  assert.equal(urgency(45), "warning");
  assert.equal(urgency(46), "ok");
});
