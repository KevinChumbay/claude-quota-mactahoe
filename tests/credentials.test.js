import { test } from "node:test";
import assert from "node:assert/strict";
import { tokenFromCredentials } from "../lib/credentials.js";

const ok = JSON.stringify({ claudeAiOauth: { accessToken: "t", expiresAt: 2000 } });

test("token vigente", () => {
  assert.deepEqual(tokenFromCredentials(ok, 1000), { token: "t", expired: false, error: null });
});

test("token vencido", () => {
  assert.deepEqual(tokenFromCredentials(ok, 3000), { token: "t", expired: true, error: null });
});

test("sin expiresAt no se da por vencido", () => {
  const t = JSON.stringify({ claudeAiOauth: { accessToken: "t" } });
  assert.equal(tokenFromCredentials(t, 9e15).expired, false);
});

test("archivo ausente, roto o sin sesión", () => {
  assert.equal(tokenFromCredentials(null, 0).error, "missing");
  assert.equal(tokenFromCredentials("{roto", 0).error, "invalid");
  assert.equal(tokenFromCredentials("{}", 0).error, "missing");
  assert.equal(tokenFromCredentials("[]", 0).error, "missing");
  assert.equal(tokenFromCredentials(JSON.stringify({ claudeAiOauth: {} }), 0).error, "missing");
});
