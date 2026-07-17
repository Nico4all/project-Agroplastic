# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS frontend-deps
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci

FROM frontend-deps AS frontend-build
ARG VITE_BASE_PATH=/caja-bodega/
ARG VITE_API_URL=/caja-bodega/api
ENV VITE_BASE_PATH=${VITE_BASE_PATH}
ENV VITE_API_URL=${VITE_API_URL}
COPY frontend ./
RUN npm run build

FROM node:22-bookworm-slim AS backend-deps
WORKDIR /app/backend
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
COPY backend/package*.json ./
RUN npm ci

FROM backend-deps AS backend-build
COPY backend/prisma ./prisma
RUN npx prisma generate
COPY backend ./
COPY --from=frontend-build /app/frontend/dist ./public
RUN npm run build

FROM node:22-bookworm-slim AS backend-prod-deps
WORKDIR /app/backend
ENV NODE_ENV=production
COPY backend/package*.json ./
COPY backend/prisma ./prisma
RUN npm ci && npm cache clean --force

FROM node:22-bookworm-slim AS production
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3002

RUN apt-get update \
  && apt-get install -y --no-install-recommends mariadb-server mariadb-client openssl \
  && rm -rf /var/lib/apt/lists/*

COPY --from=backend-prod-deps --chown=node:node /app/backend/node_modules ./node_modules
COPY --from=backend-build --chown=node:node /app/backend/node_modules/.prisma ./node_modules/.prisma
COPY --from=backend-build --chown=node:node /app/backend/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=backend-build --chown=node:node /app/backend/dist ./dist
COPY --from=backend-build --chown=node:node /app/backend/public ./public
COPY --from=backend-build --chown=node:node /app/backend/prisma ./prisma
COPY docker/start-single-container.sh /usr/local/bin/start-single-container.sh

RUN chmod +x /usr/local/bin/start-single-container.sh

VOLUME ["/var/lib/mysql"]
EXPOSE 3002
CMD ["start-single-container.sh"]
