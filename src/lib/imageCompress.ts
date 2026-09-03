// Клиентское сжатие фото (ТЗ 11.1). Ресайз до maxSide по длинной стороне, кодирование
// в WebP (fallback → JPEG для старых Safari), качество 0.8. Побочный эффект: canvas
// перерисовывает пиксели заново → EXIF в результирующем файле отсутствует (ТЗ 11.3).
// Не тянем сторонний пакет: 30 строк надёжнее зависимости.

interface CompressOptions {
  maxSide?: number; // по длинной стороне, по умолчанию 1600
  quality?: number; // 0..1, по умолчанию 0.8
}

export async function compressImage(file: File, opts: CompressOptions = {}): Promise<File> {
  const maxSide = opts.maxSide ?? 1600;
  const quality = opts.quality ?? 0.8;

  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return file;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  if ('close' in bitmap) bitmap.close();

  const webp = await canvasToBlob(canvas, 'image/webp', quality);
  if (webp && webp.size < file.size) {
    return new File([webp], swapExt(file.name, 'webp'), { type: 'image/webp', lastModified: Date.now() });
  }
  const jpeg = await canvasToBlob(canvas, 'image/jpeg', quality);
  if (jpeg && jpeg.size < file.size) {
    return new File([jpeg], swapExt(file.name, 'jpg'), { type: 'image/jpeg', lastModified: Date.now() });
  }
  // Ни одна кодировка не оказалась меньше исходника (например, файл уже сильно сжат);
  // всё равно возвращаем перекодированный вариант — так гарантированно нет EXIF.
  const fallback = webp ?? jpeg;
  if (fallback) {
    const ext = fallback.type === 'image/webp' ? 'webp' : 'jpg';
    return new File([fallback], swapExt(file.name, ext), { type: fallback.type, lastModified: Date.now() });
  }
  return file;
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      /* Safari 15 иногда падает — падаем на <img>. */
    }
  }
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));
}

function swapExt(name: string, ext: string): string {
  const base = name.replace(/\.[^./\\]+$/, '');
  return `${base}.${ext}`;
}
