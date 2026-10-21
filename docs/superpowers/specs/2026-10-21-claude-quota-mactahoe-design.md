# Claude Quota MacTahoe — diseño

Fecha: 2026-10-21
UUID previsto: `claude-quota-mactahoe@kevin`
Repo: `~/Github/claude-quota-mactahoe`

## Por qué

Kevin usa Claude Code a diario (plan Team) y vigila sus cuotas con la extensión
`claude-quota@zeppelinlg`. Funciona, pero **no le gusta cómo se ve**: un ícono
naranja con texto plano (`5h 10%→02:30`) que no encaja con su escritorio
MacTahoe (barra translúcida, acento azul, estética macOS). Quiere una extensión
propia, con un diseño que combine con MacTahoe, y que lo avise cuando se acerque
a los límites.

Éxito = la reemplaza por completo: misma información, mejor aspecto, avisos útiles,
y la vieja queda desactivada.

## Objetivos

- Indicador en la barra superior con forma de **dos cápsulas con relleno** (diseño B1).
- Menú desplegable con **dos anillos grandes** estilo widget de macOS (diseño M2).
- **Avisos** al acercarse a los límites y cuando una cuota agotada se libera.
- Estética coherente con MacTahoe y con el modo claro/oscuro del sistema.

## No-objetivos

- No soporta otros proveedores ni API keys de pago por uso: solo la suscripción de Claude Code (OAuth).
- No muestra historial ni gráficos de consumo en el tiempo.
- No es un widget de escritorio (eso ya lo cubre `mac-widgets@kevin`).
- No se publica en extensions.gnome.org en esta versión (puede venir después).

## Anti-objetivos (fallaría aunque "funcione")

- **Escribir o renovar `~/.claude/.credentials.json`.** La extensión vieja renueva
  el token y reescribe ese archivo; si se pisa con Claude Code, puede romper la
  sesión. Esta extensión **solo lee** el archivo. Si el token venció, muestra el
  estado y pide abrir `claude` (que es quien lo renueva).
- Avisos repetidos: el mismo aviso no puede salir dos veces en el mismo periodo
  de la cuota.
- Romper GNOME Shell: errores de red/JSON/credenciales nunca deben lanzar
  excepciones sin capturar ni dejar actores huérfanos al desactivar.

## Restricciones

- GNOME Shell **50** (Wayland, Ubuntu). Declarar `shell-version: ["50"]` (49 opcional).
- GJS, ESM (`import ... from 'gi://...'`), `Soup 3` para HTTP, sin dependencias externas.
- Debe convivir con Blur my Shell y el tema MacTahoe (Light/Dark, translúcido).
- Monitor principal: portátil 1920×1080; a veces hay un segundo monitor.
- Fuente del sistema: Inter Variable.

## Datos (decidido)

Misma fuente que la extensión actual:

- Token: `~/.claude/.credentials.json` → `claudeAiOauth.accessToken`
  (y `claudeAiOauth.expiresAt` para saber si venció sin hacer la petición).
- `GET https://api.anthropic.com/api/oauth/usage` con cabeceras:
  `Authorization: Bearer <token>`, `anthropic-version: 2023-06-01`,
  `anthropic-beta: oauth-2025-04-20`, `Accept: application/json`.
  Respuesta relevante: `five_hour` y `seven_day`, cada uno con `utilization`
  (0–100, puede pasar de 100 o venir `null`) y `resets_at` (ISO 8601).
  Opcionales: `seven_day_opus`, `seven_day_sonnet`, `seven_day_omelette`
  (Claude Design), `seven_day_cowork`, `seven_day_oauth_apps`.
- `GET https://api.anthropic.com/api/oauth/profile` (mismas cabeceras), una vez
  por sesión, para la etiqueta del plan: `organization.organization_type`
  (`claude_team`→TEAM, `claude_enterprise`→ENTERPRISE, `claude_pro`→PRO,
  `claude_max`→MAX, con multiplicador desde `rate_limit_tier` `_max_(\d+)x`).
  Si falla, el menú simplemente no muestra etiqueta.
