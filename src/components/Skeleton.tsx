import './Skeleton.css';

// Универсальный «мерцающий» блок для состояния загрузки.
// Даёт ощущение «интерфейс уже здесь, данные подгружаются», а не «пусто и спиннер».
export function Skeleton({
  width,
  height,
  radius,
  className,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  className?: string;
}) {
  return (
    <span
      className={'skeleton' + (className ? ' ' + className : '')}
      style={{ width, height, borderRadius: radius }}
    />
  );
}

// Скелетон карточки проблемы для списков (карта/список/мои заявки).
export function CardSkeleton() {
  return (
    <div className="card skeleton-card">
      <div className="card-body">
        <Skeleton width={80} height={18} radius={999} />
        <Skeleton height={16} width="80%" />
        <Skeleton height={12} width="55%" />
        <Skeleton height={12} width="65%" />
      </div>
    </div>
  );
}

// N-плейсхолдеров карточек подряд.
export function CardListSkeleton({ n = 3 }: { n?: number }) {
  return (
    <div className="cards">
      {Array.from({ length: n }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
