import { useState } from 'react';
import { APP } from '../lib/config';
import { useTheme, type ThemePref } from '../lib/theme';
import { lockModerator, tryUnlock, useIsModerator } from '../lib/moderatorAccess';
import './screens.css';

export function ProfileScreen() {
  const [theme, setTheme] = useTheme();
  const isMod = useIsModerator();
  const [modInput, setModInput] = useState('');
  const [modError, setModError] = useState(false);

  function unlock() {
    if (tryUnlock(modInput)) {
      setModInput('');
      setModError(false);
    } else {
      setModError(true);
    }
  }

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
            Сообщать о проблемах и подписывать обращения можно без входа.
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

      {/* Доступ модератора */}
      <section className="settings-section">
        <h4>Доступ модератора</h4>
        {isMod ? (
          <div className="mod-status">
            <div>
              <div className="mod-status__title">✓ Вы модератор</div>
              <div className="muted" style={{ fontSize: 13 }}>
                Вкладка «Модерация» появилась внизу.
              </div>
            </div>
            <button className="mod-status__off" onClick={lockModerator}>
              Выйти
            </button>
          </div>
        ) : (
          <div>
            <input
              className="text-input"
              type="password"
              placeholder="Ключ модератора"
              value={modInput}
              onChange={(e) => {
                setModInput(e.target.value);
                setModError(false);
              }}
              onKeyDown={(e) => e.key === 'Enter' && unlock()}
            />
            <button
              className="cta"
              style={{ width: '100%', marginTop: 10 }}
              disabled={!modInput.trim()}
              onClick={unlock}
            >
              Войти как модератор
            </button>
            {modError && (
              <div style={{ fontSize: 12, color: 'var(--brand-accent)', marginTop: 8 }}>
                Неверный ключ.
              </div>
            )}
          </div>
        )}
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
