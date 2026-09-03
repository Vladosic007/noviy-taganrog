import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Skeleton } from './Skeleton';
import './NotificationsFeed.css';

const REJECT_LABEL: Record<string, string> = {
  not_confirmed: 'не подтвердилось',
  duplicate: 'дубликат',
  out_of_scope: 'вне зоны ответственности',
  insufficient: 'недостаточно данных',
  rules: 'нарушает правила',
  not_taganrog: 'не в Таганроге',
};

const TYPE_ICON: Record<string, string> = {
  'problem.status_changed': '🔔',
  'submission.published': '✅',
  'submission.rejected': '⛔',
};

// Внутренняя лента уведомлений (раздел 5.6, 8.13 ТЗ). До VK-авторизации все
// уведомления имеют status='skipped' в БД — в UI показываем как «не отправлено в ВК».
export function NotificationsFeed() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['notifications-mine'],
    queryFn: api.notificationsMine,
  });

  const readAll = useMutation({
    mutationFn: api.notificationsReadAll,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications-mine'] });
      qc.invalidateQueries({ queryKey: ['notifications-count'] });
    },
  });

  // Помечаем прочитанным при первом же открытии ленты.
  useEffect(() => {
    if (items.some((n) => !n.read)) readAll.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  if (isLoading) {
    return (
      <div className="feed">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="feed-item">
            <Skeleton width={20} height={20} radius="50%" />
            <div className="feed-body">
              <Skeleton height={14} width="85%" />
              <div style={{ height: 6 }} />
              <Skeleton height={10} width="40%" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="empty">
        <span className="big">🔔</span>
        <h2>Пока тихо</h2>
        <p>Когда по вашим проблемам изменится статус — придёт уведомление.</p>
      </div>
    );
  }
  return (
    <div className="feed">
      {items.map((n) => {
        const isReject = n.type === 'submission.rejected';
        const reason = isReject && n.payload?.reason ? REJECT_LABEL[n.payload.reason] ?? n.payload.reason : null;
        const title = n.payload?.problemTitle ?? '';
        const message =
          n.payload?.message ??
          (isReject
            ? `Заявка отклонена${reason ? ` — ${reason}` : ''}${n.payload?.comment ? `. ${n.payload.comment}` : ''}`
            : n.type === 'submission.published'
              ? `Заявка опубликована на карту${title ? `: «${title}»` : ''}`
              : n.type);
        return (
          <button
            key={n.id}
            className={'feed-item' + (n.read ? '' : ' unread')}
            onClick={() => n.problemId && navigate(`/problem/${n.problemId}`)}
          >
            <span className="feed-ico">{TYPE_ICON[n.type] ?? '🔔'}</span>
            <div className="feed-body">
              <div className="feed-msg">{message}</div>
              <div className="feed-meta">
                {new Date(n.createdAt).toLocaleString('ru-RU', {
                  day: 'numeric',
                  month: 'long',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {n.status === 'skipped' && ' · не отправлено в ВК'}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
