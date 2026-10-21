#!/bin/bash
# Instala Claude Quota MacTahoe para el usuario actual: compila el schema y
# enlaza el repo en la carpeta de extensiones de GNOME Shell. Idempotente.
set -euo pipefail

REPO="$(cd "$(dirname "$0")" && pwd)"
UUID="claude-quota-mactahoe@kevin"
DEST="${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions/$UUID"

glib-compile-schemas "$REPO/schemas/"
mkdir -p "$(dirname "$DEST")"
if [ -L "$DEST" ] || [ ! -e "$DEST" ]; then
  ln -sfn "$REPO" "$DEST"
else
  echo "Ya existe $DEST y no es un enlace; no lo toco." >&2
  exit 1
fi

echo "Instalada en $DEST"
echo "Cierra sesión y vuelve a entrar, luego: gnome-extensions enable $UUID"