- La implementación de referencia está en
  `~/.local/share/gnome-shell/extensions/claude-quota@zeppelinlg/` (indicator.js,
  oauth.js) — se puede leer para detalles, pero **no** copiar su lógica de refresh.

Refresco: cada **5 minutos**, más botón "Actualizar". Si el token venció o la
API responde 401: estado de error, reintento cada 5 min (re-leyendo el archivo,
porque Claude Code lo renueva cuando se usa). Error de red: reintento en 60 s.

## Barra superior — B1 (decidido)

Ver `mockups/indicador-barra-v2.html`, opción B1.

- Dos cápsulas lado a lado, ~60 px de ancho y ~20 px de alto, esquinas totalmente redondeadas.
- Fondo de la cápsula: blanco translúcido (~18 %). Relleno desde la izquierda,
  proporcional a la utilización.
- Texto centrado encima del relleno, 11–12 px, seminegrita: `5h 10%` y `7d 90%`.
- Colores del relleno según nivel: normal `#0088FF` (azul MacTahoe), aviso
  `#F3BA4B` (ámbar) desde 80 %, crítico `#ED5F5D` (rojo) desde 95 %.
  Mismos umbrales que los avisos (configurables).
- Texto blanco (la barra MacTahoe es translúcida con texto blanco en ambos modos).
- Estados especiales: cargando la primera vez (cápsulas vacías con `…`);
  dato `null` (`5h –`). Ver "Datos viejos y errores" para el resto.
- **Hover (P1, decidido):** al pasar el mouse, cada cápsula se alarga suavemente
  (~0,35 s) y muestra a la derecha su hora de reinicio: `5h 10% · 02:30`,
  `7d 90% · mar 20h`. Al salir vuelve a su tamaño. Ver
  `mockups/animaciones-pildoras.html`, opción P1.
- Clic: abre el menú.

## Menú desplegable — M2 (decidido)

Ver `mockups/menu-desplegable.html`, opción M2.

- Ancho ~330 px, esquinas ~18 px, fondo translúcido según modo (oscuro: gris
  oscuro ~82 %; claro: casi blanco ~86 %); el difuminado lo da Blur my Shell
  (popup blur estático, ya configurado). Debe seguir el modo claro/oscuro
  automáticamente (`org.gnome.desktop.interface color-scheme`).
- Encabezado: `✳ Claude Code` en negrita + insignia del plan (`TEAM`) a la
  izquierda; `hace 2 min` (última actualización) a la derecha.
- Dos mosaicos lado a lado, cada uno con:
  - anillo grande (~64 px, trazo ~7 px, extremos redondeados) que se llena según
    la utilización, mismo esquema de colores que la barra;
  - porcentaje grande en el centro del anillo;
  - nombre (`Sesión 5 h` / `Semanal`);
  - hora de reinicio + tiempo restante (`02:30 · 1 h 57` / `mar 20:00 · 19 h`).
- Cuotas por modelo (Opus/Sonnet/Claude Design/Cowork/OAuth apps): solo si la API
  las trae con `utilization` no nula; fila de anillos pequeños (~36 px) debajo de
  los mosaicos, con su nombre y %. Si no hay ninguna, la fila no existe.
- Pie: botones redondeados `↻ Actualizar`, `claude.ai ↗` (abre
  `https://claude.ai/settings/usage` en el navegador por defecto) y `⚙`
  (abre preferencias).
