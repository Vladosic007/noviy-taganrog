// Минимальный EXIF-парсер: достаём только GPS-координаты (широту и долготу) первого
// APP1-сегмента в JPEG. Нужен для подсказки места (ТЗ 5.3, 💡): «Похоже, снято на …».
// Никаких сторонних библиотек не тянем: маленький и специализированный код надёжнее.

interface GPSResult {
  lat: number;
  lng: number;
}

// Разбираем JPEG-заголовок и достаём offset+ByteOrder EXIF-блока.
// Возвращаем null, если это не JPEG или EXIF отсутствует.
export async function readExifGps(file: File): Promise<GPSResult | null> {
  if (!/^image\/jpe?g$/i.test(file.type)) return null;
  const buf = await file.slice(0, Math.min(file.size, 128 * 1024)).arrayBuffer();
  const view = new DataView(buf);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null; // SOI

  let offset = 2;
  while (offset < view.byteLength - 4) {
    const marker = view.getUint16(offset);
    offset += 2;
    if (marker === 0xffe1) {
      const size = view.getUint16(offset);
      offset += 2;
      if (view.byteLength < offset + 6) return null;
      // «Exif\0\0»
      if (
        view.getUint8(offset) !== 0x45 ||
        view.getUint8(offset + 1) !== 0x78 ||
        view.getUint8(offset + 2) !== 0x69 ||
        view.getUint8(offset + 3) !== 0x66
      ) {
        offset += size - 2;
        continue;
      }
      const tiffStart = offset + 6;
      return parseTiffGps(view, tiffStart);
    }
    // Пропускаем остальные сегменты
    if (marker >= 0xffe0 && marker <= 0xffef) {
      const size = view.getUint16(offset);
      offset += size;
    } else {
      break;
    }
  }
  return null;
}

function parseTiffGps(view: DataView, tiffStart: number): GPSResult | null {
  if (view.byteLength < tiffStart + 8) return null;
  const byteOrder = view.getUint16(tiffStart);
  const little = byteOrder === 0x4949;
  if (!little && byteOrder !== 0x4d4d) return null;

  const read16 = (o: number) => view.getUint16(o, little);
  const read32 = (o: number) => view.getUint32(o, little);
  if (read16(tiffStart + 2) !== 0x002a) return null;

  const ifd0Offset = tiffStart + read32(tiffStart + 4);
  const entryCount = read16(ifd0Offset);
  let gpsIfdOffset = 0;
  for (let i = 0; i < entryCount; i++) {
    const entry = ifd0Offset + 2 + i * 12;
    const tag = read16(entry);
    if (tag === 0x8825) {
      gpsIfdOffset = tiffStart + read32(entry + 8);
      break;
    }
  }
  if (!gpsIfdOffset) return null;

  const gpsCount = read16(gpsIfdOffset);
  let latRef = 'N';
  let lngRef = 'E';
  let latRational: [number, number, number] | null = null;
  let lngRational: [number, number, number] | null = null;

  for (let i = 0; i < gpsCount; i++) {
    const entry = gpsIfdOffset + 2 + i * 12;
    const tag = read16(entry);
    const type = read16(entry + 2);
    const count = read32(entry + 4);
    const valueOffset = entry + 8;

    if (tag === 1 && type === 2) latRef = String.fromCharCode(view.getUint8(valueOffset));
    else if (tag === 3 && type === 2) lngRef = String.fromCharCode(view.getUint8(valueOffset));
    else if ((tag === 2 || tag === 4) && type === 5 && count === 3) {
      const dataOffset = tiffStart + read32(valueOffset);
      const readRational = (o: number): number => {
        const num = read32(o);
        const den = read32(o + 4);
        return den === 0 ? 0 : num / den;
      };
      const parts: [number, number, number] = [
        readRational(dataOffset),
        readRational(dataOffset + 8),
        readRational(dataOffset + 16),
      ];
      if (tag === 2) latRational = parts;
      else lngRational = parts;
    }
  }

  if (!latRational || !lngRational) return null;
  const toDeg = ([d, m, s]: [number, number, number]) => d + m / 60 + s / 3600;
  const lat = toDeg(latRational) * (latRef === 'S' ? -1 : 1);
  const lng = toDeg(lngRational) * (lngRef === 'W' ? -1 : 1);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}
