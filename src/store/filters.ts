import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Problem } from '../data/mockProblems';
import type { ProblemStatus } from '../lib/statuses';

// Общее состояние фильтров для карты и списка (раздел 5.4 ТЗ), сохраняется в
// localStorage (раздел 5.1 ТЗ). Применяется на клиенте мгновенно, без запроса к серверу.
export type Period = 'all' | 'week' | 'month';

interface FilterState {
  statuses: ProblemStatus[]; // пусто = все статусы
  categories: string[]; // пусто = все категории
  hideResolved: boolean;
  period: Period;
  setStatuses: (s: ProblemStatus[]) => void;
  toggleStatus: (s: ProblemStatus) => void;
  toggleCategory: (c: string) => void;
  setHideResolved: (v: boolean) => void;
  setPeriod: (p: Period) => void;
  reset: () => void;
}

export const useFilters = create<FilterState>()(
  persist(
    (set) => ({
      statuses: [],
      categories: [],
      hideResolved: false,
      period: 'all',
      setStatuses: (statuses) => set({ statuses }),
      toggleStatus: (s) =>
        set((st) => ({
          statuses: st.statuses.includes(s) ? st.statuses.filter((x) => x !== s) : [...st.statuses, s],
        })),
      toggleCategory: (c) =>
        set((st) => ({
          categories: st.categories.includes(c) ? st.categories.filter((x) => x !== c) : [...st.categories, c],
        })),
      setHideResolved: (hideResolved) => set({ hideResolved }),
      setPeriod: (period) => set({ period }),
      reset: () => set({ statuses: [], categories: [], hideResolved: false, period: 'all' }),
    }),
    { name: 'taganrog-filters' },
  ),
);

export function activeFilterCount(s: Pick<FilterState, 'statuses' | 'categories' | 'hideResolved' | 'period'>): number {
  return (
    (s.statuses.length ? 1 : 0) +
    (s.categories.length ? 1 : 0) +
    (s.hideResolved ? 1 : 0) +
    (s.period !== 'all' ? 1 : 0)
  );
}

// Демо-«сегодня» синхронно с данными (см. mockProblems). На бэкенде фильтр по периоду уйдёт в SQL.
const TODAY = new Date('2026-08-29');

export function applyFilters(
  problems: Problem[],
  s: Pick<FilterState, 'statuses' | 'categories' | 'hideResolved' | 'period'>,
): Problem[] {
  return problems.filter((p) => {
    if (s.hideResolved && p.status === 'resolved') return false;
    if (s.statuses.length && !s.statuses.includes(p.status)) return false;
    if (s.categories.length && !s.categories.includes(p.category)) return false;
    if (s.period !== 'all') {
      const days = (TODAY.getTime() - new Date(p.occurredOn).getTime()) / 86_400_000;
      if (s.period === 'week' && days > 7) return false;
      if (s.period === 'month' && days > 31) return false;
    }
    return true;
  });
}
