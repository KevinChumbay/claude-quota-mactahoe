# Claude Quota MacTahoe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extensión GNOME Shell 50 `claude-quota-mactahoe@kevin` que muestra las cuotas de Claude Code (sesión 5 h y semanal) con píldoras en la barra, un menú de anillos estilo macOS y avisos, reemplazando a `claude-quota@zeppelinlg`.

**Architecture:** La lógica pura (niveles, formato, parseo, avisos, estado de frescura) vive en `lib/` sin imports `gi://`, y se prueba con `node --test`. La parte GJS (`src/`) hace la E/S (credenciales solo lectura, HTTP con Soup 3) y la UI (St/Clutter, Cairo para anillos). `extension.js` solo crea y destruye el indicador.

**Tech Stack:** GJS 1.88 (ESM), GNOME Shell 50, Soup 3, St/Clutter, Cairo, Adw (prefs), GSettings; pruebas con Node 22 `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-21-claude-quota-mactahoe-design.md` (+ `docs/superpowers/specs/mockups/*.html`)

## Global Constraints

- `metadata.json`: `uuid` `claude-quota-mactahoe@kevin`, `shell-version` `["49", "50"]`, `settings-schema` `org.gnome.shell.extensions.claude-quota-mactahoe`.
- Sin dependencias externas. `lib/*.js` no importa nada de `gi://` ni `resource://`.
- **Nunca escribir** `~/.claude/.credentials.json`; solo leer `claudeAiOauth.accessToken` y `claudeAiOauth.expiresAt` (ms epoch).
- Endpoints: `GET https://api.anthropic.com/api/oauth/usage` y `GET https://api.anthropic.com/api/oauth/profile` con cabeceras `Authorization: Bearer <token>`, `anthropic-version: 2023-06-01`, `anthropic-beta: oauth-2025-04-20`, `Accept: application/json`.
- Colores: normal `#0088FF`, aviso `#F3BA4B`, crítico `#ED5F5D`. Umbrales por defecto 80 / 95.
- Refresco cada 5 min (mín. 1); error de red/429 → reintento 60 s; token vencido/401 → reintento 300 s.
- Todo el texto visible en español (tiempos, avisos, menú).
- Ninguna animación continua; solo las puntuales del spec.
- Estilo de código: JS plano, 2 espacios, comillas dobles (como `mac-widgets@kevin`).
- Comandos `node`/`git` se corren desde la raíz del repo `~/Github/claude-quota-mactahoe`.

## Review Focus

1. `utilization` `null`, negativo o > 100 → la píldora/anillo se dibuja recortado a 0–100, la etiqueta muestra `–` para `null` y el valor real redondeado si pasa de 100 (`104%`); `null` nunca dispara avisos. (Tests en Task 1 y Task 3.)
2. `resets_at` `null` o que llega con segundos de diferencia entre lecturas → se considera el mismo periodo (tolerancia 120 s; `null` = mismo periodo que el anterior), sin avisos repetidos. (Test en Task 3.)
3. Archivo de credenciales ausente, JSON roto o sin `claudeAiOauth` → estado "sin sesión" con mensaje, sin excepción. (Test en Task 2.)
4. Reinicio en el pasado o a menos de 1 min por desfase de reloj → "ahora", nunca tiempos negativos; reinicio a más de 24 h → con día de la semana. (Test en Task 1.)
5. Un solo fallo de red tras datos buenos no atenúa nada; dos fallos seguidos sí; los últimos datos nunca se borran. (Test en Task 4.)

---

### Task 1: Esqueleto del repo, niveles y formato

**Files:**
- Create: `package.json`, `metadata.json`, `schemas/org.gnome.shell.extensions.claude-quota-mactahoe.gschema.xml`, `lib/levels.js`, `lib/format.js`
- Test: `tests/levels.test.js`, `tests/format.test.js`

