import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

process.env.MUNKIVAULT_MASTER_KEY = randomBytes(32).toString("base64");

import { base32Encode, canonicalOtp, decryptSecret, encryptSecret, hashPassword, otpCode, parseOtp, totp, verifyPassword } from "../src/lib/crypto";
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
  assert.equal(canonicalOtp(`otpauth://totp/x?secret=${seed.toLowerCase()}&issuer=y`), seed);
  assert.throws(() => canonicalOtp("not base32!"));
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

test("TOTP matches the RFC 6238 SHA-256 and SHA-512 vectors (8 digits)", () => {
  const k256 = base32Encode(Buffer.from("12345678901234567890123456789012"));
  const k512 = base32Encode(Buffer.from("1234567890123456789012345678901234567890123456789012345678901234"));
  const vectors: [number, string, string][] = [[59, "46119246", "90693936"], [1111111109, "68084774", "25091201"], [20000000000, "77737706", "47863826"]];
  for (const [t, c256, c512] of vectors) {
    assert.equal(otpCode(k256, t * 1000, { algorithm: "SHA256", digits: 8 }).code, c256);
    assert.equal(otpCode(k512, t * 1000, { algorithm: "SHA512", digits: 8 }).code, c512);
  }
  // Settings carried inside an otpauth link survive storage.
  const stored = canonicalOtp(`otpauth://totp/Acme:me@acme.test?secret=${k256}&algorithm=SHA256&digits=8&period=30&issuer=Acme`);
  assert.equal(otpCode(stored, 59_000).code, "46119246");
});

test("otpauth links are parsed and validated", () => {
  const seed = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  const c = parseOtp(`otpauth://totp/Microsoft:alex%40contoso.com?secret=${seed}&issuer=Microsoft&period=60`);
  assert.deepEqual([c.issuer, c.account, c.period, c.digits, c.algorithm], ["Microsoft", "alex@contoso.com", 60, 6, "SHA1"]);
  assert.equal(parseOtp(`otpauth://totp/GitHub?secret=${seed}`).account, "GitHub");
  assert.throws(() => parseOtp(`otpauth://hotp/x?secret=${seed}&counter=1`), /HOTP/);
  assert.throws(() => parseOtp("otpauth-migration://offline?data=abc"), /Google Authenticator export/);
  assert.throws(() => parseOtp(`otpauth://totp/x?secret=${seed}&digits=4`), /6 to 8/);
  assert.throws(() => parseOtp("GEZDG"), /too short/);
  const now = 1_700_000_000_000;
  const a = otpCode(seed, now), b = otpCode(seed, now + 30_000);
  assert.equal(a.next, b.code);
  assert.ok(a.remaining >= 1 && a.remaining <= 30);
});
