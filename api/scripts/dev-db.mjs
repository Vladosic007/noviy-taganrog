// Портативный PostgreSQL для локальной разработки — без Docker и прав администратора.
// Первый запуск скачивает бинарник Postgres 17 и инициализирует БД в ./pgdata.
// На проде заменяется на Postgres + PostGIS (Docker/VPS), см. раздел 15 ТЗ.
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';

const PORT = 5433;
const DATA_DIR = './pgdata';
const pg = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  user: 'postgres',
  password: 'postgres',
  port: PORT,
  persistent: true,
  // Система русская → по умолчанию кластер встаёт в WIN1251, где нет эмодзи.
  // Форсируем UTF8, чтобы хранить и кириллицу, и эмодзи-иконки категорий.
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
});

async function main() {
  // PG_VERSION создаётся только успешной initdb — надёжный маркер «БД уже готова».
  const initialised = existsSync(`${DATA_DIR}/PG_VERSION`);
  if (initialised) {
    console.log('pgdata уже инициализирован, пропускаем initdb.');
  } else {
    console.log('Инициализация Postgres (первый раз качает бинарник)…');
    await pg.initialise();
  }
  await pg.start();
  try {
    await pg.createDatabase('taganrog');
    console.log('База "taganrog" создана.');
  } catch {
    console.log('База "taganrog" уже существует — ок.');
  }
  console.log(`Postgres поднят на порту ${PORT}.`);
  console.log(`DATABASE_URL=postgresql://postgres:postgres@localhost:${PORT}/taganrog?schema=public`);

  const stop = async () => {
    await pg.stop();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((e) => {
  console.error('Не удалось поднять Postgres:', e);
  process.exit(1);
});
