#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export PGPASSWORD="DVDVAN2706"

DB_NAME="pos_abarrotera"
DB_HOST="localhost"
DB_USER="postgres"
RESET_DATABASE="${1:-}"

createdb -h "$DB_HOST" -U "$DB_USER" "$DB_NAME" 2>/dev/null || true

if [[ "$RESET_DATABASE" == "--reset" ]]; then
  echo "ADVERTENCIA: reiniciando toda la base de datos..."
  psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$ROOT_DIR/backend/db/schema.sql"
elif [[ "$(psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -Atc "SELECT to_regclass('public.productos') IS NOT NULL;")" == "t" ]]; then
  echo "Base de datos existente: conservando registros."
else
  psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$ROOT_DIR/backend/db/schema.sql"
fi

echo "Base de datos lista: $DB_NAME"
