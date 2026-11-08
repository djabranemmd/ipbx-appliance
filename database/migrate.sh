#!/usr/bin/env bash
# applies every pending .sql file from database/migrations, in name order.
# a file runs inside one transaction together with its bookkeeping row,
# so a failing migration leaves nothing half applied.
set -euo pipefail

cd "$(dirname "$0")"

if [ -f ../.env ]; then
  set -a
  . ../.env
  set +a
fi

CONTAINER="${DB_CONTAINER:-pbx-db}"

run_psql() {
  docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 "$@"
}

run_psql -q -c "CREATE TABLE IF NOT EXISTS schema_migrations (
  filename   text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);"

for file in migrations/*.sql; do
  name=$(basename "$file")
  applied=$(run_psql -tA -c "SELECT 1 FROM schema_migrations WHERE filename = '$name'")

  if [ -n "$applied" ]; then
    echo "skip   $name"
    continue
  fi

  echo "apply  $name"
  {
    echo "BEGIN;"
    cat "$file"
    echo "INSERT INTO schema_migrations (filename) VALUES ('$name');"
    echo "COMMIT;"
  } | run_psql -q
done

echo "done"