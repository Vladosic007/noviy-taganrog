import { useQuery } from '@tanstack/react-query';
import { api, type ApiProblem } from './api';
import type { Problem } from '../data/mockProblems';
import { DEMO_PROBLEMS } from '../data/demoData';
import { DEMO_MODE } from './config';

/** Приводим ответ API к фронтовому типу Problem. */
export function apiToProblem(a: ApiProblem): Problem {
  const photos = a.photos ?? [];
  return {
    id: a.id,
    title: a.title,
    category: a.category?.title ?? '—',
    categorySlug: a.category?.slug,
    address: a.addressText ?? '',
    status: a.status,
    signatures: a.signaturesCount,
    signatureGoal: a.signatureGoal,
    occurredOn: a.occurredOn ?? '',
    lng: a.lng,
    lat: a.lat,
    description: a.description,
    likes: a.likesCount,
    publishedAt: a.publishedAt ?? undefined,
    resolvedAt: a.resolvedAt ?? undefined,
    photosBefore: photos.filter((p) => p.kind === 'before').map((p) => p.path),
    photosAfter: photos.filter((p) => p.kind === 'after').map((p) => p.path),
    statusHistory: a.statusHistory ?? [],
  };
}

/** Все опубликованные проблемы города (для карты и списка). */
export function useProblems() {
  return useQuery<Problem[]>({
    queryKey: ['problems', DEMO_MODE ? 'mock' : 'api'],
    queryFn: async (): Promise<Problem[]> =>
      DEMO_MODE ? DEMO_PROBLEMS : (await api.problems()).map(apiToProblem),
    // В demo-режиме данные статические — не рефетчим и не считаем устаревшими.
    staleTime: DEMO_MODE ? Infinity : 30_000,
  });
}

/** Одна проблема по id (для карточки). */
export function useProblem(id: string | undefined) {
  return useQuery<Problem>({
    queryKey: ['problem', id, DEMO_MODE ? 'mock' : 'api'],
    queryFn: async (): Promise<Problem> => {
      if (DEMO_MODE) {
        const p = DEMO_PROBLEMS.find((x: Problem) => String(x.id) === String(id));
        if (!p) throw new Error('not found');
        return p;
      }
      return apiToProblem(await api.problem(id as string));
    },
    enabled: !!id,
  });
}
