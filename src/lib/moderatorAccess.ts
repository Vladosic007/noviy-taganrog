import { useEffect, useState } from 'react';

// Простая клиентская защита вкладки «Модерация» на демо-этапе.
// Как это работает:
//   1) Ты (владелец сайта) знаешь ключ — задан в VITE_MODERATOR_KEY при билде на Vercel.
//      Если переменная не задана, используется ключ по умолчанию — его меняешь только ты.
//   2) На Профиле есть кнопка «Стать модератором» — вводишь туда ключ.
//   3) Мы кладём флаг is_moderator в localStorage браузера — вкладка появляется.
//   4) Обычные посетители сайта вкладку не видят и на /moderation получают 404-подобное.
//
// Это НЕ настоящая безопасность (кто угодно может открыть исходный код и увидеть ключ).
// Настоящая защита появится, когда подключим бэкенд: гвардия ролей на сервере проверит
// каждый запрос модератора. Пока модерация ничего реально не сохраняет (demo-режим),
// клиентского ключа хватает, чтобы случайные пользователи не тыкали кнопки.

const KEY_STORAGE = 'taganrog-moderator';
const EXPECTED_KEY = import.meta.env.VITE_MODERATOR_KEY ?? 'moderator2026';

export function isModerator(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(KEY_STORAGE) === '1';
}

export function tryUnlock(key: string): boolean {
  if (key.trim() === EXPECTED_KEY) {
    localStorage.setItem(KEY_STORAGE, '1');
    // Уведомляем все хуки useIsModerator в текущей вкладке
    window.dispatchEvent(new Event('moderator-changed'));
    return true;
  }
  return false;
}

export function lockModerator(): void {
  localStorage.removeItem(KEY_STORAGE);
  window.dispatchEvent(new Event('moderator-changed'));
}

// Реактивный хук: перерисовывает компонент при смене статуса модератора.
export function useIsModerator(): boolean {
  const [on, setOn] = useState<boolean>(isModerator);
  useEffect(() => {
    const upd = () => setOn(isModerator());
    window.addEventListener('storage', upd); // смена в другой вкладке
    window.addEventListener('moderator-changed', upd); // смена в этой вкладке
    return () => {
      window.removeEventListener('storage', upd);
      window.removeEventListener('moderator-changed', upd);
    };
  }, []);
  return on;
}
