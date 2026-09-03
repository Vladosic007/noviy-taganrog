import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeStreet, streetFromAddress } from '../appeals/street';

// Аналитика для модератора (раздел 6.5 ТЗ). Считаем в приложении, а не в SQL:
// объём данных маленький (сотни-тысячи проблем), запросы простые, PostGIS не нужен.
// При росте до десятков тысяч — вынесем в materialized view.
@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async overview() {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
    const monthAgo = new Date(now.getTime() - 30 * 86_400_000);

    // Заявки — воронка модерации
    const [subTotal, subWeek, subByStatus] = await Promise.all([
      this.prisma.submission.count(),
      this.prisma.submission.count({ where: { createdAt: { gte: weekAgo } } }),
      this.prisma.submission.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
    ]);

    // Проблемы — распределение по статусам и решённые за неделю/месяц
    const [problemsByStatus, resolvedWeek, resolvedMonth] = await Promise.all([
      this.prisma.problem.groupBy({
        by: ['status'],
        where: { isPublished: true },
        _count: { _all: true },
      }),
      this.prisma.problem.count({ where: { status: 'resolved', resolvedAt: { gte: weekAgo } } }),
      this.prisma.problem.count({ where: { status: 'resolved', resolvedAt: { gte: monthAgo } } }),
    ]);

    // Среднее время «found → resolved» по решённым за месяц
    const resolvedRecent = await this.prisma.problem.findMany({
      where: { status: 'resolved', resolvedAt: { gte: monthAgo, not: null }, publishedAt: { not: null } },
      select: { publishedAt: true, resolvedAt: true },
    });
    let avgDaysToResolve: number | null = null;
    if (resolvedRecent.length > 0) {
      const totalMs = resolvedRecent.reduce(
        (s, p) => s + (p.resolvedAt!.getTime() - p.publishedAt!.getTime()),
        0,
      );
      avgDaysToResolve = Math.round((totalMs / resolvedRecent.length / 86_400_000) * 10) / 10;
    }

    // Топ-5 категорий по числу проблем
    const catRows = await this.prisma.problem.groupBy({
      by: ['categoryId'],
      where: { isPublished: true },
      _count: { _all: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });
    const cats = await this.prisma.category.findMany({
      where: { id: { in: catRows.map((r) => r.categoryId) } },
      select: { id: true, title: true, icon: true },
    });
    const catMap = new Map(cats.map((c) => [c.id, c]));
    const topCategories = catRows.map((r) => ({
      title: catMap.get(r.categoryId)?.title ?? '—',
      icon: catMap.get(r.categoryId)?.icon ?? '',
      count: r._count._all,
    }));

    // Топ-5 улиц (агрегация в приложении — как в /moderation/streets, но короче)
    const problems = await this.prisma.problem.findMany({
      where: { isPublished: true },
      select: { addressText: true, signaturesCount: true },
    });
    const streetAgg = new Map<string, { name: string; total: number; signatures: number }>();
    for (const p of problems) {
      const name = streetFromAddress(p.addressText);
      const key = normalizeStreet(name) || name.toLowerCase();
      const b = streetAgg.get(key) ?? { name, total: 0, signatures: 0 };
      b.total += 1;
      b.signatures += p.signaturesCount;
      streetAgg.set(key, b);
    }
    const topStreets = [...streetAgg.values()]
      .sort((a, b) => b.total - a.total || b.signatures - a.signatures)
      .slice(0, 5);

    // Утилита: разложить groupBy → { status: count }
    const bucket = <T extends string>(rows: Array<{ [k: string]: unknown; _count: { _all: number } }>, key: T) =>
      rows.reduce<Record<string, number>>((acc, r) => {
        acc[String(r[key])] = r._count._all;
        return acc;
      }, {});

    return {
      submissions: {
        total: subTotal,
        week: subWeek,
        byStatus: bucket(subByStatus as unknown as Array<{ status: string; _count: { _all: number } }>, 'status'),
      },
      problems: {
        byStatus: bucket(problemsByStatus as unknown as Array<{ status: string; _count: { _all: number } }>, 'status'),
        resolvedWeek,
        resolvedMonth,
        avgDaysToResolve,
      },
      topCategories,
      topStreets,
    };
  }
}
