import { useEffect, useState } from 'react';
import './Onboarding.css';

const STORAGE_KEY = 'taganrog-onboarded';

// Короткое приветствие для первого посетителя карты. Показывается один раз;
// «Понятно» ставит флаг в localStorage — больше не появится.
// «Пропустить» и клик по фону — то же самое.
export function Onboarding() {
  const [open, setOpen] = useState<boolean>(false);

  useEffect(() => {
    // Открываем не мгновенно: даём странице отрисоваться, чтобы окошко не мешало
    // первому впечатлению от карты.
    const t = window.setTimeout(() => {
      if (localStorage.getItem(STORAGE_KEY) !== '1') setOpen(true);
    }, 700);
    return () => window.clearTimeout(t);
  }, []);

  function close() {
    localStorage.setItem(STORAGE_KEY, '1');
    setOpen(false);
  }

  if (!open) return null;

  return (
    <>
      <div className="onb-backdrop" onClick={close} />
      <div className="onb-card" role="dialog" aria-label="О сервисе">
        <div className="onb-title">Как это работает</div>
        <ol className="onb-steps">
          <li>
            <span className="onb-num">1</span>
            <div>
              <b>Вы сообщаете</b>
              <div className="onb-note">
                фотография, категория, адрес — минута
              </div>
            </div>
          </li>
          <li>
            <span className="onb-num">2</span>
            <div>
              <b>Соседи поддерживают</b>
              <div className="onb-note">лайком и подписью под обращением</div>
            </div>
          </li>
          <li>
            <span className="onb-num">3</span>
            <div>
              <b>Команда несёт в администрацию</b>
              <div className="onb-note">
                готовое PDF-обращение по улице с ФИО подписавшихся
              </div>
            </div>
          </li>
        </ol>
        <div className="onb-actions">
          <button className="cta onb-cta" onClick={close}>
            Понятно
          </button>
        </div>
      </div>
    </>
  );
}
