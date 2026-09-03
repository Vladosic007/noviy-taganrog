/** Общие константы приложения. */

export const APP = {
  // ПЛЕЙСХОЛДЕР: финальное название и домен ждём от заказчика (раздел 1.5 ТЗ).
  name: 'Новый Таганрог',
  tagline: 'Карта городских проблем',
};

// Абсолютный URL API-хоста — нужен, чтобы клеить пути к фото (/uploads/...).
// В demo-режиме (Vercel без бэкенда) хост пустой — используем локальные моки.
export const API_HOST = import.meta.env.VITE_API_HOST ?? 'http://localhost:3001';

// Демо-режим: включается, если явно `VITE_DEMO=1` ИЛИ если API-хост не задан
// (например, деплой на Vercel до подключения Railway/Render). В этом режиме экраны
// работают на моках `MOCK_PROBLEMS`, форма подачи и модерация показывают понятное
// «сервер ещё не подключён» вместо ошибок сети.
export const DEMO_MODE =
  import.meta.env.VITE_DEMO === '1' || !import.meta.env.VITE_API_HOST;

export const CITY = {
  name: 'Таганрог',
  // Центр города [lng, lat]
  center: [38.8969, 47.2362] as [number, number],
  zoom: 12.2,
  // Грубый bounding box (ТЗ 1.4 — с запасом на пригороды). Настоящий полигон OSM
  // подтянем в фазу «данные города» вместе с PMTiles.
  bounds: { minLat: 47.15, maxLat: 47.32, minLng: 38.78, maxLng: 39.05 },
};

export function isInTaganrog(lat: number, lng: number): boolean {
  const b = CITY.bounds;
  return lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng;
}
