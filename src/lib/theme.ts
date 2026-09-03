import { useEffect, useState } from 'react';

// Тёмная/светлая тема. По умолчанию — «системная»: реагируем на prefers-color-scheme.
// Ручной выбор запоминаем в localStorage. Хранится ровно в трёх состояниях:
// 'system' | 'light' | 'dark'.
export type ThemePref = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'taganrog-theme';

function readInitial(): ThemePref {
  if (typeof localStorage === 'undefined') return 'system';
  const v = localStorage.getItem(STORAGE_KEY);
  return v === 'light' || v === 'dark' ? v : 'system';
}

function applyTheme(pref: ThemePref) {
  const root = document.documentElement;
  if (pref === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', pref);
}

export function useTheme(): [ThemePref, (v: ThemePref) => void] {
  const [pref, setPref] = useState<ThemePref>(readInitial);

  useEffect(() => {
    applyTheme(pref);
    if (pref === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, pref);
  }, [pref]);

  return [pref, setPref];
}

// Применяем сохранённую тему как можно раньше, до первого рендера — чтобы не мигало
// белым при загрузке в тёмной системе. Вызывается один раз в main.tsx.
export function initTheme() {
  applyTheme(readInitial());
}
