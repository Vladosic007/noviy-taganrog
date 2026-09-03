import { APP } from '../lib/config';
import './AppHeader.css';

// Тонкая шапка над картой: логотип партии + название проекта.
// Кликабельно ведёт на «/», пометкой «кто мы» для нового посетителя.
export function AppHeader() {
  return (
    <a className="app-header" href="/" aria-label="На главную">
      <img className="app-header__logo" src="/logo-teal.svg" alt="Партия «Новые люди»" />
      <div className="app-header__text">
        <div className="app-header__title">{APP.name}</div>
        <div className="app-header__sub">{APP.tagline}</div>
      </div>
    </a>
  );
}
