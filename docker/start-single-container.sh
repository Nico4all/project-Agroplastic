#!/bin/sh
set -eu

MYSQL_DATABASE="${MYSQL_DATABASE:-agroplastic_cashbox}"
APP_DB_USER="${APP_DB_USER:-caja_bodega}"
APP_DB_PASSWORD="${APP_DB_PASSWORD:-caja_bodega_pass}"
MYSQL_SOCKET="${MYSQL_SOCKET:-/run/mysqld/mysqld.sock}"
MYSQL_DATADIR="${MYSQL_DATADIR:-/var/lib/mysql}"

export DATABASE_URL="${DATABASE_URL:-mysql://${APP_DB_USER}:${APP_DB_PASSWORD}@127.0.0.1:3306/${MYSQL_DATABASE}}"

mkdir -p /run/mysqld "$MYSQL_DATADIR"
chown -R mysql:mysql /run/mysqld "$MYSQL_DATADIR"

if [ ! -d "$MYSQL_DATADIR/mysql" ]; then
  mariadb-install-db --user=mysql --datadir="$MYSQL_DATADIR" --skip-test-db >/dev/null
fi

mariadbd \
  --user=mysql \
  --datadir="$MYSQL_DATADIR" \
  --socket="$MYSQL_SOCKET" \
  --bind-address=127.0.0.1 \
  --port=3306 \
  --skip-networking=0 &
DB_PID=$!

cleanup() {
  if [ "${APP_PID:-}" ]; then
    kill "$APP_PID" 2>/dev/null || true
  fi
  kill "$DB_PID" 2>/dev/null || true
  wait "$DB_PID" 2>/dev/null || true
}
trap cleanup INT TERM

tries=0
until mariadb-admin --socket="$MYSQL_SOCKET" --user=root ping >/dev/null 2>&1; do
  tries=$((tries + 1))
  if [ "$tries" -gt 60 ]; then
    echo "MariaDB no inicio a tiempo" >&2
    exit 1
  fi
  sleep 1
done

mariadb --socket="$MYSQL_SOCKET" --user=root <<SQL
CREATE DATABASE IF NOT EXISTS \`${MYSQL_DATABASE}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${APP_DB_USER}'@'127.0.0.1' IDENTIFIED BY '${APP_DB_PASSWORD}';
CREATE USER IF NOT EXISTS '${APP_DB_USER}'@'localhost' IDENTIFIED BY '${APP_DB_PASSWORD}';
ALTER USER '${APP_DB_USER}'@'127.0.0.1' IDENTIFIED BY '${APP_DB_PASSWORD}';
ALTER USER '${APP_DB_USER}'@'localhost' IDENTIFIED BY '${APP_DB_PASSWORD}';
GRANT ALL PRIVILEGES ON \`${MYSQL_DATABASE}\`.* TO '${APP_DB_USER}'@'127.0.0.1';
GRANT ALL PRIVILEGES ON \`${MYSQL_DATABASE}\`.* TO '${APP_DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL

./node_modules/.bin/prisma migrate deploy --schema=/app/prisma/schema.prisma

su -s /bin/sh node -c "node /app/dist/main.js" &
APP_PID=$!
wait "$APP_PID"
