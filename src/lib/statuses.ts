/** Статусы проблемы и их отображение (раздел 5.1, 7.2 ТЗ). */

export type ProblemStatus = 'found' | 'in_progress' | 'resolved' | 'declined';

export interface StatusMeta {
  label: string;
  color: string;
}

// Цвета продублированы из tokens.css — MapLibre paint не понимает CSS-переменные.
// Все статусы яркие, чтобы точки на карте были видны на любой подложке (светлая карта,
// тёмная инвертированная, зелёные парки).
export const STATUS_META: Record<ProblemStatus, StatusMeta> = {
  found: { label: 'Найдено', color: '#ef4056' },       // Коралловый — самый заметный
  in_progress: { label: 'Решается', color: '#f5a623' }, // Тёплый оранжевый
  resolved: { label: 'Решено', color: '#2e9e5b' },     // Зелёный
  declined: { label: 'Отклонено', color: '#6c7280' },  // Тёмно-серый (не слишком светлый)
};

export const STATUS_ORDER: ProblemStatus[] = ['found', 'in_progress', 'resolved', 'declined'];
