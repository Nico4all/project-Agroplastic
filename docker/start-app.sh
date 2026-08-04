#!/bin/sh
set -eu

echo "Aplicando migraciones de Prisma..."
./node_modules/.bin/prisma migrate deploy --schema=/app/prisma/schema.prisma

if [ "${RUN_DATABASE_SEED:-true}" = "true" ]; then
  echo "Sincronizando datos iniciales..."
  node /app/prisma/seed.js
fi

echo "Iniciando Caja Bodega en el puerto ${PORT:-3002}..."
exec node /app/dist/main.js
