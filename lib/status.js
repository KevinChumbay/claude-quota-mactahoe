// Decide si los datos mostrados están frescos, viejos o no existen, y qué
// mensaje acompaña cada caso. Los datos nunca se borran por un error.
// Módulo puro: sin imports de GNOME, se prueba con node.

import { formatAgo } from "./format.js";

const SESSION_ERRORS = ["expired", "auth"];
const FILE_ERRORS = ["missing", "invalid"];

function noDataBanner(error) {
  if (SESSION_ERRORS.includes(error)) return "La sesión de Claude Code venció — abre claude en una terminal para renovarla.";
  if (FILE_ERRORS.includes(error)) return "No encontré tu sesión de Claude Code. Abre claude en una terminal e inicia sesión.";
  return "Sin conexión con Claude. Reintentando…";
}

function staleBanner(error, ago) {
  if (SESSION_ERRORS.includes(error)) return `Sesión de Claude vencida · datos de ${ago}. Abre claude en una terminal para actualizar.`;
  if (FILE_ERRORS.includes(error)) return `No encontré tu sesión de Claude Code · datos de ${ago}`;
  return `Sin conexión · datos de ${ago}`;
}

// maxAgeMs: antigüedad a partir de la cual los datos se consideran viejos aunque
// no haya error (p. ej. los guardados de ayer al iniciar sesión).
export function computeStatus({ hasData, lastOkMs, failures, lastError, nowMs, maxAgeMs = Infinity }) {
  if (!hasData) {
    if (!lastError) return { mode: "loading", banner: null, ago: "" };
    return { mode: "nodata", banner: noDataBanner(lastError), ago: "" };
  }
  const ago = formatAgo(lastOkMs, nowMs);
  const old = nowMs - lastOkMs > maxAgeMs;
  // Un solo fallo de red se tolera, para que un microcorte no haga parpadear nada,
  // salvo que los datos ya sean viejos.
  const failed = !!lastError && (lastError !== "network" || failures >= 2 || old);
  if (!failed && !old) return { mode: "fresh", banner: null, ago };
  return { mode: "stale", banner: lastError ? staleBanner(lastError, ago) : null, ago };
}
