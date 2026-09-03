import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type ApiSubmission } from '../lib/api';
import { API_HOST, DEMO_MODE } from '../lib/config';
import { CATEGORIES } from '../lib/categories';
import { useIsModerator } from '../lib/moderatorAccess';
import { StreetsScreen } from './StreetsScreen';
import { AnalyticsScreen } from './AnalyticsScreen';
import { Skeleton } from '../components/Skeleton';
import './ModerationScreen.css';
import './StreetsScreen.css';

const REJECT_REASONS = [
  { key: 'not_confirmed', label: 'Не подтвердилось' },
  { key: 'duplicate', label: 'Дубликат' },
  { key: 'out_of_scope', label: 'Вне зоны ответственности' },
  { key: 'insufficient', label: 'Недостаточно данных' },
  { key: 'rules', label: 'Нарушает правила' },
  { key: 'not_taganrog', label: 'Не в Таганроге' },
];

// Очередь модерации (раздел 6.1 ТЗ) + вкладка «Улицы» с PDF-обращениями (раздел 6.3 ТЗ).
export function ModerationScreen() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isMod = useIsModerator();
  const [tab, setTab] = useState<'queue' | 'streets' | 'analytics'>('queue');
  const { data: queue = [], isLoading } = useQuery({
    queryKey: ['moderation-queue'],
    queryFn: api.moderationQueue,
    enabled: !DEMO_MODE && isMod,
  });
  const current = queue[0];

  // Не-модератор попал по прямой ссылке /moderation — показываем заглушку с приглашением
  // ввести ключ. Ключ вводится в Профиле.
  if (!isMod) {
    return (
      <div className="mod">
        <header className="mod-head">
          <button className="report-back" onClick={() => navigate('/')} aria-label="Назад">
            ‹
          </button>
          <div>
            <h1>Модерация</h1>
          </div>
        </header>
        <div className="mod-body">
          <div className="empty">
            <span className="big">🛡️</span>
            <h2>Только для модераторов</h2>
            <p>Введите ключ модератора в Профиле — вкладка появится сама.</p>
            <button className="cta" onClick={() => navigate('/profile')}>
              Перейти в Профиль
            </button>
          </div>
        </div>
      </div>
    );
  }

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ['moderation-queue'] });
    qc.invalidateQueries({ queryKey: ['moderation-count'] });
    qc.invalidateQueries({ queryKey: ['problems'] });
    qc.invalidateQueries({ queryKey: ['my-submissions'] });
    qc.invalidateQueries({ queryKey: ['streets'] });
  }

  return (
    <div className="mod">
      <header className="mod-head">
        <button className="report-back" onClick={() => navigate('/')} aria-label="Назад">
          ‹
        </button>
        <div>
          <h1>Модерация</h1>
          <p className="muted mod-count">
            {tab === 'queue' ? `В очереди: ${queue.length}` : tab === 'streets' ? 'Улицы и обращения' : 'Аналитика'}
          </p>
        </div>
      </header>

      <div className="mod-tabs">
        <button className={tab === 'queue' ? 'on' : ''} onClick={() => setTab('queue')}>
          Очередь
        </button>
        <button className={tab === 'streets' ? 'on' : ''} onClick={() => setTab('streets')}>
          Улицы
        </button>
        <button className={tab === 'analytics' ? 'on' : ''} onClick={() => setTab('analytics')}>
          Аналитика
        </button>
      </div>

      <div className="mod-body">
        {tab === 'streets' ? (
          <StreetsScreen />
        ) : tab === 'analytics' ? (
          <AnalyticsScreen />
        ) : isLoading ? (
          <article className="mod-card">
            <div className="mod-photos">
              <Skeleton width={160} height={160} radius={12} />
            </div>
            <div className="mod-meta">
              <Skeleton width={90} height={20} radius={999} />
              <Skeleton width={70} height={12} />
            </div>
            <div style={{ marginTop: 12 }}>
              <Skeleton height={16} width="80%" />
              <div style={{ height: 8 }} />
              <Skeleton height={12} width="55%" />
            </div>
          </article>
        ) : !current ? (
          <div className="empty">
            <span className="big">🎉</span>
            <h2>Очередь пуста</h2>
            <p>Все заявки разобраны.</p>
          </div>
        ) : (
          <ModerationCard key={current.id} sub={current} onDone={invalidateAll} />
        )}
      </div>
    </div>
  );
}