**Interfaces:**
- Produces:
  - `levelFor(util: number|null, warn: number, crit: number) -> 0|1|2` (0 normal, 1 aviso, 2 crítico; `null` → 0)
  - `colorFor(level: 0|1|2) -> string` (hex del spec)
  - `fraction(util: number|null) -> number` (0..1 recortado)
  - `pctLabel(util: number|null) -> string` (`"10%"`, `"104%"`, `"–"`)
  - `formatReset(resetsAt: string|null, now: Date) -> {clock: string, short: string, remaining: string}`
  - `formatAgo(thenMs: number, nowMs: number) -> string`
- GSettings keys (schema): `refresh-minutes` (u, 5), `warn-threshold` (u, 80), `crit-threshold` (u, 95), `alerts-enabled` (b, true), `notify-release` (b, true), `alert-state` (s, "{}"), `last-data` (s, ""), `last-ok-ms` (x, 0).

- [ ] **Step 1: Escribir los tests que fallan**

`tests/levels.test.js`:
```js
test("niveles", () => {
  assert.equal(levelFor(79.9, 80, 95), 0);
  assert.equal(levelFor(80, 80, 95), 1);
  assert.equal(levelFor(95, 80, 95), 2);
  assert.equal(levelFor(null, 80, 95), 0);
  assert.equal(colorFor(1), "#F3BA4B");
  assert.equal(fraction(140), 1); assert.equal(fraction(-3), 0); assert.equal(fraction(null), 0);
  assert.equal(pctLabel(10.4), "10%"); assert.equal(pctLabel(104), "104%"); assert.equal(pctLabel(null), "–");
});
```
`tests/format.test.js` (con `now = new Date(2026, 9, 21, 0, 33)`, martes):
```js
test("reinicio el mismo día", () => {
  const r = formatReset(new Date(2026, 9, 21, 2, 30).toISOString(), now);
  assert.deepEqual(r, { clock: "02:30", short: "02:30", remaining: "1 h 57 min" });
});
test("reinicio en otro día", () => {
  const r = formatReset(new Date(2026, 9, 27, 20, 0).toISOString(), now);
  assert.deepEqual(r, { clock: "mar 20:00", short: "mar 20h", remaining: "6 d 19 h" });
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
```
Días abreviados: `["dom","lun","mar","mié","jue","vie","sáb"]`; "otro día" = fecha local distinta a `now`. Restante: `< 1 min` → `"ahora"`, `< 1 h` → `"N min"`, `< 24 h` → `"H h M min"`, si no `"D d H h"`.

- [ ] **Step 2:** Run `node --test tests/` → FAIL (módulos no existen).
- [ ] **Step 3:** Crear `package.json` (`{"type":"module","private":true,"scripts":{"test":"node --test tests/"}}`), `metadata.json` (Global Constraints, `name` "Claude Quota MacTahoe", `description` en español, `url` vacío), el schema con las keys de Interfaces, e implementar `lib/levels.js` y `lib/format.js` (hora local, 24 h, `padStart`).
- [ ] **Step 4:** Run `node --test tests/ && glib-compile-schemas --strict --dry-run schemas/` → PASS sin salida de error.
- [ ] **Step 5:** Commit `feat: esqueleto, niveles y formato de tiempos`.

---

### Task 2: Parseo de la API y credenciales

**Files:**
- Create: `lib/usage.js`, `lib/credentials.js`
- Test: `tests/usage.test.js`, `tests/credentials.test.js`

**Interfaces:**
- Produces:
  - `parseUsage(json: object) -> {session: Quota, weekly: Quota, models: Quota[]}` donde `Quota = {key: string, label: string, util: number|null, resetsAt: string|null}`. Keys/labels: `five_hour`/"Sesión 5 h", `seven_day`/"Semanal"; modelos en este orden: `seven_day_opus`/"Opus", `seven_day_sonnet`/"Sonnet", `seven_day_omelette`/"Claude Design", `seven_day_cowork`/"Cowork", `seven_day_oauth_apps`/"Apps OAuth" — solo los presentes con `utilization` no nula.
  - `planFromProfile(profile: object) -> string|null`: `claude_team`→`"TEAM"`, `claude_enterprise`→`"ENTERPRISE"`, `claude_pro` o `account.has_claude_pro`→`"PRO"`, `claude_max` o `account.has_claude_max`→`"MAX"` o `"MAX 5×"`/`"MAX 20×"` si `rate_limit_tier` termina en `_max_(\d+)x`; otro → `null`.
  - `tokenFromCredentials(text: string|null, nowMs: number) -> {token: string|null, expired: boolean, error: "missing"|"invalid"|null}`.

