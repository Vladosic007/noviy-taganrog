import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { STATUS_META, type ProblemStatus } from '../lib/statuses';
import { useProblem } from '../lib/problems';
import { api } from '../lib/api';
import { API_HOST, DEMO_MODE } from '../lib/config';
import './ProblemScreen.css';

function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

// Карточка проблемы (раздел 5.2 ТЗ). Данные + фото + история статусов — из API.
// Лайк/«Следить» — оптимистичные (ТЗ 10.4). Панель модератора — по разделу 6.2.
export function ProblemScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: problem, isLoading, isError } = useProblem(id);

  const qc = useQueryClient();
  const [liked, setLiked] = useState(false);
  const [likeDelta, setLikeDelta] = useState(0);
  const [tab, setTab] = useState<'before' | 'after'>('after');
  const [modOpen, setModOpen] = useState(false);
  const [signOpen, setSignOpen] = useState(false);

  const { data: sigState } = useQuery({
    queryKey: ['signature', id, DEMO_MODE ? 'demo' : 'api'],
    queryFn: () => api.signatureState(id as string),
    enabled: !!id && !DEMO_MODE, // без API — просто «нет подписи», локально
  });

  const toggleSubscribe = useMutation({
    mutationFn: () => api.toggleSubscribe(id as string),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['signature', id] }),
  });

  const revokeSignature = useMutation({
    mutationFn: () => api.revokeSignature(id as string),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['signature', id] });
      qc.invalidateQueries({ queryKey: ['problem', id] });
      qc.invalidateQueries({ queryKey: ['problems'] });
    },
  });

  if (isLoading) {
    return (
      <div className="problem">
        <header className="report-head">
          <button className="report-back" onClick={() => navigate(-1)} aria-label="Назад">
            ‹
          </button>
          <h1>Проблема</h1>
        </header>
        <div className="empty">
          <span className="big">⏳</span>
          <p>Загружаем…</p>
        </div>
      </div>
    );
  }

  if (isError || !problem) {
    return (
      <div className="problem">
        <header className="report-head">
          <button className="report-back" onClick={() => navigate(-1)} aria-label="Назад">
            ‹
          </button>
          <h1>Проблема</h1>
        </header>
        <div className="empty">
          <span className="big">🔍</span>
          <h2>Проблема не найдена</h2>
          <p>Возможно, её сняли с публикации.</p>
        </div>
      </div>
    );
  }

  const meta = STATUS_META[problem.status];
  const resolved = problem.status === 'resolved';
  const likeCount = (problem.likes ?? 0) + likeDelta;
  // Стрим-счётчик подписей: если пользователь только что подписал — sigState свежее
  // проблемы, показываем свежий счётчик.
  const signaturesCount = sigState?.signaturesCount ?? problem.signatures;
  const pct = Math.min(100, Math.round((signaturesCount / problem.signatureGoal) * 100));
  const signed = !!sigState?.signed;
  const subscribed = !!sigState?.subscribed;

  function toggleLike() {
    // Оптимистичный лайк (ТЗ 10.4): счётчик двигаем мгновенно, при ошибке — откат.
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeDelta((d) => d + (wasLiked ? -1 : 1));
    if (DEMO_MODE) return; // локально только визуально
    api.toggleLike(problem!.id).catch(() => {
      setLiked(wasLiked);
      setLikeDelta((d) => d + (wasLiked ? 1 : -1));
    });
  }

  const before = problem.photosBefore ?? [];
  const after = problem.photosAfter ?? [];
  const hasBoth = before.length > 0 && after.length > 0;
  const currentPhotos = resolved && hasBoth ? (tab === 'after' ? after : before) : before;

  return (
    <div className="problem">
      <header className="report-head problem-head">
        <button className="report-back" onClick={() => navigate(-1)} aria-label="Назад">
          ‹
        </button>
        <button className="icon-btn" aria-label="Поделиться">
          ↗
        </button>
      </header>

      <div className="problem-body">
        {/* Галерея: для решённых — вкладки Было/Стало, если есть оба набора */}
        {resolved && hasBoth && (
          <div className="gallery-tabs">
            <button className={tab === 'before' ? 'on' : ''} onClick={() => setTab('before')}>
              Было
            </button>
            <button className={tab === 'after' ? 'on' : ''} onClick={() => setTab('after')}>
              Стало
            </button>
          </div>
        )}

        {currentPhotos.length > 0 ? (
          <div className="photo-strip">
            {currentPhotos.map((p, i) => (
              <img key={i} src={`${API_HOST}${p}`} alt="" />
            ))}
          </div>
        ) : (
          <div className={'photo-hero ' + (resolved ? 'is-after' : '')}>
            <span>{resolved ? '✅' : '📷'}</span>
            <em>{resolved ? 'Фото «после» не добавлено' : 'Фотография проблемы'}</em>
          </div>
        )}

        <h1 className="problem-title">{problem.title}</h1>

        <div className="chips-row">
          <span className="status-chip" style={{ background: meta.color }}>
            {meta.label}
          </span>
          <span className="cat-pill">{problem.category}</span>
        </div>

        <button className="addr-line" onClick={() => navigate('/')}>
          📍 {problem.address}
        </button>

        <div className="dates">
          <div>
            <span className="muted">Обнаружено</span>
            <b>{fmtDate(problem.occurredOn)}</b>
          </div>
          <div>
            <span className="muted">Опубликовано</span>
            <b>{fmtDate(problem.publishedAt)}</b>
          </div>
          {resolved && (
            <div>
              <span className="muted">Решено</span>
              <b>{fmtDate(problem.resolvedAt)}</b>
            </div>
          )}
        </div>

        <p className="problem-desc">{problem.description}</p>

        <div className="support">
          <button className={'like-btn' + (liked ? ' on' : '')} onClick={toggleLike}>
            👍 Подтверждаю · {likeCount}
          </button>

          <div className="progress">
            <span style={{ width: `${pct}%` }} />
          </div>
          <div className="muted sign-txt">
            {signaturesCount} из {problem.signatureGoal} подписей до подачи в администрацию
          </div>

          <div className="support-actions">
            {signed ? (
              <div className="signed-block">
                <div className="signed-txt">
                  ✓ Вы подписали
                  {sigState?.fullName && (
                    <div className="muted" style={{ fontSize: 12 }}>
                      {sigState.fullName}
                    </div>
                  )}
                </div>
                <button
                  className="revoke-btn"
                  onClick={() => revokeSignature.mutate()}
                  disabled={revokeSignature.isPending}
                >
                  Отозвать
                </button>
              </div>
            ) : (
              <button className="cta sign-btn" onClick={() => setSignOpen(true)}>
                Подписать обращение
              </button>
            )}
            <button
              className={'watch-btn' + (subscribed ? ' on' : '')}
              onClick={() => toggleSubscribe.mutate()}
              disabled={toggleSubscribe.isPending}
              aria-label={subscribed ? 'Не следить' : 'Следить'}
            >
              {subscribed ? '🔔' : '🔕'}
            </button>
          </div>
        </div>

        <div className="author">
          <div className="author-ava">{problem.isAnonymous ? '🕶️' : '👤'}</div>
          <div>
            <div className="muted" style={{ fontSize: 12 }}>
              Автор
            </div>
            <b>{problem.isAnonymous ? 'Аноним' : problem.authorName ?? 'Житель Таганрога'}</b>
          </div>
        </div>

        <details className="history" open={(problem.statusHistory?.length ?? 0) > 1}>
          <summary>История статусов</summary>
          <ul>
            {(problem.statusHistory ?? []).map((h, i) => {
              const m = STATUS_META[h.toStatus as ProblemStatus];
              return (
                <li key={i}>
                  <b style={{ color: m?.color }}>{m?.label ?? h.toStatus}</b>
                  {' — '}
                  {fmtDate(h.createdAt)}
                  {h.comment ? <>. {h.comment}</> : null}
                </li>
              );
            })}
            {problem.statusHistory?.length === 0 && (
              <li>
                <b>Опубликовано</b> — {fmtDate(problem.publishedAt)}
              </li>
            )}
          </ul>
        </details>

        {/* Панель модератора (раздел 5.2, 6.2 ТЗ). До VK-авторизации доступна всем. */}
        <div className="mod-panel">
          {!modOpen ? (
            <button className="mod-open" onClick={() => setModOpen(true)}>
              🛡️ Управление модератора
            </button>
          ) : (
            <ModeratorPanel problemId={problem.id} status={problem.status} onClose={() => setModOpen(false)} />
          )}
        </div>
      </div>

      {signOpen && <SignSheet problemId={problem.id} onClose={() => setSignOpen(false)} />}
    </div>
  );
}

