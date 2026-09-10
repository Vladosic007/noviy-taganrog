// Извлечение и нормализация улиц из свободного поля addressText.
// Пока в БД нет OSM-таблицы streets (фаза «данные города»), группируем проблемы
// по строке улицы, распарсенной из адреса. Когда данные OSM подключим, заменим
// на связь Problem -> Street. Логика ниже совместима с обоими вариантами.

// Отделяем «улицу» от «дома»: «Петровская ул., 45» → «Петровская ул.»
export function streetFromAddress(address: string | null | undefined): string {
  if (!address) return 'Без адреса';
  const commaIdx = address.indexOf(',');
  const raw = commaIdx > 0 ? address.slice(0, commaIdx) : address;
  return raw.trim() || 'Без адреса';
}

// Ключ для группировки: «Петровская ул.» и «петровская улица» — одна и та же улица.
// NB: \b в JavaScript не считает кириллицу за word-character (word-boundary работает
// только для [A-Za-z0-9_]), поэтому используем явные границы пробелов и начала/конца.
export function normalizeStreet(name: string): string {
  return name
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(
      /(^|\s)(?:улица|ул\.?|переулок|пер\.?|проспект|пр\.?|пр-т|площадь|пл\.?|бульвар|б-р|шоссе|ш\.?|набережная|наб\.?)(?=\s|$)/g,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();
}
