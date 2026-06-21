#!/bin/sh
set -e

# Apply database migrations only where explicitly enabled (the `backend`
# service sets RUN_MIGRATIONS=true). The celery worker/beat containers share
# this image, so gating here keeps them from racing `alembic upgrade head`.
if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  echo "[entrypoint] Applying database migrations (alembic upgrade head)..."
  alembic upgrade head
fi

# Seed demo data on a fresh database only. `--if-empty` makes this a no-op when
# the database already has rows, so restarts never wipe existing data.
if [ "${SEED_ON_START:-false}" = "true" ]; then
  echo "[entrypoint] Seeding database if empty..."
  python -m app.seed --if-empty
fi

exec "$@"
