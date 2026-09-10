# Многостадийная сборка API (NestJS + Prisma).
# 1) deps  — только node_modules (кэшируется, пока не меняется package.json)
# 2) build — компилируем TS + генерируем Prisma client
# 3) runner — минимальный runtime-образ (без dev-зависимостей)
#
# Работает на Render.com, Fly.io, Railway и обычном VPS.
# Render.com сам передаёт переменную PORT — берём её из env, не хардкодим.

FROM node:22-alpine AS deps
WORKDIR /app
# libc6-compat нужен, чтобы sharp и prisma нашли системные библиотеки на alpine.
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
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
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
# Директории для загруженных фото и сформированных PDF.
# На Render.com Free tier они эфемерные — при рестарте контейнера файлы теряются.
# Данные (заявки, проблемы, подписи) при этом остаются в Neon Postgres.
RUN mkdir -p uploads appeals

# Порт задаётся Render.com через env PORT. Локально дефолтимся на 3001.
EXPOSE 3001
# Перед стартом применяем миграции: schema.prisma → БД.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
