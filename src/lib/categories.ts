/** Справочник категорий (раздел 8.8 ТЗ, стартовый набор). На фазе 3 приедет с сервера. */
export interface Category {
  slug: string;
  title: string;
  icon: string;
}

export const CATEGORIES: Category[] = [
  { slug: 'roads', title: 'Дороги и тротуары', icon: '🛣️' },
  { slug: 'light', title: 'Освещение', icon: '💡' },
  { slug: 'trash', title: 'Мусор и свалки', icon: '🗑️' },
  { slug: 'utilities', title: 'ЖКХ', icon: '🚰' },
  { slug: 'improvement', title: 'Благоустройство', icon: '🌳' },
  { slug: 'transport', title: 'Транспорт и остановки', icon: '🚌' },
  { slug: 'danger', title: 'Опасные объекты', icon: '⚠️' },
  { slug: 'animals', title: 'Животные', icon: '🐾' },
  { slug: 'other', title: 'Другое', icon: '➕' },
];
