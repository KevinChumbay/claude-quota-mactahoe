import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateAlerts } from "../lib/alerts.js";

const now = new Date(2026, 9, 21, 0, 33);
const opts = { warn: 80, crit: 95, enabled: true, notifyRelease: true, now };
const P1 = new Date(2026, 9, 27, 20, 0).toISOString();
const P2 = new Date(2026, 10, 3, 20, 0).toISOString();
const weekly = (util, resetsAt = P1) => ({ key: "seven_day", label: "Semanal", util, resetsAt });

function run(steps, o = opts) {
  let state = {};
  let last;
  for (const qs of steps) {
    last = evaluateAlerts(qs, state, o);
    state = last.state;
  }
  return last;
}

test("aviso al 80 una sola vez", () => {
  const first = evaluateAlerts([weekly(82)], { seven_day: { period: P1, level: 0 } }, opts);
  assert.deepEqual(first.notifications.map(n => n.kind), ["warn"]);
  assert.equal(first.notifications[0].title, "Te acercas al límite");
  assert.equal(first.notifications[0].body, "Llevas 80 % de tu cuota semanal · se reinicia mar 20:00");
  assert.equal(first.notifications[0].urgent, false);
  const again = evaluateAlerts([weekly(85)], first.state, opts);
  assert.deepEqual(again.notifications, []);
});

test("primera lectura ya alta avisa", () => {
  const out = evaluateAlerts([weekly(90)], {}, opts);
  assert.deepEqual(out.notifications.map(n => n.kind), ["warn"]);
});

test("salto 70→97 solo crítico", () => {
  const out = run([[weekly(70)], [weekly(97)]]);
  assert.deepEqual(out.notifications.map(n => n.kind), ["crit"]);
  assert.equal(out.notifications[0].urgent, true);
  assert.equal(out.notifications[0].title, "Casi sin cuota");
  assert.equal(out.notifications[0].body, "Llevas 95 % de tu cuota semanal · se reinicia mar 20:00");
});

test("desfase de 60 s en resets_at es el mismo periodo", () => {
  const jitter = new Date(new Date(P1).getTime() + 60e3).toISOString();
  const out = run([[weekly(85)], [weekly(86, jitter)]]);
  assert.deepEqual(out.notifications, []);
});

test("resets_at null mantiene el periodo", () => {
  const out = run([[weekly(85)], [weekly(86, null)]]);
  assert.deepEqual(out.notifications, []);
  assert.equal(out.state.seven_day.period, P1);
});

test("liberación tras periodo nuevo", () => {
  const out = run([[weekly(90)], [weekly(3, P2)]]);
  assert.deepEqual(out.notifications.map(n => n.kind), ["release"]);
  assert.equal(out.notifications[0].body, "Tu cuota semanal ya está disponible de nuevo");
  assert.equal(out.notifications[0].title, "Cuota disponible");
});

test("periodo vencido con resets_at null cuenta como periodo nuevo", () => {
  // La ventana P1 ya pasó (now es posterior) y la API ya no manda hora de reinicio.
  const later = { ...opts, now: new Date(new Date(P1).getTime() + 5 * 60e3) };
  const out = evaluateAlerts([weekly(0, null)], { seven_day: { period: P1, level: 2 } }, later);
  assert.deepEqual(out.notifications.map(n => n.kind), ["release"]);
  assert.equal(out.state.seven_day.level, 0);
});

test("resets_at null con periodo aún vigente sigue siendo el mismo periodo", () => {
  const out = evaluateAlerts([weekly(86, null)], { seven_day: { period: P1, level: 1 } }, opts);
  assert.deepEqual(out.notifications, []);
  assert.equal(out.state.seven_day.period, P1);
});

test("liberación de la sesión usa su texto", () => {
  const s = (util, resetsAt) => ({ key: "five_hour", label: "Sesión 5 h", util, resetsAt });
  const out = run([[s(96, P1)], [s(0, P2)]]);
  assert.equal(out.notifications[0].body, "Tu sesión de Claude ya está disponible de nuevo");
});

test("sin aviso de liberación si nunca pasó del umbral", () => {
  const out = run([[weekly(40)], [weekly(3, P2)]]);
  assert.deepEqual(out.notifications, []);
});

test("notifyRelease apagado no avisa liberación", () => {
  const out = run([[weekly(90)], [weekly(3, P2)]], { ...opts, notifyRelease: false });
  assert.deepEqual(out.notifications, []);
});

test("util null no avisa ni cambia el estado", () => {
  const prev = { seven_day: { period: P1, level: 1 } };
  const out = evaluateAlerts([weekly(null)], prev, opts);
  assert.deepEqual(out.notifications, []);
  assert.deepEqual(out.state, prev);
});

test("deshabilitado actualiza estado sin notas", () => {
  const out = evaluateAlerts([weekly(90)], {}, { ...opts, enabled: false });
  assert.deepEqual(out.notifications, []);
  assert.equal(out.state.seven_day.level, 1);
});

test("no muta el estado previo", () => {
  const prev = { seven_day: { period: P1, level: 0 } };
  evaluateAlerts([weekly(90)], prev, opts);
  assert.deepEqual(prev, { seven_day: { period: P1, level: 0 } });
});

test("cuota de modelo usa su nombre", () => {
  const out = evaluateAlerts([{ key: "seven_day_sonnet", label: "Sonnet", util: 81, resetsAt: null }], {}, opts);
  assert.equal(out.notifications[0].body, "Llevas 80 % de tu cuota de Sonnet");
});
