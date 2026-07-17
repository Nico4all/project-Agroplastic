# Caja Bodega Monolith

Aplicacion web para registrar ingresos, egresos y pedidos sin inventario por usuarios de bodega, con administracion central de clientes y productos.

## Stack

- Frontend: React + Vite + TypeScript + Tailwind CSS
- Backend: NestJS monolitico
- ORM/migraciones: Prisma
- Base de datos: MariaDB embebido en el contenedor de produccion
- Auth: usuario/contrasena, JWT access token y refresh token en cookie httpOnly
- Graficos/exportes: Recharts, Excel compatible `.xls` y PDF simple

## Base de datos

En Docker de produccion la base vive dentro del mismo contenedor y persiste en el volumen `caja_bodega_mysql`. El entrypoint crea la base, crea el usuario de aplicacion y aplica migraciones automaticamente.

Para desarrollo local, si corres Nest fuera de Docker, usa un MariaDB local:

```bash
DATABASE_URL="mysql://root:docker@127.0.0.1:3306/agroplastic_cashbox"
```

En ese caso la base debe existir antes de aplicar migraciones:

```sql
CREATE DATABASE IF NOT EXISTS agroplastic_cashbox CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## Desarrollo

```bash
npm install
npm run install:all
npm run db:generate
npm run db:migrate
npm run dev
```

- Backend/API: http://localhost:3002/caja-bodega/api
- Frontend dev: http://localhost:3003/caja-bodega/
- Monolito Nest: http://localhost:3002/caja-bodega/

El primer login crea el administrador inicial si no existe:

```bash
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin12345
ADMIN_DOCUMENT_SUFFIX=ADMIN
MAX_WAREHOUSE_USERS=4
```

Para cargar los clientes y productos iniciales incluidos en los seeders:

```bash
npm run prisma:seed --prefix backend
```

## Produccion monolitica

```bash
npm run build:monolith
npm run start:prod
```

NestJS sirve el frontend compilado desde `backend/public` bajo `/caja-bodega/`.

## Docker

```bash
cp .env.production.example .env.production
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

El contenedor levanta MariaDB internamente, aplica migraciones y publica:

```bash
http://localhost:3002/caja-bodega/
```

Para ver logs del primer arranque:

```bash
docker logs -f caja-bodega-app
```

El admin inicial se crea en el primer login con `ADMIN_USERNAME` y `ADMIN_PASSWORD` del `.env.production`.
