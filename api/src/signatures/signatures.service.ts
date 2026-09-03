import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface SignInput {
  fullName: string;
  consentTextVersion?: string;
  ip?: string;
  userAgent?: string;
}

// Подписи под обращением (раздел 5.2, 8.6 ТЗ). Юридически значимые — храним всё
// для доказуемости: ФИО, версию текста согласия, время, IP, user-agent.
// Отозванная подпись НЕ удаляется, а помечается `revokedAt` и исключается из счётчика
// (раздел 8.6 ТЗ). Уникальность — (problem, user).
@Injectable()
export class SignaturesService {
  constructor(private prisma: PrismaService) {}

  private guest() {
    return this.prisma.user.upsert({
      where: { vkId: 0n },
      update: {},
      create: { vkId: 0n, firstName: 'Гость', lastName: '' },
    });
  }

  async sign(problemId: string, input: SignInput) {
    const fullName = input.fullName?.trim();
    if (!fullName || fullName.length < 5) {
      throw new BadRequestException('Укажите фамилию, имя и отчество полностью.');
    }
    const problem = await this.prisma.problem.findUnique({ where: { id: problemId } });
    if (!problem) throw new NotFoundException('Проблема не найдена');

    const user = await this.guest();
    const existing = await this.prisma.signature.findUnique({
      where: { problemId_userId: { problemId, userId: user.id } },
    });

    if (existing && !existing.revokedAt) {
      throw new ConflictException('Вы уже подписали это обращение.');
    }

    await this.prisma.$transaction(async (tx) => {
      if (existing) {
        // Была отозвана — восстанавливаем как новую подпись (по требованиям ФЗ-152 —
        // отдельное согласие; фиксируем новый consentedAt).
        await tx.signature.update({
          where: { id: existing.id },
          data: {
            fullName,
            consentTextVersion: input.consentTextVersion ?? 'v1',
            consentedAt: new Date(),
            revokedAt: null,
            ip: input.ip ?? null,
            userAgent: input.userAgent ?? null,
          },
        });
      } else {
        await tx.signature.create({
          data: {
            problemId,
            userId: user.id,
            fullName,
            consentTextVersion: input.consentTextVersion ?? 'v1',
            ip: input.ip ?? null,
            userAgent: input.userAgent ?? null,
          },
        });
      }
      await tx.problem.update({
        where: { id: problemId },
        data: { signaturesCount: { increment: 1 } },
      });
    });
    return this.state(problemId, user.id);
  }

  async revoke(problemId: string) {
    const user = await this.guest();
    const existing = await this.prisma.signature.findUnique({
      where: { problemId_userId: { problemId, userId: user.id } },
    });
    if (!existing || existing.revokedAt) {
      throw new NotFoundException('Подпись не найдена или уже отозвана');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.signature.update({
        where: { id: existing.id },
        data: { revokedAt: new Date() },
      });
      await tx.problem.update({
        where: { id: problemId },
        data: { signaturesCount: { decrement: 1 } },
      });
    });
    return this.state(problemId, user.id);
  }

  async toggleSubscription(problemId: string) {
    const problem = await this.prisma.problem.findUnique({ where: { id: problemId } });
    if (!problem) throw new NotFoundException('Проблема не найдена');
    const user = await this.guest();
    const existing = await this.prisma.subscription.findUnique({
      where: { userId_problemId: { userId: user.id, problemId } },
    });
    if (existing) {
      await this.prisma.subscription.delete({
        where: { userId_problemId: { userId: user.id, problemId } },
      });
      return { subscribed: false };
    }
    await this.prisma.subscription.create({ data: { userId: user.id, problemId } });
    return { subscribed: true };
  }

  // Возвращает текущее состояние подписи и слежения текущего пользователя.
  async state(problemId: string, userIdOverride?: string) {
    const userId = userIdOverride ?? (await this.guest()).id;
    const [sig, sub, problem] = await Promise.all([
      this.prisma.signature.findUnique({ where: { problemId_userId: { problemId, userId } } }),
      this.prisma.subscription.findUnique({ where: { userId_problemId: { userId, problemId } } }),
      this.prisma.problem.findUnique({ where: { id: problemId }, select: { signaturesCount: true } }),
    ]);
    return {
      signed: !!(sig && !sig.revokedAt),
      fullName: sig && !sig.revokedAt ? sig.fullName : null,
      subscribed: !!sub,
      signaturesCount: problem?.signaturesCount ?? 0,
    };
  }
}
