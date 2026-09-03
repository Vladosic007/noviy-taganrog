import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProblemStatus, RejectReason } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

interface PublishInput {
  title?: string;
  categorySlug?: string;
  description?: string;
  signatureGoal?: number;
}

interface RejectInput {
  reason: RejectReason;
  comment?: string;
}

interface ChangeStatusInput {
  status: ProblemStatus;
  comment?: string;
}

@Injectable()
export class ModerationService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  // GET /moderation/queue — заявки на проверке, старые первыми (раздел 6.1 ТЗ).
  queue() {
    return this.prisma.submission.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
      include: {
        author: { select: { firstName: true, lastName: true, photoUrl: true } },
        category: true,
        photos: { orderBy: { sort: 'asc' } },
      },
    });
  }

  count() {
    return this.prisma.submission.count({ where: { status: 'pending' } });
  }

  // POST /moderation/submissions/:id/publish — создать проблему из заявки (раздел 9.4).
  async publish(submissionId: string, input: PublishInput) {
    const sub = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: { photos: true, category: true },
    });
    if (!sub) throw new NotFoundException('Заявка не найдена');
    if (sub.status !== 'pending') throw new BadRequestException('Заявка уже обработана');

    // Если модератор сменил категорию — берём её; иначе — из заявки; иначе — «Другое».
    const category = input.categorySlug
      ? await this.prisma.category.findUnique({ where: { slug: input.categorySlug } })
      : sub.category ?? (await this.prisma.category.findUnique({ where: { slug: 'other' } }));
    if (!category) throw new BadRequestException('Категория не найдена');

    // Автозаголовок если не задан — «<Категория> на <адресе>» (раздел 6.1 ТЗ).
    const autoTitle = `${category.title} — ${sub.addressText ?? 'место не указано'}`;
    const title = input.title?.trim() || autoTitle;
    const description = input.description?.trim() || sub.description;

    const problem = await this.prisma.$transaction(async (tx) => {
      const p = await tx.problem.create({
        data: {
          title,
          description,
          categoryId: category.id,
          lat: sub.lat,
          lng: sub.lng,
          addressText: sub.addressText,
          status: 'found' as ProblemStatus,
          signatureGoal: input.signatureGoal ?? 100,
          occurredOn: sub.occurredOn,
          publishedAt: new Date(),
          isPublished: true,
        },
      });

      // Переносим фото заявки в фотографии проблемы (тип 'before').
      if (sub.photos.length) {
        await tx.photo.updateMany({
          where: { submissionId: sub.id },
          data: { problemId: p.id, kind: 'before' },
        });
      }

      await tx.submission.update({
        where: { id: sub.id },
        data: { status: 'published', problemId: p.id, moderatedAt: new Date() },
      });

      await tx.problemStatusHistory.create({
        data: { problemId: p.id, toStatus: 'found', comment: 'Опубликовано из заявки' },
      });

      return p;
    });

    // Уведомления после публикации: автору заявки — «ваша заявка опубликована».
    await this.notifications.logSubmissionOutcome({
      userId: sub.authorId,
      submissionId: sub.id,
      problemId: problem.id,
      kind: 'published',
      problemTitle: problem.title,
    });

    return problem;
  }

  // POST /moderation/problems/:id/photos — добавить фото проблеме (раздел 9.4).
  // kind: 'before' | 'after' — фото «после» обязательно для перехода в «Решено».
  async addPhotos(problemId: string, kind: 'before' | 'after', files: Array<{ filename: string; size: number }>) {
    const problem = await this.prisma.problem.findUnique({ where: { id: problemId } });
    if (!problem) throw new NotFoundException('Проблема не найдена');
    if (!files?.length) throw new BadRequestException('Нужен хотя бы один файл');

    const existing = await this.prisma.photo.count({ where: { problemId } });
    return this.prisma.$transaction(
      files.map((f, i) =>
        this.prisma.photo.create({
          data: { problemId, kind, path: `/uploads/${f.filename}`, bytes: f.size, sort: existing + i },
        }),
      ),
    );
  }

  // POST /moderation/problems/:id/status — сменить статус проблемы (раздел 7.2, 9.4).
  // В «Решено» переходим ТОЛЬКО если у проблемы уже есть хотя бы одно фото «после».
  // В «Решается» и обратно в «Найдено» — обязателен комментарий.
  async changeStatus(problemId: string, input: ChangeStatusInput) {
    const problem = await this.prisma.problem.findUnique({
      where: { id: problemId },
      include: { photos: true },
    });
    if (!problem) throw new NotFoundException('Проблема не найдена');
    if (problem.status === input.status) throw new BadRequestException('Статус не изменился');

    if (input.status === 'resolved') {
      const hasAfter = problem.photos.some((p) => p.kind === 'after');
      if (!hasAfter) {
        throw new BadRequestException('Для перехода в «Решено» нужно загрузить хотя бы одно фото «после».');
      }
    }
    if ((input.status === 'in_progress' || input.status === 'found') && !input.comment?.trim()) {
      throw new BadRequestException('При смене статуса «Решается» или «Найдено» нужен комментарий.');
    }

    const from = problem.status;
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.problem.update({
        where: { id: problemId },
        data: {
          status: input.status,
          statusChangedAt: new Date(),
          resolvedAt: input.status === 'resolved' ? new Date() : problem.resolvedAt,
        },
      });
      await tx.problemStatusHistory.create({
        data: { problemId, fromStatus: from, toStatus: input.status, comment: input.comment ?? null },
      });
      return u;
    });

    // Рассылка уведомлений подписчикам и автору (раздел 7.2 ТЗ).
    await this.notifications.logStatusChange({
      problemId,
      fromStatus: from,
      toStatus: input.status,
      comment: input.comment ?? null,
      problemTitle: problem.title,
    });

    return updated;
  }

  // POST /moderation/submissions/:id/merge — присоединить к существующей проблеме
  // (раздел 6.1 ТЗ, третий вариант действия модератора). Внутри:
  //   1) помечаем заявку как merged, привязываем к problemId
  //   2) переносим фото заявки к проблеме как 'before' (дополнительный ракурс)
  //   3) лайкаем целевую проблему от имени автора заявки — «голос учтён»
  //   4) уведомляем автора
  async merge(submissionId: string, problemId: string) {
    const sub = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: { photos: true },
    });
    if (!sub) throw new NotFoundException('Заявка не найдена');
    if (sub.status !== 'pending') throw new BadRequestException('Заявка уже обработана');
    const problem = await this.prisma.problem.findUnique({ where: { id: problemId } });
    if (!problem || !problem.isPublished) throw new NotFoundException('Проблема не найдена');

    await this.prisma.$transaction(async (tx) => {
      if (sub.photos.length) {
        await tx.photo.updateMany({
          where: { submissionId: sub.id },
          data: { problemId, kind: 'before' },
        });
      }
      await tx.submission.update({
        where: { id: sub.id },
        data: { status: 'merged', problemId, moderatedAt: new Date() },
      });
      // «Голос учтён» — идемпотентный лайк
      const existingLike = await tx.like.findUnique({
        where: { userId_problemId: { userId: sub.authorId, problemId } },
      });
      if (!existingLike) {
        await tx.like.create({ data: { userId: sub.authorId, problemId } });
        await tx.problem.update({ where: { id: problemId }, data: { likesCount: { increment: 1 } } });
      }
    });

    await this.notifications.logSubmissionOutcome({
      userId: sub.authorId,
      submissionId: sub.id,
      problemId,
      kind: 'published',
      problemTitle: problem.title,
      comment: 'Ваша заявка присоединена к существующей проблеме, ваш голос учтён.',
    });

    return { ok: true, problemId };
  }

  // POST /moderation/submissions/:id/reject — отклонить с причиной (раздел 9.4).
  async reject(submissionId: string, input: RejectInput) {
    const sub = await this.prisma.submission.findUnique({ where: { id: submissionId } });
    if (!sub) throw new NotFoundException('Заявка не найдена');
    if (sub.status !== 'pending') throw new BadRequestException('Заявка уже обработана');

    const updated = await this.prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: 'rejected',
        rejectReason: input.reason,
        rejectComment: input.comment ?? null,
        moderatedAt: new Date(),
      },
    });

    await this.notifications.logSubmissionOutcome({
      userId: sub.authorId,
      submissionId: sub.id,
      kind: 'rejected',
      reason: input.reason,
      comment: input.comment,
    });

    return updated;
  }
}
