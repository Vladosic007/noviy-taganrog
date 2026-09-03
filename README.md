# «Новый Таганрог» — карта городских проблем

VK Mini App и сайт для сбора и решения городских проблем Таганрога. Проект партии «Новые
люди». Полное ТЗ — в файле `TZ_karta_problem_Taganrog_v1.md`.

## Стек

- **Фронт** — React 18 + TypeScript + Vite + MapLibre GL + TanStack Query + zustand
- **Бэкенд** — NestJS 10 + Prisma 5 + PostgreSQL 17 (в проде c PostGIS)
- **Бренд** — палитра и шрифт New People из «Брендбука 2026», логотип партии «Новые люди»

## Что уже работает (сквозной цикл)

Житель → форма подачи → модерация → карта → подписи → PDF-обращение в администрацию.

Подробнее см. память проекта: `~/.claude/projects/C--Users-User-Desktop-problema/memory/taganrog-map-project.md`.

## Разработка (Windows / macOS / Linux)

Работает без Docker — используется `embedded-postgres` (портативный Postgres 17).

```bash
# 1) Фронт
npm install
npm run dev              # → http://localhost:5173

# 2) Бэкенд (в отдельном терминале)
cd api
npm install
npm run dev:db           # поднимает Postgres на :5433, применяет миграции, сидит категории
npm run start:dev        # → http://localhost:3001
```

**PostGIS в dev нет** — миграция `20260902100000_enable_postgis` попытается создать
расширение и упадёт. Prisma в dev выполняет только неприменённые миграции; если такая
проблема — пометьте миграцию применённой руками:

```sql
INSERT INTO _prisma_migrations (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
VALUES (gen_random_uuid(), '', '20260902100000_enable_postgis', now(), now(), 0);
```

Сервис `problems.nearby` сам определит отсутствие PostGIS и переключится на fallback
формулу Хаверсина.

## Продакшн-развёртывание

Один шаг на боевом VPS (Ubuntu / любой Linux с Docker):

```bash
git clone <repo> && cd noviy-taganrog
cp .env.example .env
$EDITOR .env             # заполнить POSTGRES_PASSWORD, VK_APP_ID/SECRET, PUBLIC_ORIGIN
docker compose -f docker-compose.prod.yml up -d --build
```

Стек:

- **db** — PostgreSQL 17 + PostGIS (образ `postgis/postgis:17-3.5-alpine`)
- **api** — NestJS в prod-режиме
- **web** — статичный билд Vite
- **nginx** — reverse-proxy на порту 80

Волюмы `pgdata`, `uploads`, `appeals` переживают перезапуск.

HTTPS: обёрните в Caddy/Traefik/certbot — рекомендую Caddy, у него автоматический
Let's Encrypt. Пример:

```
noviy-taganrog.ru {
  reverse_proxy nginx:80
}
```

## Что нужно от заказчика перед боевым запуском

**Обязательно:**

- `POSTGRES_PASSWORD` — длинный случайный пароль для БД
- `VK_APP_ID` + `VK_APP_SECRET` — из vk.com/dev
- `VK_SUPERADMIN_ID` — ваш vk_id (станет суперадмином при первом входе)
- Домен и HTTPS-сертификат
- **Юр-документы:** тексты `src/screens/LegalScreen.tsx` (Правила / Политика ПД / О сервисе)
  сейчас `v1-draft` — обязательно вычитать у юриста до публичного запуска
- Макет обращения от юриста — сейчас PDF формируется по шаблону в
  `api/src/appeals/pdf.ts`, дизайн можно править

**Опционально:**

- API-ключ геокодера (Яндекс.Карты / 2GIS) — для полноценного поиска адреса
- Свои PMTiles Таганрога с брендовым стилем — сейчас OSM raster с CSS-инвертом для тёмной темы

## Полезные ссылки внутри проекта

- ТЗ: `TZ_karta_problem_Taganrog_v1.md`
- Брендбук: `Брендбук 2026.pdf`
- Ассеты бренда: `public/logo-teal.svg`, `public/fonts/`
- Компонент бренда в UI: `src/styles/tokens.css`
