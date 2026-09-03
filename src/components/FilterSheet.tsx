import { STATUS_META, STATUS_ORDER } from '../lib/statuses';
import { useFilters, applyFilters, type Period } from '../store/filters';
import { useProblems } from '../lib/problems';
import './FilterSheet.css';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'week', label: 'Неделя' },
  { key: 'month', label: 'Месяц' },
  { key: 'all', label: 'Всё время' },
];

// Шторка фильтров (раздел 5.1 ТЗ). Пишет в общий стор — карта и список реагируют мгновенно.
export function FilterSheet({ onClose }: { onClose: () => void }) {
  const f = useFilters();
  const { data: problems = [] } = useProblems();
  const cats = [...new Set(problems.map((p) => p.category))];
  const count = applyFilters(problems, f).length;

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="filter-sheet" role="dialog" aria-label="Фильтры">
        <div className="sheet-grabber" />
        <div className="sheet-scroll">
          <label className="hide-resolved">
            <span>Скрыть решённые</span>
            <input
              type="checkbox"
              checked={f.hideResolved}
              onChange={(e) => f.setHideResolved(e.target.checked)}
            />
          </label>

          <h4>Статус</h4>
          <div className="check-list">
            {STATUS_ORDER.map((s) => (
              <label key={s} className="check-row">
                <span className="status-dot" style={{ background: STATUS_META[s].color }} />
                <span className="check-label">{STATUS_META[s].label}</span>
                <input type="checkbox" checked={f.statuses.includes(s)} onChange={() => f.toggleStatus(s)} />
              </label>
            ))}
          </div>

          <h4>Категория</h4>
          <div className="filter-chips">
            {cats.map((c) => (
              <button key={c} className={f.categories.includes(c) ? 'on' : ''} onClick={() => f.toggleCategory(c)}>
                {c}
              </button>
            ))}
          </div>

          <h4>Период</h4>
          <div className="period-seg">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                className={'period-btn' + (f.period === p.key ? ' on' : '')}
                onClick={() => f.setPeriod(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="sheet-footer">
          <button className="reset-btn" onClick={f.reset}>
            Сбросить
          </button>
          <button className="cta show-btn" onClick={onClose}>
            Показать {count}
          </button>
        </div>
      </div>
    </>
  );
}