- [ ] **Step 1: Tests que fallan**
```js
test("parseUsage básico y modelos", () => {
  const u = parseUsage({ five_hour: { utilization: 10, resets_at: "2026-10-21T07:30:00Z" },
    seven_day: { utilization: 90, resets_at: "2026-10-28T01:00:00Z" },
    seven_day_opus: { utilization: null }, seven_day_sonnet: { utilization: 40, resets_at: null } });
  assert.equal(u.session.util, 10); assert.equal(u.weekly.label, "Semanal");
  assert.deepEqual(u.models.map(m => m.label), ["Sonnet"]);
});
test("parseUsage tolera campos ausentes", () => {
  const u = parseUsage({});
  assert.equal(u.session.util, null); assert.deepEqual(u.models, []);
});
test("plan", () => {
  assert.equal(planFromProfile({ organization: { organization_type: "claude_team" } }), "TEAM");
  assert.equal(planFromProfile({ organization: { organization_type: "claude_max", rate_limit_tier: "default_claude_max_20x" } }), "MAX 20×");
  assert.equal(planFromProfile({}), null);
});
test("credenciales", () => {
  const ok = JSON.stringify({ claudeAiOauth: { accessToken: "t", expiresAt: 2000 } });
  assert.deepEqual(tokenFromCredentials(ok, 1000), { token: "t", expired: false, error: null });
  assert.equal(tokenFromCredentials(ok, 3000).expired, true);
  assert.equal(tokenFromCredentials(null, 0).error, "missing");
  assert.equal(tokenFromCredentials("{roto", 0).error, "invalid");
  assert.equal(tokenFromCredentials("{}", 0).error, "missing");
});
```
- [ ] **Step 2:** `node --test tests/` → FAIL.
- [ ] **Step 3:** Implementar ambos módulos (`expiresAt` ausente → `expired: false`).
- [ ] **Step 4:** `node --test tests/` → PASS.
- [ ] **Step 5:** Commit `feat: parseo de cuotas, plan y credenciales`.

---

### Task 3: Motor de avisos

**Files:**
- Create: `lib/alerts.js`
- Test: `tests/alerts.test.js`

**Interfaces:**
- Consumes: `levelFor` (Task 1), `Quota` (Task 2), `formatReset` (Task 1).
- Produces: `evaluateAlerts(quotas: Quota[], prevState: object, opts: {warn, crit, enabled, notifyRelease, now: Date}) -> {notifications: Note[], state: object}` con `Note = {quotaKey, kind: "warn"|"crit"|"release", title, body, urgent: boolean}` y `state[quotaKey] = {period: string|null, level: 0|1|2}`.

Reglas (spec, sección Avisos): mismo periodo si ambos `resetsAt` difieren ≤ 120 s o el nuevo es `null`; dentro del periodo solo se avisa si el nivel nuevo > nivel ya avisado, emitiendo **solo el más alto**; periodo nuevo con nivel previo ≥ 1 y `notifyRelease` → `release` (si además el nuevo valor ya está alto, también su aviso); `util null` no cambia nada; `enabled: false` → sin notas pero el estado sí se actualiza.

Textos exactos: título `"Claude Code"`; cuerpo aviso `"Llevas 80 % de tu cuota semanal · se reinicia mar 20:00"` (umbral cruzado, nombre en minúscula: "sesión de 5 h", "cuota semanal", "cuota de Sonnet"…), crítico `"Llevas 95 % de tu …"` con `urgent: true`, liberación `"Tu sesión de Claude ya está disponible de nuevo"` / `"Tu cuota semanal ya está disponible de nuevo"`.

