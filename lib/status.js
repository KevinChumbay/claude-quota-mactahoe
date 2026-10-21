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

export function computeStatus({ hasData, lastOkMs, failures, lastError, nowMs }) {
  if (!hasData) {
    if (!lastError) return { mode: "loading", banner: null, ago: "" };
    return { mode: "nodata", banner: noDataBanner(lastError), ago: "" };
  }
  const ago = formatAgo(lastOkMs, nowMs);
  // Un solo fallo de red se tolera para que un microcorte no haga parpadear nada.
  const stale = lastError && (lastError !== "network" || failures >= 2);
  if (!stale) return { mode: "fresh", banner: null, ago };
  return { mode: "stale", banner: staleBanner(lastError, ago), ago };
}
