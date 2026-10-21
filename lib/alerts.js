// Decide qué avisos mandar según las cuotas actuales y lo ya avisado.
// Módulo puro: sin imports de GNOME, se prueba con node.

import { levelFor } from "./levels.js";
import { formatReset } from "./format.js";

const SAME_PERIOD_MS = 120e3;

// Cómo se nombra cada cuota dentro de una frase.
function phraseName(q) {
  if (q.key === "five_hour") return "sesión de 5 h";
  if (q.key === "seven_day") return "cuota semanal";
  return `cuota de ${q.label}`;
}

function releaseBody(q) {
  if (q.key === "five_hour") return "Tu sesión de Claude ya está disponible de nuevo";
  return `Tu ${phraseName(q)} ya está disponible de nuevo`;
}

function samePeriod(prevPeriod, resetsAt) {
  if (resetsAt == null || prevPeriod == null) return true;
  return Math.abs(new Date(resetsAt) - new Date(prevPeriod)) <= SAME_PERIOD_MS;
}

function levelNote(q, level, opts) {
  const pct = level === 2 ? opts.crit : opts.warn;
  const clock = formatReset(q.resetsAt, opts.now).clock;
  const tail = clock ? ` · se reinicia ${clock}` : "";
  return {
    quotaKey: q.key,
    kind: level === 2 ? "crit" : "warn",
    title: level === 2 ? "Casi sin cuota" : "Te acercas al límite",
    body: `Llevas ${pct} % de tu ${phraseName(q)}${tail}`,
    urgent: level === 2,
  };
}

// state[key] = { period: resets_at del periodo, level: nivel ya avisado }.
export function evaluateAlerts(quotas, prevState, opts) {
  const state = { ...prevState };
  const notes = [];
  for (const q of quotas) {
    if (q.util == null) continue;
    const prev = prevState?.[q.key];
    const level = levelFor(q.util, opts.warn, opts.crit);
    if (prev && samePeriod(prev.period, q.resetsAt)) {
      if (level > prev.level) notes.push(levelNote(q, level, opts));
      state[q.key] = { period: q.resetsAt ?? prev.period, level: Math.max(prev.level, level) };
      continue;
    }
    if (prev && prev.level >= 1 && opts.notifyRelease) {
      notes.push({ quotaKey: q.key, kind: "release", title: "Cuota disponible", body: releaseBody(q), urgent: false });
    }
    if (level > 0) notes.push(levelNote(q, level, opts));
    state[q.key] = { period: q.resetsAt, level };
  }
  return { notifications: opts.enabled ? notes : [], state };
}