function SignSheet({ problemId, onClose }: { problemId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [fullName, setFullName] = useState('');
  const [consent, setConsent] = useState(false);
  const sign = useMutation({
    mutationFn: () => api.sign(problemId, { fullName: fullName.trim(), consentTextVersion: 'v1' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['signature', problemId] });
      qc.invalidateQueries({ queryKey: ['problem', problemId] });
      qc.invalidateQueries({ queryKey: ['problems'] });
      onClose();
    },
  });
  const valid = fullName.trim().length >= 5 && consent;

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sign-sheet" role="dialog" aria-label="Подписать обращение">
        <div className="sheet-grabber" />
        <div className="sheet-scroll">
          <h3 style={{ margin: '4px 0 4px' }}>Подписать обращение</h3>
          <p className="muted" style={{ margin: '0 0 16px', fontSize: 13, lineHeight: 1.5 }}>
            Ваше ФИО войдёт в пакет обращения, который команда проекта передаст в администрацию города.
            Это юридически значимая подпись — указывайте настоящее имя.
          </p>

          <label className="field-label">
            ФИО полностью <span className="req">*</span>
          </label>
          <input
            className="text-input"
            placeholder="Иванов Иван Иванович"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />

          <label className="consent-row" style={{ marginTop: 16 }}>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              Я даю <a href="/legal/privacy" target="_blank" rel="noopener noreferrer">согласие на обработку ПД</a>
              {' '}и передачу моих ФИО в администрацию Таганрога в рамках обращения по этой проблеме.
              Отозвать согласие можно в любой момент (кнопка «Отозвать» после подписи).
            </span>
          </label>

          {sign.isError && <div className="report-error" style={{ marginTop: 12 }}>{(sign.error as Error).message}</div>}
        </div>
        <div className="sheet-footer">
          <button className="reset-btn" onClick={onClose}>
            Отмена
          </button>
          <button
            className="cta show-btn"
            disabled={!valid || sign.isPending}
            onClick={() => sign.mutate()}
          >
            {sign.isPending ? 'Отправка…' : 'Подписать'}
          </button>
        </div>
      </div>
    </>
  );
}

