import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CreateInput {
  categorySlug?: string;
  customCategory?: string;
  description: string;
  lat: number;
  lng: number;
  addressText?: string;
  occurredOn?: string;
  isAnonymous?: boolean;
  consentVersion?: string;
}

@Injectable()
export class SubmissionsService {
  constructor(private prisma: PrismaService) {}

  // До VK-авторизации (фаза 5) все заявки привязываем к сервисному пользователю «Гость».
  private guestUser() {
    return this.prisma.user.upsert({
      where: { vkId: 0n },
      update: {},
      create: { vkId: 0n, firstName: 'Гость', lastName: '' },
    });
  }

  async create(input: CreateInput, files: Array<{ filename: string; size: number }>) {
    if (!input.description || input.description.trim().length < 10) {
      throw new BadRequestException('Опишите проблему подробнее — минимум 10 символов.');
    }
    if (!files || files.length === 0) {
      throw new BadRequestException('Добавьте хотя бы одну фотографию.');
    }
    if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) {
      throw new BadRequestException('Не указано место проблемы.');
    }

    const author = await this.guestUser();
    const category = input.categorySlug
      ? await this.prisma.category.findUnique({ where: { slug: input.categorySlug } })
      : null;

    return this.prisma.submission.create({
      data: {
        authorId: author.id,
        categoryId: category?.id ?? null,
        customCategory: input.customCategory ?? null,
        description: input.description.trim(),
        lat: input.lat,
        lng: input.lng,
        addressText: input.addressText ?? null,
        occurredOn: input.occurredOn ? new Date(input.occurredOn) : new Date(),
        isAnonymous: !!input.isAnonymous,
        consentVersion: input.consentVersion ?? 'v1',
        status: 'pending',
        photos: {
          create: files.slice(0, 3).map((f, i) => ({
            // ⚠️ EXIF пока НЕ вычищается (ТЗ 11.3) — обязательно сделать до публичного запуска,
            // иначе координаты из EXIF (домашний адрес) утекут в публичный доступ.
            path: `/uploads/${f.filename}`,
            bytes: f.size,
            sort: i,
            uploadedById: author.id,
          })),
        },
      },
      include: { photos: true, category: true },
    });
  }

  async listMine() {
    const author = await this.guestUser();
    return this.prisma.submission.findMany({
      where: { authorId: author.id },
      orderBy: { createdAt: 'desc' },
      include: {
        category: true,
        photos: true,
        problem: { select: { id: true, status: true, title: true } },
      },
    });
  }
}
