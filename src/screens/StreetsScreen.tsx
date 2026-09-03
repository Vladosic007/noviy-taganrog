import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { API_HOST } from '../lib/config';
import './StreetsScreen.css';

// Экран улиц + формирование PDF-обращения (раздел 6.3 ТЗ).
export function StreetsScreen() {
  const { data: streets = [], isLoading } = useQuery({
    queryKey: ['streets'],
    queryFn: api.streetsSummary,
  });
  const [openStreet, setOpenStreet] = useState<{ key: string; name: string } | null>(null);

  return (
    <>
      {isLoading ? (
        <div className="empty">
          <span className="big">⏳</span>
          <p>Загрузка…</p>
        </div>
      ) : streets.length === 0 ? (
        <div className="empty">
          <span className="big">🛣️</span>
          <p>Пока ни одной проблемы на карте.</p>
        </div>
      ) : (
        <div className="streets-list">
          {streets.map((s) => (
            <button key={s.key} className="street-row" onClick={() => setOpenStreet({ key: s.key, name: s.name })}>
              <div>
                <div className="street-name">{s.name}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                  {s.total} проблем · Н:{s.found} · Р:{s.inProgress} · ✅{s.resolved}
                </div>
              </div>
              <div className="street-stats">
                <span className="street-sigs">✍️ {s.signatures}</span>
                <span>›</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {openStreet && (
        <AppealSheet
          streetKey={openStreet.key}
          streetName={openStreet.name}
          onClose={() => setOpenStreet(null)}
        />
      )}
    </>
  );
}

function AppealSheet({ streetKey, streetName, onClose }: { streetKey: string; streetName: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: problems = [], isLoading } = useQuery({
    queryKey: ['street-problems', streetKey],
    queryFn: () => api.streetProblems(streetKey),
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<{ filePath: string; totalSignatures: number; problems: number } | null>(null);

  const allSelected = useMemo(() => problems.length > 0 && problems.every((p) => selected.has(p.id)), [problems, selected]);
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(problems.map((p) => p.id)));
  }
  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  const create = useMutation({
    mutationFn: () => api.createAppeal({ streetKey, problemIds: [...selected] }),
    onSuccess: (data) => {
      setResult(data);
      qc.invalidateQueries({ queryKey: ['streets'] });
    },
  });

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="appeal-sheet" role="dialog" aria-label={`Обращение по улице ${streetName}`}>
        <div className="sheet-grabber" />
        <div className="sheet-scroll">
          {result ? (
            <div className="appeal-result">
              <div className="appeal-result__ico">📄</div>
              <h4>Обращение сформировано</h4>
              <p className="muted" style={{ fontSize: 13 }}>
                Проблем: {result.problems}. Подписей в приложении: {result.totalSignatures}.
              </p>
              <a
                className="cta"
                href={`${API_HOST}${result.filePath}`}
                target="_blank"
                rel="noopener noreferrer"
                download
              >
                Скачать PDF
              </a>
            </div>
          ) : (
            <>
              <h3 style={{ margin: '4px 0 4px' }}>Обращение по «{streetName}»</h3>
              <p className="muted" style={{ margin: '0 0 12px', fontSize: 13 }}>
                Выберите проблемы, которые войдут в обращение. Подписи с активным согласием
                автоматически добавятся приложением.
              </p>

              <div className="appeal-tools">
                <button className="link-btn" onClick={toggleAll}>
                  {allSelected ? 'Снять все' : 'Выбрать все'}
                </button>
              </div>

              {isLoading ? (
                <div className="empty">
                  <span className="big">⏳</span>
                  <p>Загрузка…</p>
                </div>
              ) : (
                <div className="appeal-list">
                  {problems.map((p) => (
                    <label key={p.id} className={'appeal-row' + (selected.has(p.id) ? ' on' : '')}>
                      <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                      <div className="appeal-row-body">
                        <div className="appeal-row-title">{p.title}</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {p.addressText ?? '—'} · подписей: {p.signaturesCount}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {create.isError && <div className="report-error" style={{ marginTop: 12 }}>{(create.error as Error).message}</div>}
            </>
          )}
        </div>

        {!result && (
          <div className="sheet-footer">
            <button className="reset-btn" onClick={onClose}>
              Отмена
            </button>
            <button
              className="cta show-btn"
              disabled={selected.size === 0 || create.isPending}
              onClick={() => create.mutate()}
            >
              {create.isPending ? 'Формируем…' : `Сформировать (${selected.size})`}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
