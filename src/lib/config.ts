/** Общие константы приложения. */

export const APP = {
  // ПЛЕЙСХОЛДЕР: финальное название и домен ждём от заказчика (раздел 1.5 ТЗ).
  name: 'Новый Таганрог',
  tagline: 'Карта городских проблем',
};

// Абсолютный URL API-хоста. Приоритет:
//   1) env-переменная VITE_API_HOST (для локальной разработки — переопределит хост)
//   2) прод-URL нашего API на Render (по умолчанию для деплоя на Vercel)
// URL публичный — никакого секрета нет, любой посетитель сайта видит его в DevTools.
const PROD_API_HOST = 'https://noviy-taganrog-api.onrender.com';
export const API_HOST =
  (import.meta.env.VITE_API_HOST as string | undefined) ??
  (import.meta.env.DEV ? 'http://localhost:3001' : PROD_API_HOST);

// Демо-режим: если явно попросили через VITE_DEMO=1. Иначе API_HOST всегда задан
// (см. выше), и приложение стучится в реальный бэкенд.
export const DEMO_MODE = import.meta.env.VITE_DEMO === '1';

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
