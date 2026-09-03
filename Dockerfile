# Многостадийная сборка фронта (Vite).
# Итог — статические файлы в /usr/share/nginx/html через отдельный nginx-контейнер (см. compose).

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json tsconfig.node.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src
# Пробрасываем адрес API в билд Vite (используется в src/lib/config.ts как VITE_API_HOST).
ARG VITE_API_HOST
ENV VITE_API_HOST=$VITE_API_HOST
RUN npm run build

FROM nginx:1.27-alpine AS runner
COPY --from=build /app/dist /usr/share/nginx/html
# SPA-fallback: любой неизвестный маршрут отдаёт index.html — иначе react-router ломается
# при прямом обращении вроде /problem/abc.
RUN printf 'server{listen 80;root /usr/share/nginx/html;location /{try_files $uri /index.html;}}' \
    > /etc/nginx/conf.d/default.conf
EXPOSE 80
