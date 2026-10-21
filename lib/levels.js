// Niveles de urgencia de una cuota y su representación visual.
// Módulo puro: sin imports de GNOME, se prueba con node.

const COLORS = ["#0088FF", "#F3BA4B", "#ED5F5D"];

// 0 normal, 1 aviso, 2 crítico. Un valor desconocido nunca es urgente.
export function levelFor(util, warn, crit) {
  if (util == null) return 0;
  if (util >= crit) return 2;
  if (util >= warn) return 1;
  return 0;
}

export function colorFor(level) {
  return COLORS[level] ?? COLORS[0];
}

// Cuánto del relleno dibujar. La API puede devolver más de 100 o null.
export function fraction(util) {
  if (util == null) return 0;
  return Math.min(Math.max(util / 100, 0), 1);
}

export function pctLabel(util) {
  return util == null ? "–" : `${Math.round(util)}%`;
}
