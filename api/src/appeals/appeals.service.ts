import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeStreet, streetFromAddress } from './street';
import { renderAppealPdf } from './pdf';
import { promises as fs } from 'fs';
import { randomUUID } from 'crypto';
import { join } from 'path';

const APPEALS_DIR = join(process.cwd(), 'appeals');

@Injectable()
export class AppealsService {
  constructor(private prisma: PrismaService) {}

  // GET /moderation/streets — сводка по улицам (раздел 6.3 ТЗ).
  // Пока агрегируем по строке улицы, распарсенной из addressText; когда будет
  // OSM-таблица streets, заменим на GROUP BY street_id.
  async streetsSummary() {
    const problems = await this.prisma.problem.findMany({
      where: { isPublished: true },
      select: {
        id: true,
        addressText: true,
        status: true,
        signaturesCount: true,
      },
    });

    type Bucket = {
      key: string;
      name: string;
      total: number;
      found: number;
      inProgress: number;
      resolved: number;
      declined: number;
      signatures: number;
    };
    const map = new Map<string, Bucket>();

    for (const p of problems) {
      const name = streetFromAddress(p.addressText);
      const key = normalizeStreet(name) || name.toLowerCase();
      let b = map.get(key);
      if (!b) {
        b = { key, name, total: 0, found: 0, inProgress: 0, resolved: 0, declined: 0, signatures: 0 };
        map.set(key, b);
      }
      b.total += 1;
      b.signatures += p.signaturesCount;
      if (p.status === 'found') b.found += 1;
      else if (p.status === 'in_progress') b.inProgress += 1;
      else if (p.status === 'resolved') b.resolved += 1;
      else if (p.status === 'declined') b.declined += 1;
    }

    return [...map.values()].sort((a, b) => b.total - a.total || b.signatures - a.signatures);
  }

  // GET /moderation/streets/:key — проблемы одной улицы для выбора в обращение.
  async streetProblems(key: string) {
    const problems = await this.prisma.problem.findMany({
      where: { isPublished: true },
      orderBy: { publishedAt: 'desc' },
      include: { category: true, photos: { orderBy: { sort: 'asc' } } },
    });
    return problems.filter((p) => (normalizeStreet(streetFromAddress(p.addressText)) || '') === key);
  }

  // POST /moderation/appeals — сформировать PDF-обращение (раздел 6.3, 9.4 ТЗ).
  // Возвращает JSON с относительной ссылкой на файл; файл раздаётся статикой /appeals/.
  async createAppeal(streetKey: string, problemIds: string[]) {
    if (!problemIds?.length) throw new BadRequestException('Выберите хотя бы одну проблему');

    const problems = await this.prisma.problem.findMany({
      where: { id: { in: problemIds } },
      include: {
        category: true,
        photos: { orderBy: { sort: 'asc' } },
        signatures: {
          where: { revokedAt: null }, // только активные согласия — ТЗ 6.3, 8.6
          orderBy: { consentedAt: 'asc' },
          select: { fullName: true, consentedAt: true },
        },
      },
    });

    if (!problems.length) throw new BadRequestException('Проблемы не найдены');

    // Название улицы — берём из первой проблемы, чтобы не гадать по ключу.
    const streetName = streetFromAddress(problems[0].addressText);
    const totalSignatures = problems.reduce((s, p) => s + p.signaturesCount, 0);
    const allSignatures = problems.flatMap((p) => p.signatures);

    const pdfBytes = await renderAppealPdf({
      streetName,
      createdAt: new Date(),
      totalProblems: problems.length,
      totalSignatures,
      problems: problems.map((p, i) => ({
        number: i + 1,
        title: p.title,
        category: p.category?.title ?? '—',
        addressText: p.addressText ?? '',
        lat: p.lat,
        lng: p.lng,
        occurredOn: p.occurredOn,
        description: p.description,
        signaturesCount: p.signaturesCount,
        // До 2 фото «before» на проблему — в приложение попадёт визуальный аргумент.
        // path хранит /uploads/<uuid>.<ext>; отдаём как есть, PDF-рендер сам прочитает файл.
        photoPaths: p.photos.filter((x) => x.kind === 'before').slice(0, 2).map((x) => x.path),
      })),
      signatures: allSignatures,
    });

    await fs.mkdir(APPEALS_DIR, { recursive: true });
    const filename = `${new Date().toISOString().slice(0, 10)}_${randomUUID().slice(0, 8)}.pdf`;
    const filepath = join(APPEALS_DIR, filename);
    await fs.writeFile(filepath, pdfBytes);
    const relPath = `/appeals/${filename}`;

    // Запись в БД (ТЗ 8.11): передаём массив UUID и путь к файлу.
    const record = await this.prisma.appeal.create({
      data: {
        problemIds: problems.map((p) => p.id),
        signaturesCount: totalSignatures,
        filePath: relPath,
      },
    });

    // Помечаем подписи как «вошли в обращение» (ТЗ 8.6, поле exported_at).
    if (allSignatures.length > 0) {
      await this.prisma.signature.updateMany({
        where: { problemId: { in: problems.map((p) => p.id) }, revokedAt: null },
        data: { exportedAt: new Date() },
      });
    }

    return { id: record.id, filePath: relPath, totalSignatures, problems: problems.length, streetName };
  }
}
