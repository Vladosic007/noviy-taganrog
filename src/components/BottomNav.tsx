import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { DEMO_MODE } from '../lib/config';
import { useIsModerator } from '../lib/moderatorAccess';
import './BottomNav.css';

// Раздел 5.1 ТЗ: Карта · Список · Мои заявки · Модерация (по роли) · Профиль.
// Вкладка «Модерация» показывается только тем, кто разблокировал её ключом
// в Профиле (см. src/lib/moderatorAccess.ts). Обычные посетители её не видят.
type Item = {
  to: string;
  label: string;
  icon: string;
  end: boolean;
  badge?: 'moderation' | 'my';
  moderatorOnly?: boolean;
};

const ITEMS: Item[] = [
  { to: '/', label: 'Карта', icon: '🗺️', end: true },
  { to: '/list', label: 'Список', icon: '📋', end: false },
  { to: '/my', label: 'Мои', icon: '📨', end: false, badge: 'my' },
  { to: '/moderation', label: 'Модерация', icon: '🛡️', end: false, badge: 'moderation', moderatorOnly: true },
  { to: '/profile', label: 'Профиль', icon: '👤', end: false },
];

export function BottomNav() {
  const isMod = useIsModerator();
  const { data: modData } = useQuery({
    queryKey: ['moderation-count'],
    queryFn: api.moderationCount,
    refetchInterval: 15_000,
    enabled: !DEMO_MODE && isMod,
  });
  const { data: notifData } = useQuery({
    queryKey: ['notifications-count'],
    queryFn: api.notificationsCount,
    refetchInterval: 15_000,
    enabled: !DEMO_MODE,
  });
  const pending = modData?.pending ?? 0;
  const unread = notifData?.unread ?? 0;

  const items = ITEMS.filter((it) => !it.moderatorOnly || isMod);

  return (
    <nav className="bottom-nav">
      {items.map((item) => {
        const badge = item.badge === 'moderation' ? pending : item.badge === 'my' ? unread : 0;
        return (
          <NavLink key={item.to} to={item.to} end={item.end}>
            <span className="nav-ico">
              {item.icon}
              {item.badge && badge > 0 && <span className="nav-badge">{badge}</span>}
            </span>
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
