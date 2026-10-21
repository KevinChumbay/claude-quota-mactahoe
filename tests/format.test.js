import { test } from "node:test";
import assert from "node:assert/strict";
import { formatReset, formatAgo } from "../lib/format.js";

// Martes 21 de octubre de 2026, 00:33 hora local.
const now = new Date(2026, 9, 21, 0, 33);

test("reinicio el mismo día", () => {
  const r = formatReset(new Date(2026, 9, 21, 2, 30).toISOString(), now);
  assert.deepEqual(r, { clock: "02:30", short: "02:30", remaining: "1 h 57 min" });
});

test("reinicio en otro día", () => {
  const r = formatReset(new Date(2026, 9, 27, 20, 0).toISOString(), now);
  assert.deepEqual(r, { clock: "mar 20:00", short: "mar 20h", remaining: "6 d 19 h" });
});

test("la hora de reinicio se redondea al minuto (la API manda desfases de segundos)", () => {
  const jitter = new Date(2026, 9, 21, 2, 29, 59, 900).toISOString();
  assert.equal(formatReset(jitter, now).clock, "02:30");
  const late = new Date(2026, 9, 27, 20, 0, 0, 55).toISOString();
  assert.equal(formatReset(late, now).clock, "mar 20:00");
});

test("reinicio en menos de una hora", () => {
  assert.equal(formatReset(new Date(2026, 9, 21, 0, 58).toISOString(), now).remaining, "25 min");
});

test("reinicio en el pasado o nulo", () => {
  assert.equal(formatReset(new Date(2026, 9, 21, 0, 32).toISOString(), now).remaining, "ahora");
  assert.deepEqual(formatReset(null, now), { clock: "", short: "", remaining: "" });
});

test("hace cuánto", () => {
  const n = now.getTime();
  assert.equal(formatAgo(n - 20e3, n), "hace un momento");
  assert.equal(formatAgo(n - 2 * 60e3, n), "hace 2 min");
  assert.equal(formatAgo(n - 9 * 3600e3, n), "hace 9 h");
  assert.equal(formatAgo(n - 50 * 3600e3, n), "hace 2 d");
});