function ModerationCard({ sub, onDone }: { sub: ApiSubmission; onDone: () => void }) {
  const [mode, setMode] = useState<'view' | 'publish' | 'reject' | 'merge'>('view');

  if (mode === 'publish') return <PublishForm sub={sub} onBack={() => setMode('view')} onDone={onDone} />;
  if (mode === 'reject') return <RejectForm sub={sub} onBack={() => setMode('view')} onDone={onDone} />;
  if (mode === 'merge') return <MergeForm sub={sub} onBack={() => setMode('view')} onDone={onDone} />;

  const cat = sub.category?.title ?? sub.customCategory ?? '—';

  return (
    <article className="mod-card">
      {sub.photos && sub.photos.length > 0 && (
        <div className="mod-photos">
          {sub.photos.map((p, i) => (
            <img key={i} src={`${API_HOST}${p.path}`} alt="" />
          ))}
        </div>
      )}
      <div className="mod-meta">
        <span className="cat-pill">{cat}</span>
        <span className="muted">{new Date(sub.createdAt).toLocaleDateString('ru-RU')}</span>
      </div>
      <p className="mod-desc">{sub.description}</p>
      {sub.addressText && <div className="mod-addr">📍 {sub.addressText}</div>}
      <div className="mod-actions">
        <button className="cta mod-btn-publish" onClick={() => setMode('publish')}>
          Опубликовать
        </button>
        <button className="mod-btn-reject" onClick={() => setMode('merge')}>
          Присоединить
        </button>
        <button className="mod-btn-reject" onClick={() => setMode('reject')}>
          Отклонить
        </button>
      </div>
    </article>
  );
}

