import type { Problem } from './mockProblems';

// Демонстрационные проблемы для Vercel-деплоя без бэкенда (DEMO_MODE).
// Пустой массив = чистая карта на старте — так покажем настоящему первому пользователю.
// Когда подключим бэкенд, реальные проблемы приедут из /api/v1/problems.
export const DEMO_PROBLEMS: Problem[] = [];
