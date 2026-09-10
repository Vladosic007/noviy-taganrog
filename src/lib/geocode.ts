// Поиск адресов в Таганроге через Nominatim (публичный геокодер OpenStreetMap).
// Бесплатно, без ключа, лимит 1 запрос/сек — для поиска-по-мере-ввода этого хватит.
// Ограничиваем поиск городом Таганрог через viewbox + bounded=1.

import { CITY } from './config';

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string; // «Петровская улица, 45, Таганрог...»
  short: string;       // «Петровская улица, 45» — что показываем пользователю
}

// viewbox для Nominatim: [minLng, minLat, maxLng, maxLat] в тексте через запятую.
const VIEWBOX = `${CITY.bounds.minLng},${CITY.bounds.maxLat},${CITY.bounds.maxLng},${CITY.bounds.minLat}`;

export async function searchAddress(query: string, signal?: AbortSignal): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  // Добавляем «Таганрог» к запросу, если человек не написал уже — чтобы точнее найти.
  const withCity = /таганрог/i.test(q) ? q : `${q}, Таганрог`;
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', withCity);
  url.searchParams.set('format', 'json');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', '5');
  url.searchParams.set('viewbox', VIEWBOX);
  url.searchParams.set('bounded', '1'); // отсекаем всё, что за пределами города
  url.searchParams.set('accept-language', 'ru');

  const res = await fetch(url.toString(), {
    signal,
    // Nominatim требует User-Agent, но в браузере его не установить — просто без него.
    // Для маленького трафика это ок.
  });
  if (!res.ok) return [];
  const items = (await res.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
    address?: {
      road?: string;
      house_number?: string;
      suburb?: string;
    };
  }>;

  return items.map((it) => {
    const road = it.address?.road;
    const house = it.address?.house_number;
    const short = road && house ? `${road}, ${house}` : road ?? it.display_name.split(',')[0];
    return {
      lat: Number(it.lat),
      lng: Number(it.lon),
      displayName: it.display_name,
      short,
    };
  });
}
