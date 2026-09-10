import { PDFDocument, PDFFont, PDFImage, PDFPage, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { promises as fs } from 'fs';
import { join } from 'path';
import sharp from 'sharp';

interface ProblemLine {
  number: number;
  title: string;
  category: string;
  addressText: string;
  lat: number;
  lng: number;
  occurredOn: Date | null;
  description: string;
  signaturesCount: number;
  photoPaths: string[]; // относительные пути (/uploads/<uuid>.ext)
}

export interface AppealInput {
  streetName: string;
  createdAt: Date;
  totalProblems: number;
  totalSignatures: number;
  problems: ProblemLine[];
  signatures: { fullName: string; consentedAt: Date }[];
}

// Файлы шрифта лежат в /public/fonts на фронте — переиспользуем оттуда, чтобы не дублировать.
const FONT_DIR = join(process.cwd(), '..', 'public', 'fonts');
const brand = rgb(0x0a / 255, 0xd1 / 255, 0xc9 / 255);
const brandDark = rgb(0x0b / 255, 0xa8 / 255, 0xa2 / 255);
const ink = rgb(0.06, 0.09, 0.1);
const muted = rgb(0.36, 0.4, 0.42);

const MARGIN = 48;
const PAGE_W = 595; // A4 portrait
const PAGE_H = 842;
const CONTENT_W = PAGE_W - MARGIN * 2;

export async function renderAppealPdf(input: AppealInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  const [regular, bold] = await Promise.all([
    fs.readFile(join(FONT_DIR, 'NewPeople-Regular.ttf')),
    fs.readFile(join(FONT_DIR, 'NewPeople-Bold.ttf')),
  ]);
  const fontRegular = await doc.embedFont(regular, { subset: true });
  const fontBold = await doc.embedFont(bold, { subset: true });

  const ctx: RenderCtx = { doc, page: doc.addPage([PAGE_W, PAGE_H]), y: PAGE_H - MARGIN, fontRegular, fontBold };

  // Шапка
  drawHeader(ctx, input);

  // Заголовок обращения
  moveDown(ctx, 40);
  drawText(ctx, `Обращение по улице «${input.streetName}»`, { font: fontBold, size: 18, color: ink });
  moveDown(ctx, 20);
  drawText(
    ctx,
    `Проблем в обращении: ${input.totalProblems}. Всего подписей: ${input.totalSignatures}.`,
    { font: fontRegular, size: 11, color: muted },
  );

  // Перечень проблем
  moveDown(ctx, 32);
  drawText(ctx, 'Перечень проблем', { font: fontBold, size: 13, color: brandDark });
  moveDown(ctx, 8);
  drawRule(ctx, brand, 1.2);
  moveDown(ctx, 18);

  for (const p of input.problems) {
    ensureSpace(ctx, 260);
    await drawProblem(ctx, p);
    moveDown(ctx, 18);
  }

  // Приложение: подписи
  moveDown(ctx, 10);
  ensureSpace(ctx, 80);
  drawText(ctx, 'Приложение: список подписавшихся', { font: fontBold, size: 13, color: brandDark });
  moveDown(ctx, 8);
  drawRule(ctx, brand, 1.2);
  moveDown(ctx, 18);

  if (input.signatures.length === 0) {
    drawText(ctx, 'Подписи с активным согласием отсутствуют.', { font: fontRegular, size: 11, color: muted });
  } else {
    for (const [i, s] of input.signatures.entries()) {
      ensureSpace(ctx, 16);
      drawText(
        ctx,
        `${i + 1}. ${s.fullName} — ${s.consentedAt.toLocaleDateString('ru-RU')}`,
        { font: fontRegular, size: 11, color: ink },
      );
      moveDown(ctx, 15);
    }
  }

  // Подвал на каждой странице
  const totalPages = doc.getPageCount();
  for (let i = 0; i < totalPages; i++) {
    const page = doc.getPage(i);
    drawFooter(page, fontRegular, i + 1, totalPages);
  }

  return doc.save();
}

interface RenderCtx {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  fontRegular: PDFFont;
  fontBold: PDFFont;
}

function drawHeader(ctx: RenderCtx, input: AppealInput) {
  // Бирюзовая полоса-акцент
  ctx.page.drawRectangle({ x: 0, y: PAGE_H - 8, width: PAGE_W, height: 8, color: brand });
  const created = input.createdAt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  drawText(ctx, 'ПАРТИЯ НОВЫЕ ЛЮДИ', { font: ctx.fontBold, size: 10, color: brandDark });
  ctx.page.drawText(created, {
    x: PAGE_W - MARGIN - ctx.fontRegular.widthOfTextAtSize(created, 10),
    y: ctx.y,
    size: 10,
    font: ctx.fontRegular,
    color: muted,
  });
  moveDown(ctx, 14);
  drawText(ctx, 'Карта городских проблем Таганрога', { font: ctx.fontRegular, size: 9, color: muted });
}

async function drawProblem(ctx: RenderCtx, p: ProblemLine) {
  drawText(ctx, `${p.number}. ${p.title}`, { font: ctx.fontBold, size: 12, color: ink });
  moveDown(ctx, 16);
  const meta = `${p.category} — ${p.addressText} — ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
  drawText(ctx, meta, { font: ctx.fontRegular, size: 10, color: muted });
  moveDown(ctx, 13);
  const dateLine = `Обнаружено: ${p.occurredOn ? p.occurredOn.toLocaleDateString('ru-RU') : '—'} — Подписей: ${p.signaturesCount}`;
  drawText(ctx, dateLine, { font: ctx.fontRegular, size: 10, color: muted });
  moveDown(ctx, 16);
  drawWrapped(ctx, p.description, { font: ctx.fontRegular, size: 11, color: ink, lineHeight: 14 });

  // Фотографии-доказательства (раздел 6.3 ТЗ, критерий приёмки 18).
  if (p.photoPaths.length > 0) {
    moveDown(ctx, 8);
    await drawPhotos(ctx, p.photoPaths);
  }
}

// Кладём до 2 фото в ряд, каждое ~ (CONTENT_W - gap) / 2 в ширину, высота — от пропорций.
// WebP не поддерживается pdf-lib, поэтому все нестандартные форматы прогоняем через sharp
// в JPEG. Битые файлы просто пропускаем, чтобы обращение всё равно сформировалось.
async function drawPhotos(ctx: RenderCtx, paths: string[]) {
  const gap = 10;
  const maxCols = 2;
  const cellW = (CONTENT_W - gap * (maxCols - 1)) / maxCols;
  const maxCellH = 180;

  const images: { img: PDFImage; w: number; h: number }[] = [];
  for (const rel of paths.slice(0, maxCols)) {
    try {
      const abs = join(process.cwd(), rel.replace(/^\//, ''));
      const buf = await fs.readFile(abs);
      const jpeg = await sharp(buf).rotate().jpeg({ quality: 82 }).toBuffer();
      const img = await ctx.doc.embedJpg(jpeg);
      images.push({ img, w: img.width, h: img.height });
    } catch {
      /* пропускаем битый файл */
    }
  }
  if (images.length === 0) return;

  // Одинаковая высота на всех фото в ряду — по наименьшему масштабу.
  const scales = images.map((it) => Math.min(cellW / it.w, maxCellH / it.h));
  const rowH = Math.max(...images.map((it, i) => it.h * scales[i]));
  ensureSpace(ctx, rowH + 6);
  const rowTopY = ctx.y;
  images.forEach((it, i) => {
    const w = it.w * scales[i];
    const h = it.h * scales[i];
    const x = MARGIN + i * (cellW + gap);
    ctx.page.drawImage(it.img, { x, y: rowTopY - h, width: w, height: h });
  });
  moveDown(ctx, rowH);
}

function drawFooter(page: PDFPage, font: PDFFont, pageNum: number, total: number) {
  const contact = 'Команда «Новый Таганрог» — noviy-taganrog.ru';
  const nums = `${pageNum} / ${total}`;
  page.drawText(contact, { x: MARGIN, y: 24, size: 9, font, color: muted });
  page.drawText(nums, {
    x: PAGE_W - MARGIN - font.widthOfTextAtSize(nums, 9),
    y: 24,
    size: 9,
    font,
    color: muted,
  });
}

interface DrawOpts {
  font: PDFFont;
  size: number;
  color: ReturnType<typeof rgb>;
  lineHeight?: number;
}

function drawText(ctx: RenderCtx, text: string, opts: DrawOpts) {
  ctx.page.drawText(text, { x: MARGIN, y: ctx.y, size: opts.size, font: opts.font, color: opts.color });
}

function drawWrapped(ctx: RenderCtx, text: string, opts: DrawOpts) {
  const lineH = opts.lineHeight ?? opts.size + 3;
  const words = text.split(/\s+/);
  let line = '';
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    const width = opts.font.widthOfTextAtSize(candidate, opts.size);
    if (width > CONTENT_W && line) {
      ensureSpace(ctx, lineH);
      drawText(ctx, line, opts);
      moveDown(ctx, lineH);
      line = w;
    } else {
      line = candidate;
    }
  }
  if (line) {
    ensureSpace(ctx, lineH);
    drawText(ctx, line, opts);
    moveDown(ctx, lineH);
  }
}

function drawRule(ctx: RenderCtx, color: ReturnType<typeof rgb>, thickness = 1) {
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y },
    end: { x: PAGE_W - MARGIN, y: ctx.y },
    thickness,
    color,
  });
}

function moveDown(ctx: RenderCtx, dy: number) {
  ctx.y -= dy;
}

function ensureSpace(ctx: RenderCtx, needed: number) {
  if (ctx.y - needed < MARGIN + 30) {
    ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H]);
    ctx.y = PAGE_H - MARGIN;
  }
}
