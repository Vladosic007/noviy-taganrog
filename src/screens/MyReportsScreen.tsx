import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, type ApiSubmission } from '../lib/api';
import { NotificationsFeed } from '../components/NotificationsFeed';
import { CardListSkeleton } from '../components/Skeleton';
import './screens.css';
import './StreetsScreen.css';

// Статусы заявки (раздел 5.5 ТЗ)
const SUB_STATUS: Record<ApiSubmission['status'], { label: string; note: string; color: string }> = {
  pending: { label: 'На проверке', note: 'Модератор проверит в течение суток', color: '#f5a623' },
  published: { label: 'Опубликована', note: 'Проблема опубликована на карте', color: '#2e9e5b' },
  merged: { label: 'Присоединена', note: 'Такая проблема уже была, ваш голос учтён', color: '#0ba8a2' },
  rejected: { label: 'Отклонена', note: '', color: '#8a9098' },
};

const REJECT: Record<string, string> = {
  not_confirmed: 'Не подтвердилось',
  duplicate: 'Дубликат',
  out_of_scope: 'Вне зоны ответственности',
  insufficient: 'Недостаточно данных',
  rules: 'Нарушает правила',
  not_taganrog: 'Не в Таганроге',
};

export function MyReportsScreen() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'reports' | 'notifications'>('reports');
  const { data: subs = [], isLoading } = useQuery({ queryKey: ['my-submissions'], queryFn: api.mySubmissions });
  const { data: countData } = useQuery({
    queryKey: ['notifications-count'],
    queryFn: api.notificationsCount,
    refetchInterval: 15_000,
  });
  const unread = countData?.unread ?? 0;

  return (
    <div className="screen">
      <header className="screen-head">
        <h1>Мои</h1>
      </header>

      <div className="mod-tabs" style={{ margin: '0 0 12px' }}>
        <button className={tab === 'reports' ? 'on' : ''} onClick={() => setTab('reports')}>
          Заявки{subs.length > 0 ? ` · ${subs.length}` : ''}
        </button>
        <button className={tab === 'notifications' ? 'on' : ''} onClick={() => setTab('notifications')}>
          Уведомления{unread > 0 ? ` · ${unread}` : ''}
        </button>
      </div>

      {tab === 'notifications' ? (
        <NotificationsFeed />
      ) : isLoading ? (
        <CardListSkeleton n={3} />
      ) : subs.length === 0 ? (
        <div className="empty">
          <span className="big">📨</span>
          <h2>Пока ни одной заявки</h2>
          <p>Заметили проблему в городе? Расскажите — это займёт минуту.</p>
          <button className="cta" onClick={() => navigate('/report')}>
            Сообщить о проблеме
          </button>
        </div>
      ) : (
        <div className="cards">
          {subs.map((s) => {
            const meta = SUB_STATUS[s.status];
            const cat = s.category?.title ?? s.customCategory ?? 'Другое';
            return (
              <article className="card" key={s.id} style={{ borderLeftColor: meta.color }}>
                <div className="card-body">
                  <span className="status-chip" style={{ background: meta.color }}>
                    {meta.label}
                  </span>
                  <h3>{s.description}</h3>
                  <div className="meta">
                    {cat}
                    {s.addressText ? ` · ${s.addressText}` : ''}
                  </div>
                  <div className="meta">
                    {s.status === 'rejected'
                      ? `Причина: ${REJECT[s.rejectReason ?? ''] ?? 'не указана'}${s.rejectComment ? ' · ' + s.rejectComment : ''}`
                      : meta.note}
                  </div>
                  {s.status === 'published' && s.problem && (
                    <button className="link-btn" onClick={() => navigate(`/problem/${s.problem!.id}`)}>
                      Открыть на карте →
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