- [ ] **Step 1: Tests que fallan** — `aviso al 80 una sola vez`, `primera lectura ya alta avisa`, `salto 70→97 solo crítico`, `desfase de 60 s en resets_at es el mismo periodo`, `resets_at null mantiene periodo`, `liberación tras periodo nuevo`, `util null no avisa`, `deshabilitado actualiza estado sin notas`. Ejemplo:
```js
test("salto 70→97 solo crítico", () => {
  const q = r => ({ key: "seven_day", label: "Semanal", util: r, resetsAt: "2026-10-28T01:00:00Z" });
  let s = evaluateAlerts([q(70)], {}, opts).state;
  const out = evaluateAlerts([q(97)], s, opts);
  assert.deepEqual(out.notifications.map(n => n.kind), ["crit"]);
  assert.equal(out.notifications[0].urgent, true);
});
```
- [ ] **Step 2:** `node --test tests/alerts.test.js` → FAIL.
- [ ] **Step 3:** Implementar `evaluateAlerts` (estado nuevo como objeto nuevo; no mutar `prevState`).
- [ ] **Step 4:** `node --test tests/` → PASS.
- [ ] **Step 5:** Commit `feat: motor de avisos por periodo`.

---

### Task 4: Estado de frescura (datos viejos)

**Files:**
- Create: `lib/status.js`
- Test: `tests/status.test.js`

**Interfaces:**
- Consumes: `formatAgo` (Task 1).
- Produces: `computeStatus({hasData: boolean, lastOkMs: number, failures: number, lastError: null|"expired"|"auth"|"network"|"missing"|"invalid", nowMs: number}) -> {mode: "loading"|"fresh"|"stale"|"nodata", banner: string|null, ago: string}`.

Reglas: sin datos y sin error → `loading`; sin datos y con error → `nodata` con banner; con datos y `failures <= 1` y error de red → `fresh`; `expired`/`auth` → `stale` inmediato; `network` con `failures >= 2` → `stale`. Banners exactos: vencida `"Sesión de Claude vencida · datos de hace 9 h. Abre claude en una terminal para actualizar."`, red `"Sin conexión · datos de hace 12 min"`, `nodata` vencida `"La sesión de Claude Code venció — abre claude en una terminal para renovarla."`, `missing` `"No encontré tu sesión de Claude Code. Abre claude en una terminal e inicia sesión."`.

- [ ] **Step 1:** Tests `un fallo de red no atenúa`, `dos fallos sí`, `token vencido atenúa al instante`, `sin datos muestra mensaje`, `ago usa formatAgo`.
- [ ] **Step 2:** `node --test tests/status.test.js` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `node --test tests/` → PASS.
- [ ] **Step 5:** Commit `feat: estado de frescura de los datos`.

---

### Task 5: Cliente de red y lectura de credenciales (GJS)

**Files:**
- Create: `src/api.js`, `tools/probe.js`

**Interfaces:**
- Consumes: `tokenFromCredentials`, `parseUsage`, `planFromProfile` (Task 2).
- Produces: `class QuotaClient { constructor(); readToken() -> Promise<{token, expired, error}>; fetchUsage(token) -> Promise<{status: number, data: object|null, retryAfter: number|null}>; fetchProfile(token) -> Promise<string|null>; destroy() }`. Un `Gio.Cancellable` compartido; `destroy()` lo cancela y libera la `Soup.Session`. Errores cancelados se resuelven a `null`/se ignoran, nunca rechazan hacia la UI. Fallos de red se resuelven como `{status: 0, data: null, retryAfter: null}`. Solo para pruebas: si existe la variable de entorno `CQM_USAGE_URL`, se usa en lugar de la URL de uso.

