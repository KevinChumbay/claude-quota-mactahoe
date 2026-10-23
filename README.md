# Claude Quota MacTahoe

Extensión de GNOME Shell (49–50) que muestra tus cuotas de **Claude Code** en la barra superior, con estilo MacTahoe:

- **Barra:** dos píldoras con relleno (`5h 16%` y `7d 91%`). Al pasar el mouse muestran cuándo se reinician.
- **Menú:** anillos estilo widget de macOS para la sesión de 5 h, la semanal y las cuotas por modelo si tu plan las tiene.
- **Avisos:** notificación al 80 % y urgente al 95 % (configurables), una sola vez por periodo, y otra cuando una cuota se libera.
- **Modo claro/oscuro:** el menú lo sigue automáticamente.

## Seguridad de tu sesión

Solo **lee** `~/.claude/.credentials.json` para obtener el token; nunca lo modifica ni lo renueva. Si el token venció, los datos se muestran atenuados con un aviso hasta que abras `claude` en una terminal (Claude Code lo renueva solo).

## Instalar

```bash
./install.sh
# cerrar sesión y volver a entrar
gnome-extensions enable claude-quota-mactahoe@kevin
```

## Desarrollo

La lógica pura está en `lib/` y se prueba con Node:

```bash
npm test   # node --test
```

`tools/probe.js` consulta la API fuera de GNOME Shell: `gjs -m tools/probe.js`.

## Licencia

GPL-2.0-or-later. Ver [LICENSE](LICENSE).
