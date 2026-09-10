import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Автосидинг категорий при первом запуске API.
// Если в БД уже есть категории — не трогаем (upsert по slug безопасно перезапускать).
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

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly log = new Logger('Seed');

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    try {
      // upsert по slug — идемпотентно. Существующие категории обновляются
      // (порядок сортировки, иконка), новые создаются. Проблемы не трогаем.
      for (const c of CATEGORIES) {
        await this.prisma.category.upsert({
          where: { slug: c.slug },
          update: c,
          create: c,
        });
      }
      this.log.log(`Категории готовы: ${CATEGORIES.length} шт.`);
    } catch (e) {
      this.log.error('Не удалось засеять категории', e);
    }
  }
}
