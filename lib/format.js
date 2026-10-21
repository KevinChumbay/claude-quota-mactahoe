// Formato de tiempos en español para la barra, el menú y los avisos.
// Módulo puro: sin imports de GNOME, se prueba con node.

const DAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MIN = 60e3;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const pad = n => String(n).padStart(2, "0");

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function remainingText(ms) {
  if (ms < MIN) return "ahora";
  if (ms < HOUR) return `${Math.floor(ms / MIN)} min`;
  if (ms < DAY) return `${Math.floor(ms / HOUR)} h ${Math.floor((ms % HOUR) / MIN)} min`;
  return `${Math.floor(ms / DAY)} d ${Math.floor((ms % DAY) / HOUR)} h`;
}

// clock: para el menú ("02:30" / "mar 20:00"); short: para la píldora
// ("02:30" / "mar 20h"); remaining: tiempo hasta el reinicio.
export function formatReset(resetsAt, now) {
  if (!resetsAt) return { clock: "", short: "", remaining: "" };
  const at = new Date(resetsAt);
  if (isNaN(at)) return { clock: "", short: "", remaining: "" };
  const hm = `${pad(at.getHours())}:${pad(at.getMinutes())}`;
  const remaining = remainingText(at - now);
  if (sameDay(at, now)) return { clock: hm, short: hm, remaining };
  const day = DAYS[at.getDay()];
  return { clock: `${day} ${hm}`, short: `${day} ${at.getHours()}h`, remaining };
}

export function formatAgo(thenMs, nowMs) {
  const ms = Math.max(nowMs - thenMs, 0);
  if (ms < MIN) return "hace un momento";
  if (ms < HOUR) return `hace ${Math.floor(ms / MIN)} min`;
  if (ms < DAY) return `hace ${Math.floor(ms / HOUR)} h`;
  return `hace ${Math.floor(ms / DAY)} d`;
}
