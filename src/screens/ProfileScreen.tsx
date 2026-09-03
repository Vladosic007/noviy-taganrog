import { APP } from '../lib/config';
import { useTheme, type ThemePref } from '../lib/theme';
import './screens.css';

// Заглушка профиля. Реальные данные из VK появятся на фазе 5 (раздел 5.6 ТЗ).
export function ProfileScreen() {
  const [theme, setTheme] = useTheme();

  return (
    <div className="screen">
      <header className="screen-head">
        <h1>Профиль</h1>
      </header>

      <div className="profile-head">
        <div className="profile-avatar">👤</div>
        <div>
          <strong>Гость</strong>
          <div className="muted" style={{ fontSize: 13 }}>
            Сообщать о проблемах и подписывать обращения можно и без входа. Войдите,
            чтобы получать уведомления и следить за своими заявками.
          </div>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat">
          <b>0</b>
          <span>отправлено</span>
        </div>
        <div className="stat">
          <b>0</b>
          <span>опубликовано</span>
        </div>
        <div className="stat">
          <b>0</b>
          <span>решено по вам</span>
        </div>
      </div>

      <button className="cta" style={{ width: '100%' }} disabled title="Появится с настройкой VK App">
        Войти через ВКонтакте
      </button>

      {/* Тема (ТЗ 14.1) */}
      <section className="settings-section">
        <h4>Оформление</h4>
        <div className="theme-seg">
          {(
            [
              { key: 'light', label: '☀️ Светлая' },
              { key: 'system', label: '⚙️ Как в системе' },
              { key: 'dark', label: '🌙 Тёмная' },
            ] as { key: ThemePref; label: string }[]
          ).map((opt) => (
            <button
              key={opt.key}
              className={'theme-btn' + (theme === opt.key ? ' on' : '')}
              onClick={() => setTheme(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      <div className="brand-footer">
        <img className="brand-logo" src="/logo-teal.svg" alt="Партия «Новые люди»" />
        <p className="muted" style={{ fontSize: 12, marginTop: 12, lineHeight: 1.5 }}>
          {APP.name} · {APP.tagline}
        </p>
        <nav className="legal-links">
          <a href="/legal/about">О сервисе</a>
          <a href="/legal/terms">Правила</a>
          <a href="/legal/privacy">Политика ПД</a>
        </nav>
      </div>
    </div>
  );
}
