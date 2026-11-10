#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

export DB_HOST="localhost"
export DB_PORT="5432"
export DB_NAME="pos_abarrotera"
export DB_USER="postgres"
export DB_PASSWORD="1234"

cd "$ROOT_DIR/backend/src"
python3 api.py
