# Personal Finance Monolith

Aplicacion web multiusuario para gestion financiera personal con React, NestJS, MariaDB y Prisma.

## Stack

- Frontend: React + Vite + TypeScript + Tailwind CSS
- Backend: NestJS monolitico
- ORM/migraciones: Prisma
- Base de datos: MariaDB existente
- Auth: JWT access token + refresh token en cookie httpOnly
- Graficos: Recharts

## Base de datos

Backend local:

```bash
DATABASE_URL="mysql://root:docker@localhost:3306/financial_project"
```

Backend dentro de Docker en la red `apps_mind_net`:

```bash
DATABASE_URL="mysql://root:docker@database:3306/financial_project"
```

La base de datos `financial_project` debe existir en MariaDB. Puedes crearla desde phpMyAdmin o con SQL:

```sql
CREATE DATABASE IF NOT EXISTS financial_project CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## Instalacion

```bash
cp .env.example backend/.env
npm install
npm run install:all
npm run db:generate
npm run db:migrate
```

## Desarrollo

```bash
npm run dev
```

- Backend: http://localhost:3001/caudalia/api
- Frontend dev: http://localhost:5174/caudalia/

## Produccion monolitica

```bash
npm run build:monolith
npm run start:prod
```

NestJS servira el frontend compilado desde `backend/public` bajo `http://localhost:3001/caudalia/`.

## Produccion con Docker

Este compose no crea MariaDB. Usa el servicio existente `database` en la red externa `apps_mind_net`.

```bash
cp .env.production.example .env.production
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

La imagen final solo instala dependencias productivas del backend. El frontend se compila en una etapa intermedia y queda servido por NestJS.

La URL publicada por el contenedor queda bajo subruta:

```bash
http://localhost:3001/caudalia/
```

Antes de levantar una version nueva con migraciones pendientes, ejecuta la migracion desde tu entorno de despliegue:

```bash
cd backend
npm run prisma:migrate
```

## Prueba rapida

1. Registra un usuario.
2. Crea dos cuentas.
3. Crea categorias de ingreso y gasto.
4. Registra ingresos, gastos y transferencias.
5. Revisa dashboard, historicos y exportacion CSV.
