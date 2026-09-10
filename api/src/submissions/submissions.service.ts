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

type UploadedFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

@Injectable()
export class SubmissionsService {
  constructor(private prisma: PrismaService) {}

  private guestUser() {
    return this.prisma.user.upsert({
      where: { vkId: 0n },
      update: {},
      create: { vkId: 0n, firstName: 'Гость', lastName: '' },
    });
  }

  async create(input: CreateInput, files: UploadedFile[]) {
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

    // Создаём заявку без фото, потом добавляем фото — так path у Photo сможет ссылаться
    // на реальный id (path = /api/v1/photos/<id>/file).
    const submission = await this.prisma.submission.create({
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
      },
    });

    // Кладём бинарник каждого фото прямо в БД (BYTEA).
    for (let i = 0; i < Math.min(files.length, 3); i++) {
      const f = files[i];
      const photo = await this.prisma.photo.create({
        data: {
          submissionId: submission.id,
          data: f.buffer,
          mimeType: f.mimetype,
          bytes: f.size,
          sort: i,
          uploadedById: author.id,
          path: '', // временный, обновим ниже
        },
      });
      await this.prisma.photo.update({
        where: { id: photo.id },
        data: { path: `/api/v1/photos/${photo.id}/file` },
      });
    }

    return this.prisma.submission.findUnique({
      where: { id: submission.id },
      include: {
        category: true,
        photos: { select: { id: true, path: true, kind: true, sort: true, bytes: true } },
      },
    });
  }

  async listMine() {
    const author = await this.guestUser();
    return this.prisma.submission.findMany({
      where: { authorId: author.id },
      orderBy: { createdAt: 'desc' },
      include: {
        category: true,
        photos: { select: { id: true, path: true, kind: true, sort: true, bytes: true } },
        problem: { select: { id: true, status: true, title: true } },
      },
    });
  }
}
