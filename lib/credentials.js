// Extrae el token de acceso del archivo de credenciales de Claude Code.
// Solo interpreta el texto: quien llama lo lee del disco y nunca lo escribe.
// Módulo puro: sin imports de GNOME, se prueba con node.

export function tokenFromCredentials(text, nowMs) {
  if (text == null) return { token: null, expired: false, error: "missing" };
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { token: null, expired: false, error: "invalid" };
  }
  const oauth = data?.claudeAiOauth;
  const token = typeof oauth?.accessToken === "string" && oauth.accessToken ? oauth.accessToken : null;
  if (!token) return { token: null, expired: false, error: "missing" };
  const expired = typeof oauth.expiresAt === "number" && oauth.expiresAt <= nowMs;
  return { token, expired, error: null };
}
