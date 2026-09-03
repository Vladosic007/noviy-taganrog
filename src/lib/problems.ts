import { useQuery } from '@tanstack/react-query';
import { api, type ApiProblem } from './api';
import type { Problem } from '../data/mockProblems';

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
  return useQuery({
    queryKey: ['problems'],
    queryFn: async () => (await api.problems()).map(apiToProblem),
  });
}

/** Одна проблема по id (для карточки). */
export function useProblem(id: string | undefined) {
  return useQuery({
    queryKey: ['problem', id],
    queryFn: async () => apiToProblem(await api.problem(id as string)),
    enabled: !!id,
  });
}