- [ ] **Step 1:** Implementar `src/api.js` con `Gio.File.load_contents_async` (solo lectura) y `Soup.Session.send_and_read_async`; `retryAfter` desde la cabecera `retry-after` (segundos).
- [ ] **Step 2:** `tools/probe.js` (ejecutable con `gjs -m tools/probe.js`) que use `QuotaClient` e imprima `parseUsage(...)` y el plan.
- [ ] **Step 3:** Run `gjs -m tools/probe.js` → imprime sesión/semanal con números reales y `TEAM` (o un error legible si el token venció).
- [ ] **Step 4:** Verificar que el archivo no cambió: `stat -c %Y ~/.claude/.credentials.json` antes y después → mismo valor.
- [ ] **Step 5:** Commit `feat: cliente de la API de cuotas (solo lectura)`.

---

### Task 6: Componentes visuales — píldora y anillo

**Files:**
- Create: `src/ui/pill.js`, `src/ui/ring.js`, `stylesheet.css`

**Interfaces:**
- Consumes: `fraction`, `colorFor`, `pctLabel` (Task 1).
- Produces:
  - `QuotaPill` (`St.Widget` subclase registrada con `GObject.registerClass`): `setQuota({prefix: "5h"|"7d", util, level, resetShort})` (`util === undefined` = cargando: relleno vacío y etiqueta `"…"`), `setStale(stale: boolean)`, `pulse()`. Relleno = `St.Widget` hijo cuyo ancho se anima con `ease()` (~700 ms, `EASE_OUT_QUAD`); color con transición CSS; hover: ancho de ~60 → ~104 px (~350 ms) y aparece `" · " + resetShort`; `pulse()` = 3 ciclos de brillo/sombra roja y para.
  - `QuotaRing` (`St.DrawingArea`, Cairo): `constructor({size: 64|36, width: 7|4})`, `animateTo(util, level)` desde 0 (~550 ms, ease-out cúbico, número central sube a la par), `setValue(util, level)` sin animación, `setStale(b)`.
- CSS: clases `cqm-pill`, `cqm-pill-fill`, `cqm-pill-label`, `cqm-menu`, `cqm-tile`, `cqm-badge`, `cqm-banner`, `cqm-btn`, `cqm-stale` (opacidad 0.5); variantes claro/oscuro con `.cqm-light` en el contenedor del menú.

- [ ] **Step 1:** Implementar ambos componentes y el CSS siguiendo `mockups/animaciones.html` y `mockups/animaciones-pildoras.html` (medidas y colores de ahí).
- [ ] **Step 2:** Verificación visual en una sesión anidada: `dbus-run-session -- gnome-shell --devkit --wayland` con la extensión enlazada en `~/.local/share/gnome-shell/extensions/claude-quota-mactahoe@kevin` (symlink al repo) y un `extension.js` provisional que añada dos píldoras y un anillo a la barra con valores fijos (10 % azul, 90 % ámbar). Esperado: se ven como el mockup B1; hover alarga y muestra hora; anillo se llena al llamar `animateTo`.
- [ ] **Step 3:** Commit `feat: píldora y anillo con animaciones`.

---

### Task 7: Indicador, menú, avisos y ciclo de refresco

**Files:**
- Create: `src/indicator.js`, `src/menu.js`, `src/notifier.js`
- Modify: `extension.js` (reemplaza el provisional de Task 6)

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: `class QuotaIndicator extends PanelMenu.Button` (`constructor(ext: Extension)`, `refresh(): void`, `destroy()`); `buildMenu(menu: PopupMenu) -> MenuView` con `MenuView.update({usage, plan, status, opening: boolean})`; `notify(note: Note)` vía `MessageTray` con fuente "Claude Code" (urgente → `Urgency.CRITICAL`).

