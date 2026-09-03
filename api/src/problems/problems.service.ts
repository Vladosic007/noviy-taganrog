import { Injectable, NotFoundException } from '@nestjs/common';
import { ProblemStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProblemsService {
  constructor(private prisma: PrismaService) {}

  // GET /problems — список с фильтрами (раздел 9.2 ТЗ)
  findAll(params: { status?: ProblemStatus; category?: string }) {
    return this.prisma.problem.findMany({
      where: {
        isPublished: true,
        ...(params.status ? { status: params.status } : {}),
        ...(params.category ? { category: { slug: params.category } } : {}),
      },
      orderBy: { publishedAt: 'desc' },
      include: { category: true },
    });
  }

  // GET /problems/geojson — компактный GeoJSON для карты (раздел 9.2 ТЗ)
  async geojson() {
    const problems = await this.prisma.problem.findMany({
      where: { isPublished: true },
      select: {
        id: true,
        publicId: true,
        status: true,
        signaturesCount: true,
        lat: true,
        lng: true,
        title: true,
        addressText: true,
        category: { select: { slug: true } },
      },
    });
    return {
      type: 'FeatureCollection',
      features: problems.map((p) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: {
          id: p.id,
          publicId: p.publicId,
          status: p.status,
          category: p.category?.slug,
          signatures: p.signaturesCount,
          title: p.title,
          address: p.addressText,
        },
      })),
    };
  }

  // GET /problems/nearby?lat=&lng=&radius=100&category= — проверка дублей перед отправкой
  // (раздел 5.3 ТЗ). Радиус в метрах, по умолчанию 100 м.
  // На проде (PostGIS + geog колонка) считаем в SQL — ST_DWithin + GIST-индекс работают
  // за O(log n). В dev без PostGIS — fallback на формулу Хаверсина в приложении.
  async nearby(lat: number, lng: number, radiusMeters: number, category?: string) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];

    if (await this.postgisAvailable()) {
      return this.nearbyPostgis(lat, lng, radiusMeters, category);
    }
    return this.nearbyHaversine(lat, lng, radiusMeters, category);
  }

  private postgisChecked = false;
  private postgisReady = false;
  private async postgisAvailable(): Promise<boolean> {
    if (this.postgisChecked) return this.postgisReady;
    try {
      const rows = await this.prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
        `SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') AS exists`,
      );
      this.postgisReady = !!rows[0]?.exists;
    } catch {
      this.postgisReady = false;
    }
    this.postgisChecked = true;
    return this.postgisReady;
  }

  private async nearbyPostgis(lat: number, lng: number, radiusMeters: number, category?: string) {
    // Готовим параметризованный запрос — категория опциональна.
    const catFilter = category
      ? `AND EXISTS (SELECT 1 FROM categories c WHERE c.id = p.category_id AND c.slug = $4)`
      : ``;
    const sql = `
      SELECT p.id, p.public_id AS "publicId", p.title, p.status,
             p.lat, p.lng, p.address_text AS "addressText",
             p.signatures_count AS "signaturesCount", p.likes_count AS "likesCount",
             ROUND(ST_Distance(p.geog, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography)::numeric) AS distance,
             c.slug AS category_slug, c.title AS category_title
      FROM problems p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.is_published = true
        AND p.status IN ('found', 'in_progress')
        AND ST_DWithin(p.geog, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, $3)
        ${catFilter}
      ORDER BY distance ASC
      LIMIT 5`;
    const args: unknown[] = [lat, lng, radiusMeters];
    if (category) args.push(category);
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: string;
        publicId: number;
        title: string;
        status: ProblemStatus;
        lat: number;
        lng: number;
        addressText: string | null;
        signaturesCount: number;
        likesCount: number;
        distance: string | number;
        category_slug: string | null;
        category_title: string | null;
      }>
    >(sql, ...args);
    return rows.map((r) => ({
      id: r.id,
      publicId: r.publicId,
      title: r.title,
      status: r.status,
      lat: r.lat,
      lng: r.lng,
      addressText: r.addressText,
      signaturesCount: r.signaturesCount,
      likesCount: r.likesCount,
      distance: Number(r.distance),
      category: r.category_slug ? { slug: r.category_slug, title: r.category_title! } : null,
    }));
  }

  private async nearbyHaversine(lat: number, lng: number, radiusMeters: number, category?: string) {
    const candidates = await this.prisma.problem.findMany({
      where: {
        isPublished: true,
        status: { in: ['found', 'in_progress'] },
        ...(category ? { category: { slug: category } } : {}),
      },
      select: {
        id: true,
        publicId: true,
        title: true,
        status: true,
        lat: true,
        lng: true,
        addressText: true,
        signaturesCount: true,
        likesCount: true,
        category: { select: { slug: true, title: true } },
      },
    });

    const R = 6_371_000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    return candidates
      .map((p) => {
        const dLat = toRad(p.lat - lat);
        const dLng = toRad(p.lng - lng);
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(toRad(lat)) * Math.cos(toRad(p.lat)) * Math.sin(dLng / 2) ** 2;
        const distance = 2 * R * Math.asin(Math.sqrt(a));
        return { ...p, distance: Math.round(distance) };
      })
      .filter((p) => p.distance <= radiusMeters)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5);
  }

  // Поставить/снять лайк «Подтверждаю» (раздел 9.3 ТЗ). Пока пользователь — «Гость».
  async toggleLike(problemId: string) {
    const problem = await this.prisma.problem.findUnique({ where: { id: problemId } });
    if (!problem) throw new NotFoundException('Проблема не найдена');
    const guest = await this.prisma.user.upsert({
      where: { vkId: 0n },
      update: {},
      create: { vkId: 0n, firstName: 'Гость', lastName: '' },
    });
    const existing = await this.prisma.like.findUnique({
      where: { userId_problemId: { userId: guest.id, problemId } },
    });
    return this.prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.like.delete({ where: { userId_problemId: { userId: guest.id, problemId } } });
        const updated = await tx.problem.update({
          where: { id: problemId },
          data: { likesCount: { decrement: 1 } },
        });
        return { liked: false, likesCount: updated.likesCount };
      }
      await tx.like.create({ data: { userId: guest.id, problemId } });
      const updated = await tx.problem.update({
        where: { id: problemId },
        data: { likesCount: { increment: 1 } },
      });
      return { liked: true, likesCount: updated.likesCount };
    });
  }

  // GET /problems/:id — полная карточка (раздел 9.2 ТЗ)
  async findOne(id: string) {
    const problem = await this.prisma.problem.findUnique({
      where: { id },
      include: {
        category: true,
        photos: { orderBy: { sort: 'asc' } },
        statusHistory: { orderBy: { createdAt: 'desc' } },
        createdBy: { select: { firstName: true, lastName: true, photoUrl: true } },
      },
    });
    if (!problem || !problem.isPublished) {
      throw new NotFoundException('Проблема не найдена');
    }
    return problem;
  }
}
