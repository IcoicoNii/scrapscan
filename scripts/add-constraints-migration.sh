#!/usr/bin/env bash
# Prisma can't express triggers or CHECK constraints in schema.prisma, so they live in
# prisma/db-constraints.sql. This turns that file into a normal migration (once), so
# `prisma migrate dev` / `migrate deploy` apply it everywhere, including Neon.
# Run AFTER the init migration exists, BEFORE the next `prisma migrate dev`.
set -euo pipefail
cd "$(dirname "$0")/.."
if ls prisma/migrations/*_db_constraints >/dev/null 2>&1; then
  echo "db_constraints migration already exists, nothing to do."; exit 0
fi
ts=$(date -u +%Y%m%d%H%M%S)
dir="prisma/migrations/${ts}_db_constraints"
mkdir -p "$dir"
cp prisma/db-constraints.sql "$dir/migration.sql"
echo "Created $dir (now run: npx prisma migrate dev)"
