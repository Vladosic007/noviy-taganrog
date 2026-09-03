import { Injectable } from '@nestjs/common';
import { NotificationLog, Prisma, ProblemStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Типы событий, которые пишем в notifications_log.
// Строковые константы, чтобы старые записи не ломались при рефакторинге enum.
export const NOTIF_TYPE = {
  statusChanged: 'problem.status_changed',
  submissionPublished: 'submission.published',
  submissionRejected: 'submission.rejected',
} as const;

const STATUS_TITLES: Record<ProblemStatus, string> = {
  found: 'Найдено',
  in_progress: 'Решается',
  resolved: 'Решено',
  declined: 'Отклонено',
};

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  // Собираем список получателей уведомления о смене статуса проблемы:
  // — все подписчики (subscriptions)
  // — автор исходной заявки (если проблема создана из submission)
  private async recipients(problemId: string): Promise<string[]> {
    const subs = await this.prisma.subscription.findMany({
      where: { problemId },
      select: { userId: true },
    });
    const submissions = await this.prisma.submission.findMany({
      where: { problemId },
      select: { authorId: true },
    });
    const set = new Set<string>();
    for (const s of subs) set.add(s.userId);
    for (const s of submissions) set.add(s.authorId);
    return [...set];
  }

  // Записать уведомления о смене статуса. Статус в notifications_log = 'skipped'
  // до фазы 5 (VK Bridge), потом появится реальная отправка → 'sent' / 'failed'.
  async logStatusChange(params: {
    problemId: string;
    fromStatus: ProblemStatus | null;
    toStatus: ProblemStatus;
    comment?: string | null;
    problemTitle: string;
  }): Promise<number> {
    const userIds = await this.recipients(params.problemId);
    if (userIds.length === 0) return 0;

    const message = `«${params.problemTitle}» — новый статус: ${STATUS_TITLES[params.toStatus]}${
      params.comment ? `. ${params.comment}` : ''
    }`;

    const payload: Prisma.JsonObject = {
      message,
      from: params.fromStatus,
      to: params.toStatus,
      comment: params.comment ?? null,
      problemTitle: params.problemTitle,
    };

    await this.prisma.notificationLog.createMany({
      data: userIds.map((userId) => ({
        userId,
        problemId: params.problemId,
        type: NOTIF_TYPE.statusChanged,
        payload,
        status: 'skipped', // TODO(фаза 5): реальная отправка через VK
      })),
    });
    return userIds.length;
  }

  // Уведомление автору заявки о результате модерации.
  async logSubmissionOutcome(params: {
    userId: string;
    submissionId: string;
    problemId?: string | null;
    kind: 'published' | 'rejected';
    problemTitle?: string | null;
    reason?: string | null;
    comment?: string | null;
  }): Promise<void> {
    const payload: Prisma.JsonObject = {
      submissionId: params.submissionId,
      problemTitle: params.problemTitle ?? null,
      reason: params.reason ?? null,
      comment: params.comment ?? null,
    };
    await this.prisma.notificationLog.create({
      data: {
        userId: params.userId,
        problemId: params.problemId ?? null,
        type: params.kind === 'published' ? NOTIF_TYPE.submissionPublished : NOTIF_TYPE.submissionRejected,
        payload,
        status: 'skipped',
      },
    });
  }

  // Свои уведомления. До VK-авторизации возвращаем ленту «Гостя».
  async listMine(): Promise<NotificationLog[]> {
    const user = await this.prisma.user.upsert({
      where: { vkId: 0n },
      update: {},
      create: { vkId: 0n, firstName: 'Гость', lastName: '' },
    });
    return this.prisma.notificationLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async unreadCount(): Promise<number> {
    const user = await this.prisma.user.upsert({
      where: { vkId: 0n },
      update: {},
      create: { vkId: 0n, firstName: 'Гость', lastName: '' },
    });
    return this.prisma.notificationLog.count({ where: { userId: user.id, read: false } });
  }

  async markAllRead(): Promise<void> {
    const user = await this.prisma.user.upsert({
      where: { vkId: 0n },
      update: {},
      create: { vkId: 0n, firstName: 'Гость', lastName: '' },
    });
    await this.prisma.notificationLog.updateMany({
      where: { userId: user.id, read: false },
      data: { read: true },
    });
  }
}
