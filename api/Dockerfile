# Многостадийная сборка API (NestJS + Prisma).
# 1) deps  — только node_modules (кэшируется, пока не меняется package.json)
# 2) build — компилируем TS + генерируем Prisma client
# 3) runner — минимальный runtime-образ (без dev-зависимостей)

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY tsconfig.json nest-cli.json ./
COPY prisma ./prisma
COPY src ./src
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# sharp нужен для конверсии фото в PDF (WebP→JPEG); на alpine — libvips-совместимая сборка.
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
# Директории для загруженных фото и сформированных PDF — монтируются как volumes.
RUN mkdir -p uploads appeals

EXPOSE 3001
# Перед стартом применяем миграции: schema.prisma → БД.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