- Sin datos todavía (nunca cargó y hay error): mensaje claro en lugar de los
  mosaicos (p. ej. "La sesión de Claude Code venció — abre `claude` en una
  terminal para renovarla").

## Datos viejos y errores (decidido: opción A)

El token de Claude Code dura ~8 h y solo Claude Code lo renueva. Kevin eligió no
renovarlo desde la extensión. Por eso:

- **Nunca se borran los últimos datos conocidos** por un error. Se guardan en
  memoria y también en GSettings (para mostrarlos tras reiniciar sesión).
- Si el token venció / 401 / sin red: las cápsulas y los mosaicos se muestran
  **atenuados (~50 % de opacidad)**; en el menú aparece encima una franja ámbar:
  "⚠ Sesión de Claude vencida · datos de hace 9 h. Abre claude en una terminal
  para actualizar" (o "Sin conexión · datos de hace X min" si es red).
  El encabezado dice "hace 9 h".
- Un microcorte de red no debe hacer parpadear nada: se atenúa solo si el fallo
  dura más que un reintento.
- Ver `mockups/animaciones.html`, botón "Sesión vencida".

## Animaciones (decidido)

Ver `mockups/animaciones.html` (menú) y `mockups/animaciones-pildoras.html` (P1).
Solo animaciones puntuales; **nada que se anime de forma continua** (Kevin está
optimizando el consumo de CPU de GNOME Shell).

1. Al abrir el menú, los anillos se llenan desde 0 hasta su valor (~0,55 s,
   ease-out) y el número del centro sube a la par.
2. Al cambiar un valor, el relleno de la cápsula se desliza al nuevo ancho (~0,7 s).
3. Los cambios de color (azul→ámbar→rojo) son transiciones graduales (~0,6 s).
4. Al cruzar el umbral crítico, la cápsula hace un pulso suave (resplandor rojo)
   **3 veces** y se queda quieta.
5. Mientras se actualiza, el ícono ↻ del botón Actualizar gira.
6. Hover P1 (ver sección de la barra).
7. Menú: aparición con leve escala/opacidad (~0,2 s), como los popups de GNOME.

## Avisos (decidido)

Notificaciones de GNOME (`MessageTray`), con el nombre de la app "Claude Code":

- Al cruzar **80 %** en cualquier cuota mostrada (sesión, semanal o por modelo):
  aviso normal. Ej.: "Llevas 80 % de tu cuota semanal · se reinicia el martes 20:00".
- Al cruzar **95 %**: aviso urgente (se queda hasta cerrarlo).
- Cada aviso sale **una sola vez por periodo** de esa cuota (identificar el
  periodo por su `resets_at`, tolerando desfases de segundos). Persistir el
  **nivel ya avisado por periodo** en GSettings para no repetir tras reiniciar sesión.
- *Decisión del diseñador:* basta con **estar** por encima del umbral sin haber
  avisado en ese periodo (también en la primera lectura al iniciar sesión).
  Si entre dos lecturas se saltan ambos umbrales (70 % → 97 %), sale **solo el
  aviso del nivel más alto**.
- Con datos viejos (token vencido) no se emiten avisos nuevos; al volver los
  datos se evalúan normalmente (incluido "cuota liberada", con retraso).
- **Cuota liberada:** si una cuota había pasado de 80 % y se reinicia (cambia
  `resets_at` y la utilización baja), aviso: "Tu sesión de Claude ya está
  disponible de nuevo" (o "Tu cuota semanal…").
- Umbrales 80/95 configurables en Preferencias; un interruptor para desactivar
  todos los avisos.

## Preferencias

Ventana Adw estándar (`prefs.js`), con: intervalo de actualización (por defecto
5 min, mínimo 1), umbral de aviso (80), umbral crítico (95), activar avisos
(sí), avisar al liberarse (sí).

## Instalación y reemplazo

- Al terminar: instalar en `~/.local/share/gnome-shell/extensions/claude-quota-mactahoe@kevin`
  (symlink o copia desde el repo), activarla y **desactivar** `claude-quota@zeppelinlg`
  (no desinstalarla, por si hay que volver).
- Ojo: activar/desactivar extensiones en esta máquina ya provocó una vez que GNOME
  pusiera `disable-user-extensions=true`; verificar ese valor después.

## Lo que queda al criterio del constructor

- Estructura de archivos, nombres de clases, cómo dibujar anillos (St.DrawingArea
  con Cairo es lo esperable) y cápsulas.
- Formato exacto de tiempos ("en 1 h 57 min" vs "1 h 57"), siempre en español.
- Tamaños finos, sombras y animaciones, mientras respeten los mockups.
- Estrategia de pruebas (lógica pura — umbrales, avisos, formato — en módulos
  testeables fuera de GNOME Shell).
