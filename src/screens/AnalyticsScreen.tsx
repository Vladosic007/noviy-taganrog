import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { DEMO_MODE } from '../lib/config';
import { STATUS_META, type ProblemStatus } from '../lib/statuses';
import { Skeleton } from '../components/Skeleton';
import './AnalyticsScreen.css';

// Дашборд модератора (раздел 6.5 ТЗ). Всё, что нужно, — на одном экране.
export function AnalyticsScreen() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['analytics'],
    queryFn: api.analyticsOverview,
    enabled: !DEMO_MODE,
  });

  if (isLoading) {
    return (
      <div className="analytics">
        <div className="kpi-grid">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="kpi">
              <Skeleton height={26} width="50%" />
              <div style={{ height: 8 }} />
              <Skeleton height={10} width="80%" />
            </div>
          ))}
        </div>
        <Skeleton height={80} radius={14} />
        <Skeleton height={100} radius={14} />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="empty">
        <span className="big">📡</span>
        <p>Не удалось загрузить аналитику.</p>
      </div>
    );
  }

  const problemsTotal = Object.values(data.problems.byStatus).reduce((s, n) => s + n, 0);
  const subFunnel: [string, ProblemStatus | 'pending' | 'merged' | 'rejected' | 'published', number][] = [
    ['На проверке', 'pending', data.submissions.byStatus.pending ?? 0],
    ['Опубликовано', 'published', data.submissions.byStatus.published ?? 0],
    ['Присоединено', 'merged', data.submissions.byStatus.merged ?? 0],
    ['Отклонено', 'rejected', data.submissions.byStatus.rejected ?? 0],
  ];

  return (
    <div className="analytics">
      {/* Ключевые числа */}
      <div className="kpi-grid">
        <Kpi label="Заявок за неделю" value={data.submissions.week} accent />
        <Kpi label="Проблем на карте" value={problemsTotal} />
        <Kpi label="Решено за неделю" value={data.problems.resolvedWeek} />
        <Kpi
          label="Средний срок решения"
          value={data.problems.avgDaysToResolve == null ? '—' : `${data.problems.avgDaysToResolve} д`}
        />
      </div>

      {/* Воронка заявок */}
      <section className="an-section">
        <h4>Заявки — воронка модерации</h4>
        {data.submissions.total === 0 ? (
          <p className="muted small">Пока ни одной заявки.</p>
        ) : (
          <div className="funnel">
            {subFunnel.map(([label, key, n]) => (
              <FunnelRow key={key} label={label} count={n} total={data.submissions.total} />
            ))}
          </div>
        )}
      </section>

      {/* Проблемы по статусам */}
      <section className="an-section">
        <h4>Проблемы по статусам</h4>
        <div className="status-bar">
          {(['found', 'in_progress', 'resolved', 'declined'] as ProblemStatus[]).map((s) => {
            const n = data.problems.byStatus[s] ?? 0;
            const pct = problemsTotal ? (n / problemsTotal) * 100 : 0;
            return (
              <div key={s} className="status-seg" style={{ width: `${pct}%`, background: STATUS_META[s].color }} title={`${STATUS_META[s].label}: ${n}`} />
            );
          })}
        </div>
        <div className="status-legend">
          {(['found', 'in_progress', 'resolved', 'declined'] as ProblemStatus[]).map((s) => (
            <span key={s}>
              <i style={{ background: STATUS_META[s].color }} />
              {STATUS_META[s].label} · {data.problems.byStatus[s] ?? 0}
            </span>
          ))}
        </div>
      </section>

      {/* Топ улиц */}
      <section className="an-section">
        <h4>Топ улиц по числу проблем</h4>
        <TopBars items={data.topStreets.map((s) => ({ label: s.name, value: s.total, sub: `✍️ ${s.signatures}` }))} />
      </section>

      {/* Топ категорий */}
      <section className="an-section">
        <h4>Топ категорий</h4>
        <TopBars items={data.topCategories.map((c) => ({ label: `${c.icon} ${c.title}`, value: c.count }))} />
      </section>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className={'kpi' + (accent ? ' accent' : '')}>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
    </div>
  );
}

function FunnelRow({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div className="funnel-row">
      <div className="funnel-head">
        <span>{label}</span>
        <b>
          {count} <span className="muted small">· {pct}%</span>
        </b>
      </div>
      <div className="funnel-bar">
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function TopBars({ items }: { items: { label: string; value: number; sub?: string }[] }) {
  const max = items.reduce((m, i) => Math.max(m, i.value), 0);
  if (items.length === 0) return <p className="muted small">Нет данных.</p>;
  return (
    <div className="top-bars">
      {items.map((it) => (
        <div key={it.label} className="top-row">
          <div className="top-head">
            <span>{it.label}</span>
            <b>
              {it.value}
              {it.sub && <span className="muted small"> · {it.sub}</span>}
            </b>
          </div>
          <div className="top-bar">
            <span style={{ width: `${max ? (it.value / max) * 100 : 0}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
