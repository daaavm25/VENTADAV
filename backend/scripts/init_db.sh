#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export PGPASSWORD="1234"

DB_NAME="pos_abarrotera"
DB_HOST="localhost"
DB_USER="postgres"

createdb -h "$DB_HOST" -U "$DB_USER" "$DB_NAME" 2>/dev/null || true
psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f "$ROOT_DIR/backend/db/schema.sql"

echo "Base de datos lista: $DB_NAME"
