#!/bin/bash
# Clona (shallow) las versiones de Odoo Community que OMI necesita introspeccionar.
# Uso: ./clone_odoo.sh
#
# Se ejecuta manualmente o desde un job de CI cuando:
#  - sale una nueva versión de Odoo a soportar
#  - querés refrescar reglas de una versión existente
#
# NO se ejecuta en el backend de producción ni por request de usuario.

set -euo pipefail

VERSIONS=("14.0" "15.0" "16.0" "17.0" "18.0" "19.0")
REPO_URL="https://github.com/odoo/odoo.git"
DEST_DIR="$(dirname "$0")/../odoo_repos"

mkdir -p "$DEST_DIR"

for version in "${VERSIONS[@]}"; do
  target="$DEST_DIR/$version"
  if [ -d "$target" ]; then
    echo "[$version] ya existe en $target, omitiendo clone (borrá la carpeta si querés refrescar)"
    continue
  fi
  echo "[$version] clonando (shallow, solo carpetas de módulos necesarias)..."
  git clone --depth 1 --branch "$version" --single-branch "$REPO_URL" "$target"
done

echo "Listo. Repos disponibles en: $DEST_DIR"
