import { PrismaClient, ProblemStatus } from '@prisma/client';

const prisma = new PrismaClient();

// Стартовый набор категорий (раздел 8.8 ТЗ)
const CATEGORIES = [
  { slug: 'roads', title: 'Дороги и тротуары', icon: '🛣️', color: '#8a9098', sort: 1 },
  { slug: 'light', title: 'Освещение', icon: '💡', color: '#f5a623', sort: 2 },
  { slug: 'trash', title: 'Мусор и свалки', icon: '🗑️', color: '#2e9e5b', sort: 3 },
  { slug: 'utilities', title: 'ЖКХ', icon: '🚰', color: '#0ad1c9', sort: 4 },
  { slug: 'improvement', title: 'Благоустройство', icon: '🌳', color: '#0ba8a2', sort: 5 },
  { slug: 'transport', title: 'Транспорт и остановки', icon: '🚌', color: '#ef4056', sort: 6 },
  { slug: 'danger', title: 'Опасные объекты', icon: '⚠️', color: '#ef4056', sort: 7 },
  { slug: 'animals', title: 'Животные', icon: '🐾', color: '#8a9098', sort: 8 },
  { slug: 'other', title: 'Другое', icon: '➕', color: '#8a9098', sort: 9 },
];

// Демо-проблемы (те же, что были в моках фронта) — теперь живут в БД
const PROBLEMS = [
  { title: 'Разбитая дорога на Петровской, 45', cat: 'roads', address: 'Петровская ул., 45', status: 'found', signatures: 47, occurredOn: '2026-08-12', publishedAt: '2026-08-15', lng: 38.9256, lat: 47.2158, description: 'Дорожное покрытие полностью разрушено на протяжении 30 метров. После дождя ямы заполняются водой.' },
  { title: 'Не горит фонарь у Чехова, 12', cat: 'light', address: 'Чехова ул., 12', status: 'in_progress', signatures: 33, occurredOn: '2026-08-14', publishedAt: '2026-08-16', lng: 38.9312, lat: 47.2205 },
  { title: 'Свалка во дворе Фрунзе, 30', cat: 'trash', address: 'Фрунзе ул., 30', status: 'found', signatures: 12, occurredOn: '2026-08-18', publishedAt: '2026-08-19', lng: 38.9345, lat: 47.2087 },
  { title: 'Отремонтирован тротуар на Ленина, 145', cat: 'roads', address: 'Ленина ул., 145', status: 'resolved', signatures: 120, occurredOn: '2026-07-02', publishedAt: '2026-07-05', resolvedAt: '2026-08-20', lng: 38.8901, lat: 47.2402, description: 'Тротуар был разбит, плитка вздыблена корнями деревьев. После обращения администрация уложила новое покрытие.' },
  { title: 'Сломана лавочка в сквере на Греческой', cat: 'improvement', address: 'Греческая ул., 58', status: 'found', signatures: 8, occurredOn: '2026-08-20', publishedAt: '2026-08-21', lng: 38.933, lat: 47.211 },
  { title: 'Прорыв трубы на Александровской, 88', cat: 'utilities', address: 'Александровская ул., 88', status: 'in_progress', signatures: 68, occurredOn: '2026-08-10', publishedAt: '2026-08-12', lng: 38.9187, lat: 47.2154 },
  { title: 'Открытый люк на Итальянском, 17', cat: 'danger', address: 'Итальянский пер., 17', status: 'found', signatures: 91, occurredOn: '2026-08-22', publishedAt: '2026-08-23', lng: 38.9294, lat: 47.2183 },
  { title: 'Разбита остановка на Сергея Шило', cat: 'transport', address: 'Сергея Шило ул., 202', status: 'found', signatures: 24, occurredOn: '2026-08-19', publishedAt: '2026-08-20', lng: 38.901, lat: 47.2301 },
  { title: 'Заявка не подтвердилась (Дзержинского)', cat: 'roads', address: 'Дзержинского ул., 154', status: 'declined', signatures: 0, occurredOn: '2026-08-05', publishedAt: '2026-08-07', lng: 38.885, lat: 47.2455 },
  { title: 'Стая бездомных собак на Москатова', cat: 'animals', address: 'Москатова ул., 21', status: 'found', signatures: 15, occurredOn: '2026-08-21', publishedAt: '2026-08-22', lng: 38.9401, lat: 47.205 },
  { title: 'Навал мусора на Инструментальной', cat: 'trash', address: 'Инструментальная ул., 5', status: 'in_progress', signatures: 52, occurredOn: '2026-08-11', publishedAt: '2026-08-13', lng: 38.9502, lat: 47.2007 },
  { title: 'Тёмный двор на Большой Бульварной', cat: 'light', address: 'Большая Бульварная ул., 11', status: 'found', signatures: 7, occurredOn: '2026-08-23', publishedAt: '2026-08-24', lng: 38.895, lat: 47.236 },
  { title: 'Яма у Транспортной, 76', cat: 'roads', address: 'Транспортная ул., 76', status: 'found', signatures: 88, occurredOn: '2026-08-16', publishedAt: '2026-08-17', lng: 38.9155, lat: 47.228 },
  { title: 'Восстановлено освещение на Свободы, 9', cat: 'improvement', address: 'Свободы ул., 9', status: 'resolved', signatures: 110, occurredOn: '2026-06-28', publishedAt: '2026-07-01', resolvedAt: '2026-08-15', lng: 38.926, lat: 47.219 },
];

async function main() {
  for (const c of CATEGORIES) {
    await prisma.category.upsert({ where: { slug: c.slug }, update: c, create: c });
  }
  const cats = await prisma.category.findMany();
  const idBySlug = Object.fromEntries(cats.map((c) => [c.slug, c.id]));

  // Идемпотентный сид: чистим и заливаем заново
  await prisma.problem.deleteMany();
  for (const p of PROBLEMS) {
    await prisma.problem.create({
      data: {
        title: p.title,
        description: p.description ?? `${p.title}. Просим городские службы обратить внимание.`,
        categoryId: idBySlug[p.cat],
        lat: p.lat,
        lng: p.lng,
        addressText: p.address,
        status: p.status as ProblemStatus,
        signatureGoal: 100,
        signaturesCount: p.signatures,
        likesCount: Math.round(p.signatures * 1.6),
        occurredOn: new Date(p.occurredOn),
        publishedAt: p.publishedAt ? new Date(p.publishedAt) : new Date(),
        resolvedAt: p.resolvedAt ? new Date(p.resolvedAt) : null,
        isPublished: true,
      },
    });
  }
  console.log(`Сид готов: ${CATEGORIES.length} категорий, ${PROBLEMS.length} проблем.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
