import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { initTheme } from './lib/theme';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/global.css';

initTheme();
const queryClient = new QueryClient();

// StrictMode намеренно не используем: он в dev-режиме монтирует компоненты дважды,
// из-за чего карта MapLibre пересоздаётся и обрывает загрузку тайлов. Инварианты
// проверяем линтером и типами.
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </QueryClientProvider>,
);