function MergeForm({ sub, onBack, onDone }: { sub: ApiSubmission; onBack: () => void; onDone: () => void }) {
  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ['merge-candidates', sub.id],
    // Ищем шире, чем при подаче (5.3 — 100 м): модератор часто видит дубли и дальше.
    queryFn: () => api.nearby(sub.lat, sub.lng, { radius: 500, category: sub.category?.slug }),
    // Координаты у нас в заявке есть только если фронт их посылал — но мы это делаем всегда.
    enabled: Number.isFinite(sub.lat) && Number.isFinite(sub.lng),
  });
  const merge = useMutation({
    mutationFn: (problemId: string) => api.mergeSubmission(sub.id, { problemId }),
    onSuccess: () => onDone(),
  });

  return (
    <div className="mod-form">
      <div className="mod-form-head">
        <button className="report-back" onClick={onBack}>
          ‹
        </button>
        <b>Присоединить к существующей</b>
      </div>

      <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
        Заявка станет голосом «за» существующую проблему той же категории в радиусе 500 м.
      </p>

      {isLoading ? (
        <div className="empty">
          <span className="big">⏳</span>
          <p>Ищем похожие…</p>
        </div>
      ) : candidates.length === 0 ? (
        <div className="empty">
          <span className="big">🔍</span>
          <p>Похожих проблем не найдено — публикуйте как новую.</p>
        </div>
      ) : (
        <div className="cards" style={{ marginTop: 8 }}>
          {candidates.map((c) => (
            <article key={c.id} className="card" style={{ borderLeftColor: 'var(--brand-primary)' }}>
              <div className="card-body">
                <h3>{c.title}</h3>
                <div className="meta">
                  📍 {c.addressText ?? '—'} · {c.distance} м отсюда
                </div>
                <div className="meta">
                  ✍️ {c.signaturesCount} подписей · 👍 {c.likesCount}
                </div>
                <button
                  className="cta"
                  style={{ marginTop: 10, width: '100%' }}
                  disabled={merge.isPending}
                  onClick={() => merge.mutate(c.id)}
                >
                  Присоединить к этой
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {merge.isError && <div className="report-error" style={{ marginTop: 12 }}>{(merge.error as Error).message}</div>}
    </div>
  );
}

function PublishForm({ sub, onBack, onDone }: { sub: ApiSubmission; onBack: () => void; onDone: () => void }) {
  const initialSlug = sub.category?.slug ?? 'other';
  const initialCat = CATEGORIES.find((c) => c.slug === initialSlug)?.title ?? '—';
  const [title, setTitle] = useState('');
  const [categorySlug, setCategorySlug] = useState(initialSlug);
  const [description, setDescription] = useState(sub.description);
  const [signatureGoal, setSignatureGoal] = useState(100);

  const publish = useMutation({
    mutationFn: () => api.publishSubmission(sub.id, { title, categorySlug, description, signatureGoal }),
    onSuccess: () => onDone(),
  });

  function autoTitle() {
    const catTitle = CATEGORIES.find((c) => c.slug === categorySlug)?.title ?? initialCat;
    setTitle(`${catTitle} — ${sub.addressText ?? 'место не указано'}`);
  }

  return (
    <div className="mod-form">
      <div className="mod-form-head">
        <button className="report-back" onClick={onBack}>
          ‹
        </button>
        <b>Опубликовать</b>
      </div>

      <label className="field-label">Заголовок</label>
      <input className="text-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Оставьте пустым для авто-генерации" />
      <button className="link-btn" onClick={autoTitle}>Сгенерировать из категории и адреса</button>

      <label className="field-label" style={{ marginTop: 16 }}>Категория</label>
      <select className="text-input" value={categorySlug} onChange={(e) => setCategorySlug(e.target.value)}>
        {CATEGORIES.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.icon} {c.title}
          </option>
        ))}
      </select>

      <label className="field-label" style={{ marginTop: 16 }}>Описание</label>
      <textarea className="text-area" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} />

      <label className="field-label" style={{ marginTop: 16 }}>Порог подписей</label>
      <input className="text-input" type="number" min={1} value={signatureGoal} onChange={(e) => setSignatureGoal(Number(e.target.value))} />

      {publish.isError && <div className="report-error">{(publish.error as Error).message}</div>}

      <button className="cta" style={{ marginTop: 20, width: '100%' }} disabled={publish.isPending} onClick={() => publish.mutate()}>
        {publish.isPending ? 'Публикация…' : 'Опубликовать на карту'}
      </button>
    </div>
  );
}

function RejectForm({ sub, onBack, onDone }: { sub: ApiSubmission; onBack: () => void; onDone: () => void }) {
  const [reason, setReason] = useState(REJECT_REASONS[0].key);
  const [comment, setComment] = useState('');

  const reject = useMutation({
    mutationFn: () => api.rejectSubmission(sub.id, { reason, comment: comment.trim() || undefined }),
    onSuccess: () => onDone(),
  });

  return (
    <div className="mod-form">
      <div className="mod-form-head">
        <button className="report-back" onClick={onBack}>
          ‹
        </button>
        <b>Отклонить заявку</b>
      </div>

      <label className="field-label">Причина</label>
      <div className="reasons">
        {REJECT_REASONS.map((r) => (
          <label key={r.key} className={'reason-row' + (reason === r.key ? ' on' : '')}>
            <input type="radio" name="reason" checked={reason === r.key} onChange={() => setReason(r.key)} />
            {r.label}
          </label>
        ))}
      </div>

      <label className="field-label" style={{ marginTop: 16 }}>Комментарий автору (необязательно)</label>
      <textarea className="text-area" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />

      {reject.isError && <div className="report-error">{(reject.error as Error).message}</div>}

      <button className="cta" style={{ marginTop: 20, width: '100%', background: 'var(--status-declined)' }} disabled={reject.isPending} onClick={() => reject.mutate()}>
        {reject.isPending ? 'Отправка…' : 'Отклонить'}
      </button>
    </div>
  );
}