const STATUS_TRANSITIONS: Record<ProblemStatus, { to: ProblemStatus; label: string }[]> = {
  found: [
    { to: 'in_progress', label: 'Взято в работу' },
    { to: 'resolved', label: 'Решено' },
    { to: 'declined', label: 'Не подтвердилось' },
  ],
  in_progress: [
    { to: 'resolved', label: 'Решено' },
    { to: 'found', label: 'Вернуть в «Найдено»' },
  ],
  resolved: [{ to: 'in_progress', label: 'Открыть заново' }],
  declined: [{ to: 'found', label: 'Восстановить как «Найдено»' }],
};

function ModeratorPanel({
  problemId,
  status,
  onClose,
}: {
  problemId: string;
  status: ProblemStatus;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<ProblemStatus>(STATUS_TRANSITIONS[status][0]?.to ?? status);
  const [comment, setComment] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadedAfter, setUploadedAfter] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['problem', problemId] });
    qc.invalidateQueries({ queryKey: ['problems'] });
  };

  async function uploadAfter(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      const created = await api.addProblemPhotos(problemId, 'after', Array.from(files));
      setUploadedAfter((n) => n + created.length);
      invalidate();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить фото');
    } finally {
      setUploading(false);
    }
  }

  const changeStatus = useMutation({
    mutationFn: () => api.changeProblemStatus(problemId, { status: target, comment: comment.trim() || undefined }),
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const needComment = target === 'in_progress' || target === 'found';
  const needAfter = target === 'resolved';

  return (
    <div className="mod-panel-body">
      <div className="mod-panel-head">
        <b>Управление модератора</b>
        <button className="preview-close" onClick={onClose} aria-label="Закрыть">
          ✕
        </button>
      </div>

      <label className="field-label">Новый статус</label>
      <div className="mod-status-list">
        {STATUS_TRANSITIONS[status].map((t) => (
          <label key={t.to} className={'status-radio' + (target === t.to ? ' on' : '')}>
            <input type="radio" checked={target === t.to} onChange={() => setTarget(t.to)} />
            <span className="status-dot" style={{ background: STATUS_META[t.to].color }} />
            {t.label}
          </label>
        ))}
      </div>

      {needAfter && (
        <div className="after-block">
          <label className="field-label" style={{ marginTop: 16 }}>
            Фото «после» <span className="req">*</span>
          </label>
          <p className="muted" style={{ fontSize: 12, margin: '0 0 10px' }}>
            Обязательно для перехода в «Решено».
          </p>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => uploadAfter(e.target.files)} />
          <button className="mod-upload-btn" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? 'Загрузка…' : uploadedAfter > 0 ? `Добавлено фото: ${uploadedAfter}` : '📷 Загрузить фото «после»'}
          </button>
        </div>
      )}

      {needComment && (
        <>
          <label className="field-label" style={{ marginTop: 16 }}>
            Комментарий <span className="req">*</span>
          </label>
          <textarea
            className="text-area"
            rows={3}
            placeholder="Что именно и кем делается"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </>
      )}

      {error && <div className="report-error" style={{ marginTop: 12 }}>{error}</div>}

      <button
        className="cta"
        style={{ marginTop: 16, width: '100%' }}
        disabled={changeStatus.isPending || (needComment && !comment.trim())}
        onClick={() => changeStatus.mutate()}
      >
        {changeStatus.isPending ? 'Сохранение…' : 'Сменить статус'}
      </button>
    </div>
  );
}