Comportamiento (spec): refresco cada `refresh-minutes`; tras éxito guarda `last-data` (JSON del uso parseado) y `last-ok-ms`; al arrancar pinta `last-data` en modo `stale`/`fresh` según `computeStatus`; retries 60 s (red/429, o `retryAfter` si mayor) y 300 s (vencido/401); perfil una vez por sesión; avisos con `evaluateAlerts` persistiendo `alert-state` y **sin** evaluar mientras `mode` ≠ `fresh`; pulso al cruzar a nivel 2; menú M2 (encabezado, insignia, "hace…", banner, dos mosaicos `QuotaRing` 64 px, fila de modelos 36 px solo si hay, pie con `↻ Actualizar` (gira mientras corre), `claude.ai ↗` → `https://claude.ai/settings/usage`, `⚙` → `ext.openPreferences()`); al abrir el menú `animateTo` en los anillos; claro/oscuro según `org.gnome.desktop.interface color-scheme` (clase `cqm-light`). `destroy()` cancela timeouts (`GLib.Source.remove`), el cliente y las señales.

- [ ] **Step 1:** Implementar `notifier.js`, `menu.js`, `indicator.js`, `extension.js`.
- [ ] **Step 2:** Verificar en sesión anidada (como Task 6): datos reales en píldoras; menú con anillos animados; botón actualizar; `claude.ai ↗` abre el navegador.
- [ ] **Step 3:** Verificar avisos forzando umbrales en la sesión anidada: `gsettings --schemadir schemas set org.gnome.shell.extensions.claude-quota-mactahoe warn-threshold 5` → llega un aviso una sola vez; `crit-threshold 6` → aviso urgente y pulso. Restaurar 80/95.
- [ ] **Step 4:** Verificar datos viejos: lanzar la sesión anidada con `CQM_USAGE_URL=https://127.0.0.1:9/usage` (ver Task 5) después de haber guardado `last-data` → al primer fallo nada cambia; al segundo, píldoras atenuadas y banner "Sin conexión · datos de hace…".
- [ ] **Step 5:** Activar/desactivar la extensión 3 veces en la sesión anidada (`gnome-extensions disable/enable`) → sin `JS ERROR` en `journalctl --user -b` ni actores huérfanos.
- [ ] **Step 6:** Commit `feat: indicador, menú de anillos, avisos y refresco`.

---

### Task 8: Preferencias

**Files:**
- Create: `prefs.js`

**Interfaces:**
- Consumes: keys del schema (Task 1).
- Produces: `export default class Prefs extends ExtensionPreferences` con una página Adw: intervalo (1–60 min), umbral de aviso (50–99), umbral crítico (51–100, siempre > aviso), interruptor de avisos, interruptor "avisar cuando se libere".

- [ ] **Step 1:** Implementar con `Adw.SpinRow`/`Adw.SwitchRow` enlazados por `settings.bind`.
- [ ] **Step 2:** `gnome-extensions prefs claude-quota-mactahoe@kevin` en la sesión anidada → la ventana abre y los cambios se reflejan en `gsettings get`.
- [ ] **Step 3:** Commit `feat: preferencias`.

---

### Task 9: Instalación y reemplazo de la extensión vieja

**Files:**
- Create: `install.sh`, `README.md`

**Interfaces:**
- Produces: `./install.sh` compila el schema y crea el symlink `~/.local/share/gnome-shell/extensions/claude-quota-mactahoe@kevin → <repo>`.

- [ ] **Step 1:** Escribir `install.sh` (idempotente; `glib-compile-schemas schemas/`) y `README.md` breve en español (qué es, instalar, que solo lee credenciales).
- [ ] **Step 2:** `node --test tests/` → PASS.
- [ ] **Step 3:** En la sesión real: `./install.sh`; cerrar sesión y volver a entrar (GNOME Shell en Wayland no carga extensiones nuevas sin reiniciar sesión); `gnome-extensions enable claude-quota-mactahoe@kevin`; `gnome-extensions disable claude-quota@zeppelinlg`.
- [ ] **Step 4:** Verificar: `gsettings get org.gnome.shell disable-user-extensions` → `false` (si `true`, ponerlo en `false` y avisar); `gnome-extensions info claude-quota-mactahoe@kevin` → `ACTIVE`; sin `JS ERROR` de la extensión en `journalctl -b /usr/bin/gnome-shell`; captura de Kevin confirmando el aspecto.
- [ ] **Step 5:** Commit `chore: instalador y README`.
