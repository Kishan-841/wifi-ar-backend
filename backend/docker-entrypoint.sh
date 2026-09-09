#!/bin/sh
# Apply pending migrations, then start the API.
# `migrate deploy` only runs migrations that already exist in prisma/migrations;
# it never generates new ones (that is `migrate dev`, a laptop-only command).
set -e

echo "→ applying database migrations"
npx prisma migrate deploy

echo "→ starting API"
exec npx tsx src/index.ts
