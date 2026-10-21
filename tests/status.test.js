import { test } from "node:test";
import assert from "node:assert/strict";
import { computeStatus } from "../lib/status.js";

const nowMs = new Date(2026, 9, 21, 9, 0).getTime();
const base = { hasData: true, lastOkMs: nowMs - 2 * 60e3, failures: 0, lastError: null, nowMs };

test("datos frescos", () => {
  assert.deepEqual(computeStatus(base), { mode: "fresh", banner: null, ago: "hace 2 min" });
});

test("datos guardados más viejos que el máximo se atenúan aunque no haya error", () => {
  const s = computeStatus({ ...base, lastOkMs: nowMs - 14 * 3600e3, maxAgeMs: 10 * 60e3 });
  assert.equal(s.mode, "stale");
  assert.equal(s.banner, null);
  assert.equal(s.ago, "hace 14 h");
});

test("datos viejos con un fallo de red ya muestran la franja", () => {
  const s = computeStatus({ ...base, lastOkMs: nowMs - 14 * 3600e3, maxAgeMs: 10 * 60e3, failures: 1, lastError: "network" });
  assert.equal(s.mode, "stale");
  assert.equal(s.banner, "Sin conexión · datos de hace 14 h");
});

test("datos recientes dentro del máximo siguen frescos", () => {
  assert.equal(computeStatus({ ...base, maxAgeMs: 10 * 60e3 }).mode, "fresh");
});

test("cargando la primera vez", () => {
  const s = computeStatus({ ...base, hasData: false, lastOkMs: 0 });
  assert.equal(s.mode, "loading");
  assert.equal(s.banner, null);
});

test("un fallo de red no atenúa", () => {
  assert.equal(computeStatus({ ...base, failures: 1, lastError: "network" }).mode, "fresh");
});

test("dos fallos de red sí atenúan", () => {
  const s = computeStatus({ ...base, lastOkMs: nowMs - 12 * 60e3, failures: 2, lastError: "network" });
  assert.equal(s.mode, "stale");
  assert.equal(s.banner, "Sin conexión · datos de hace 12 min");
});

test("token vencido atenúa al instante", () => {
  const s = computeStatus({ ...base, lastOkMs: nowMs - 9 * 3600e3, failures: 1, lastError: "expired" });
  assert.equal(s.mode, "stale");
  assert.equal(s.banner, "Sesión de Claude vencida · datos de hace 9 h. Abre claude en una terminal para actualizar.");
  assert.equal(s.ago, "hace 9 h");
});

test("401 se trata como sesión vencida", () => {
  assert.equal(computeStatus({ ...base, failures: 1, lastError: "auth" }).mode, "stale");
});

test("sin datos y sesión vencida", () => {
  const s = computeStatus({ ...base, hasData: false, lastOkMs: 0, failures: 1, lastError: "expired" });
  assert.equal(s.mode, "nodata");
  assert.equal(s.banner, "La sesión de Claude Code venció — abre claude en una terminal para renovarla.");
  assert.equal(s.ago, "");
});

test("sin datos y sin archivo de sesión", () => {
  const s = computeStatus({ ...base, hasData: false, lastOkMs: 0, failures: 1, lastError: "missing" });
  assert.equal(s.mode, "nodata");
  assert.equal(s.banner, "No encontré tu sesión de Claude Code. Abre claude en una terminal e inicia sesión.");
});

test("sin datos y sin red", () => {
  const s = computeStatus({ ...base, hasData: false, lastOkMs: 0, failures: 1, lastError: "network" });
  assert.equal(s.mode, "nodata");
  assert.equal(s.banner, "Sin conexión con Claude. Reintentando…");
});
