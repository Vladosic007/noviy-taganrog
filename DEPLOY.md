# Деплой «Нового Таганрога» — сайт

Полный чек-лист публикации в интернет. Стек: **фронт → Vercel**,
**бэкенд + PostgreSQL → Railway**, домен, HTTPS автоматом.

Всё бесплатно на старте (Vercel Hobby + Railway trial $5 кредита в мес).

---

## 1. Загрузить репо на GitHub (2 минуты)

Локально уже сделаны `git init` и первый коммит.
Осталось создать репозиторий на GitHub и запушить:

```bash
# в GitHub → New repository → приватный, БЕЗ init
# копируешь URL (например git@github.com:nikita/noviy-taganrog.git)
git remote add origin git@github.com:<user>/noviy-taganrog.git
git push -u origin main
```

---

## 2. Бэкенд на Railway (10 минут)

1. Заходишь на [railway.app](https://railway.app), логин через GitHub.
2. **New Project → Deploy from GitHub repo** → выбираешь `noviy-taganrog`.
3. Railway найдёт `api/railway.json` и `api/Dockerfile` — само поймёт что деплоить.
   Если предложит выбрать «root directory» — укажи `api`.
4. Добавляешь Postgres: в проекте → **New → Database → PostgreSQL**.
   Railway автоматически прокинет переменную `DATABASE_URL` в сервис.
5. Открой **api → Variables** и добавь:
   - `CORS_ORIGINS` = `https://<твой-vercel-домен>.vercel.app` *(добавим на шаге 3)*
   - `PORT` = `3001` *(Railway обычно сам, но на всякий случай)*
6. **Settings → Networking → Generate Domain** — получаешь публичный URL
   вида `https://noviy-taganrog-api.up.railway.app`. **Запиши**.
7. Railway автоматически задеплоит и применит миграции.
   Проверь: `curl https://<railway-домен>/api/v1/moderation/count`
   → должен вернуть `{"pending":0}`.

⚠️ **База, фото и PDF на Railway**: Postgres переживает всё,
но `uploads/` и `appeals/` — на эфемерном диске. Для стартовой демки
ок, при активном использовании подключи Railway Volume к `/app/uploads`
и `/app/appeals` (Settings → Volumes).

---

## 3. Фронт на Vercel (5 минут)

1. Заходишь на [vercel.com](https://vercel.com), логин через GitHub.
2. **Add New → Project → Import** → `noviy-taganrog`. **Root Directory:
   оставить как есть** (корень репо).
3. Framework Preset должен определиться как **Vite** автоматически.
4. **Environment Variables** → добавить:
   - `VITE_API_HOST` = `https://<твой-railway-домен>` *(из шага 2.6)*
5. **Deploy**. Vercel соберёт и отдаст URL типа
   `noviy-taganrog.vercel.app`.
6. Скопируй этот URL и обнови в Railway → Variables → `CORS_ORIGINS`.
   Redeploy API (одной кнопкой).

Проверь: открой `https://noviy-taganrog.vercel.app` — карта Таганрога с
маркерами, отправка заявки, PDF-обращение.

---

## 4. Домен (5 минут, после покупки)

1. Купить домен (например `noviy-taganrog.ru`) в Reg.ru / Beget / Timeweb.
2. **Vercel** → Project → Settings → Domains → Add → ввести домен.
   Vercel покажет DNS-записи (обычно A/CNAME) — прописать у регистратора.
3. HTTPS-сертификат Vercel выпустит сам через несколько минут.
4. Обновить `CORS_ORIGINS` в Railway на новый домен (можно оставить оба —
   `https://noviy-taganrog.ru,https://noviy-taganrog.vercel.app`).

---

## 5. Мобильная и VK-версия

**Мобильный сайт** уже работает: колонка 480 px, `viewport-fit=cover`,
`manifest.webmanifest` — на iOS Safari «Поделиться → На экран Домой»
поставит иконку как приложение.

**VK Mini App** позже — тот же React-код обёрнуть в VK Bridge:
- В VK.com/dev создать Mini App, указать URL нашего Vercel-деплоя как
  «Frame URL» — VK-версия готова.
- Кнопка «Войти через ВКонтакте» на профиле подключается через
  `@vkontakte/vk-bridge` (сейчас задизейблена, добавлю по готовности
  VK-app id/secret).

---

## Что нужно от заказчика

- [ ] Аккаунт GitHub (для приёма коллаборации, если ещё нет)
- [ ] Аккаунт Vercel (через GitHub)
- [ ] Аккаунт Railway (через GitHub) + карта для оплаты после trial
- [ ] Домен `.ru`
- [ ] Юрист вычитывает `src/screens/LegalScreen.tsx` (3 черновика: Правила,
      Политика ПД, О сервисе)

Позже:
- [ ] VK App id + secret + твой vk_id (для входа и push-уведомлений)
- [ ] API-ключ геокодера (Яндекс / 2ГИС) для поиска адреса
