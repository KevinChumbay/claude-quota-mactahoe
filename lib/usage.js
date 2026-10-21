// Interpreta las respuestas de /api/oauth/usage y /api/oauth/profile.
// Módulo puro: sin imports de GNOME, se prueba con node.

const MODELS = [
  ["seven_day_opus", "Opus"],
  ["seven_day_sonnet", "Sonnet"],
  ["seven_day_omelette", "Claude Design"],
  ["seven_day_cowork", "Cowork"],
  ["seven_day_oauth_apps", "Apps OAuth"],
];

function quota(data, key, label) {
  const q = data?.[key];
  return {
    key,
    label,
    util: typeof q?.utilization === "number" ? q.utilization : null,
    resetsAt: q?.resets_at ?? null,
  };
}

export function parseUsage(data) {
  return {
    session: quota(data, "five_hour", "Sesión 5 h"),
    weekly: quota(data, "seven_day", "Semanal"),
    models: MODELS.map(([key, label]) => quota(data, key, label)).filter(q => q.util != null),
  };
}

// Etiqueta corta del plan para la insignia del menú, o null si no se sabe.
export function planFromProfile(profile) {
  const org = profile?.organization;
  const account = profile?.account;
  const type = org?.organization_type;
  if (type === "claude_team") return "TEAM";
  if (type === "claude_enterprise") return "ENTERPRISE";
  if (type === "claude_max" || account?.has_claude_max === true) {
    const tier = /_max_(\d+)x$/.exec(org?.rate_limit_tier ?? "");
    return tier ? `MAX ${tier[1]}×` : "MAX";
  }
  if (type === "claude_pro" || account?.has_claude_pro === true) return "PRO";
  return null;
}
