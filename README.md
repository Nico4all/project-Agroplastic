# Caja Bodega

Aplicacion web para registrar ingresos, egresos y pedidos sin inventario por usuarios de bodega, con administracion central de clientes y productos.

## Stack

- Frontend: React, Vite, TypeScript y Tailwind CSS
- Backend: NestJS
- ORM y migraciones: Prisma
- Base de datos: MariaDB
- Proxy de produccion: Nginx
- Auth: JWT de acceso y refresh token en cookie `httpOnly`

## Archivos de entorno

El proyecto usa un archivo distinto por ambiente:

- `.env`: configuracion real de produccion usada por Docker Compose.
- `.env.development`: configuracion local usada por NestJS, Prisma y Vite.
- `.env.example` y `.env.development.example`: plantillas versionadas sin secretos.

Preparacion inicial:

```bash
cp .env.example .env
cp .env.development.example .env.development
```

No se deben subir `.env` ni `.env.development` al repositorio.

## Desarrollo

El desarrollo espera una instancia de MariaDB disponible en `127.0.0.1:3306`. La URL se configura en `.env.development`:

```env
DATABASE_URL="mysql://root:docker@127.0.0.1:3306/agroplastic_cashbox"
```

Instalacion y arranque:

```bash
npm install
npm run install:all
npm run db:generate
npm run db:migrate
npm run dev
```

- Backend/API: `http://localhost:3002/caja-bodega/api`
- Frontend: `http://localhost:3003/caja-bodega/`

Para cargar o sincronizar clientes y productos iniciales:

```bash
npm run prisma:seed --prefix backend
```

## Produccion con Docker Compose

La produccion se divide en tres contenedores:

- `caja-bodega-nginx`: unico servicio publicado en el host, inicialmente por HTTP.
- `caja-bodega-app`: NestJS y el frontend compilado; no publica el puerto 3002.
- `caja-bodega-mariadb`: MariaDB en una red interna; no publica el puerto 3306.

Los datos de MariaDB persisten en el volumen `caja_bodega_mariadb_data`. Un volumen no reemplaza una copia de seguridad.

Antes del primer arranque, completa `.env` con contrasenas y secretos aleatorios. `MARIADB_PASSWORD` debe ser seguro para incluirse en una URL: letras, numeros, punto, guion, guion bajo o virgulilla.

Validar y desplegar:

```bash
docker compose --env-file .env -f docker-compose.prod.yml config
docker compose --env-file .env -f docker-compose.prod.yml up -d --build
docker compose --env-file .env -f docker-compose.prod.yml ps
```

La aplicacion queda disponible en:

```text
http://localhost/caja-bodega/
```

Logs:

```bash
docker compose --env-file .env -f docker-compose.prod.yml logs -f nginx app mariadb
```

Las migraciones de Prisma y el seed idempotente se ejecutan al iniciar el contenedor de la aplicacion, despues de que MariaDB reporta un estado saludable.

## Migracion desde el contenedor monolitico anterior

El volumen anterior contenia los archivos de MariaDB administrados dentro del contenedor de la aplicacion. No debe montarse directamente sobre el nuevo MariaDB sin una migracion controlada.

El procedimiento seguro es:

1. Generar un dump SQL desde el contenedor anterior.
2. Levantar el nuevo servicio MariaDB con un volumen nuevo.
3. Importar el dump en `agroplastic_cashbox`.
4. Ejecutar las migraciones de Prisma.
5. Verificar conteos y acceso antes de retirar el volumen anterior.

Los comandos exactos se deben ejecutar durante la implementacion del servidor, conservando el volumen anterior hasta probar la restauracion.

## HTTPS

La configuracion actual de Nginx deja HTTP listo para pruebas de red. Antes de exponer el sistema a usuarios se agregaran el dominio, certificados TLS y redireccion de HTTP a HTTPS. En produccion las cookies de renovacion son `Secure`, por lo que la operacion real requiere HTTPS.

## Auditoria de dependencias

El backend queda sin vulnerabilidades conocidas en `npm audit --omit=dev`.

El frontend usa React Router 7.18.2. La auditoria actual conserva un aviso alto exclusivo del modo RSC/Server Actions; Caja Bodega es una SPA Vite y no utiliza RSC, SSR ni acciones de servidor, por lo que esa ruta vulnerable no forma parte de la aplicacion. Se debe actualizar React Router cuando exista una version estable que cierre el aviso sin reintroducir los problemas de XSS y redireccion corregidos por 7.18.2.
