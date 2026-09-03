import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { type Problem } from '../data/mockProblems';
import { STATUS_META, STATUS_ORDER } from '../lib/statuses';
import { useFilters, applyFilters, activeFilterCount } from '../store/filters';
import { useProblems } from '../lib/problems';
import { FilterSheet } from '../components/FilterSheet';
import { CardListSkeleton } from '../components/Skeleton';
import './screens.css';

export function ListScreen() {
  const navigate = useNavigate();
  const filters = useFilters();
  const [showFilters, setShowFilters] = useState(false);
  const { data: problems = [], isLoading, isError } = useProblems();
  const list = applyFilters(problems, filters);
  const activeCount = activeFilterCount(filters);

  return (
    <div className="screen">
      <header className="screen-head">
        <div>
          <h1>Проблемы</h1>
          <p className="muted">
            {list.length} из {problems.length}
          </p>
        </div>
        <button className="list-filter-btn" onClick={() => setShowFilters(true)}>
          ⚙️ Фильтры{activeCount > 0 ? ` · ${activeCount}` : ''}
        </button>
      </header>

      <div className="chips">
        <button className={filters.statuses.length === 0 ? 'on' : ''} onClick={() => filters.setStatuses([])}>
          Все
        </button>
        {STATUS_ORDER.map((s) => (
          <button key={s} className={filters.statuses.includes(s) ? 'on' : ''} onClick={() => filters.toggleStatus(s)}>
            {STATUS_META[s].label}
          </button>
        ))}
      </div>

      <div className="cards">
        {isLoading ? (
          <CardListSkeleton n={4} />
        ) : isError ? (
          <div className="empty">
            <span className="big">📡</span>
            <h2>Нет связи с сервером</h2>
            <p>Проверьте, запущен ли API на порту 3001.</p>
          </div>
        ) : list.length === 0 ? (
          <div className="empty">
            <span className="big">🔍</span>
            <h2>Ничего не найдено</h2>
            <p>Попробуйте изменить фильтры.</p>
          </div>
        ) : (
          list.map((p) => <ProblemCard key={p.id} problem={p} onOpen={() => navigate(`/problem/${p.id}`)} />)
        )}
      </div>

      {showFilters && <FilterSheet onClose={() => setShowFilters(false)} />}
    </div>
  );
}

function ProblemCard({ problem, onOpen }: { problem: Problem; onOpen: () => void }) {
  const meta = STATUS_META[problem.status];
  return (
    <article
      className="card"
      style={{ borderLeftColor: meta.color }}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
    >
      <div className="card-body">
        <span className="status-chip" style={{ background: meta.color }}>
          {meta.label}
        </span>
        <h3>{problem.title}</h3>
        <div className="meta">
          📍 {problem.address} · {problem.category}
        </div>
        <div className="meta">
          ✍️ {problem.signatures} из {problem.signatureGoal} подписей
        </div>
      </div>
    </article>
  );
}
