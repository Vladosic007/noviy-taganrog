import type { ProblemStatus } from '../lib/statuses';

/**
 * Тип проблемы для фронта. Данные приходят из API (см. src/lib/problems.ts),
 * этот же тип использует и GeoJSON-конвертер для карты.
 */
export interface Problem {
  id: string;
  title: string;
  category: string; // отображаемое название категории
  categorySlug?: string;
  address: string;
  status: ProblemStatus;
  signatures: number;
  signatureGoal: number;
  occurredOn: string;
  lng: number;
  lat: number;
  description?: string;
  likes?: number;
  isAnonymous?: boolean;
  authorName?: string;
  publishedAt?: string;
  resolvedAt?: string;
  photosBefore?: string[];
  photosAfter?: string[];
  statusHistory?: { fromStatus: string | null; toStatus: string; comment: string | null; createdAt: string }[];
}

/** Преобразование в GeoJSON для источника MapLibre. */
export function problemsToGeoJSON(problems: Problem[]) {
  return {
    type: 'FeatureCollection',
    features: problems.map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: {
        id: p.id,
        title: p.title,
        category: p.category,
        address: p.address,
        status: p.status,
        signatures: p.signatures,
        goal: p.signatureGoal,
      },
    })),
  };
}
