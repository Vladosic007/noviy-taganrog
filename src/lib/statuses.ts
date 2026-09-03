/** Статусы проблемы и их отображение (раздел 5.1, 7.2 ТЗ). */

export type ProblemStatus = 'found' | 'in_progress' | 'resolved' | 'declined';

export interface StatusMeta {
  label: string;
  color: string;
}

// Цвета продублированы из tokens.css — MapLibre paint не понимает CSS-переменные.
export const STATUS_META: Record<ProblemStatus, StatusMeta> = {
  found: { label: 'Найдено', color: '#8a9098' },
  in_progress: { label: 'Решается', color: '#f5a623' },
  resolved: { label: 'Решено', color: '#2e9e5b' },
  declined: { label: 'Отклонено', color: '#c4c8ce' },
};

export const STATUS_ORDER: ProblemStatus[] = ['found', 'in_progress', 'resolved', 'declined'];
