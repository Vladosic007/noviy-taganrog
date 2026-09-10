import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { CATEGORIES } from '../lib/categories';
import { CITY, DEMO_MODE, isInTaganrog } from '../lib/config';
import { api, type NearbyProblem } from '../lib/api';
import { STATUS_META } from '../lib/statuses';
import { compressImage } from '../lib/imageCompress';
import { readExifGps } from '../lib/exif';
import { AddressSearch } from '../components/AddressSearch';
import './ReportScreen.css';

const MAX_PHOTOS = 3;
const today = new Date().toISOString().slice(0, 10);

type LocMethod = 'geo' | 'map' | 'search';

// Экран подачи заявки (раздел 5.3 ТЗ). Одна прокручиваемая форма без мастера.
// Отправка идёт в реальный API (POST /submissions). Клиентское сжатие фото и очистка
// EXIF (раздел 11) — следующий шаг; сейчас файлы уходят как есть.
export function ReportScreen() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([]);
  const [category, setCategory] = useState<string>('');
  const [customCategory, setCustomCategory] = useState('');
  const [comment, setComment] = useState('');
  const [address, setAddress] = useState('');
  // `set: false` = дефолтные координаты центра города (человек ещё не выбрал место).
  const [coords, setCoords] = useState<{ lat: number; lng: number; set: boolean }>({
    lat: CITY.center[1],
    lng: CITY.center[0],
    set: false,
  });
  const [locMethod, setLocMethod] = useState<LocMethod>('geo');
  const [occurredOn, setOccurredOn] = useState(today);
  const [showAuthor, setShowAuthor] = useState(true);
  const [consent, setConsent] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(0);
  // Проверка дублей (раздел 5.3 ТЗ): перед отправкой ищем проблемы той же категории в 100 м.
  const [duplicates, setDuplicates] = useState<NearbyProblem[] | null>(null);
  // Подсказка места из EXIF первого фото (ТЗ 5.3 💡).
  const [exifSuggestion, setExifSuggestion] = useState<{ lat: number; lng: number } | null>(null);

  const valid = useMemo(
    () =>
      photos.length >= 1 &&
      !!category &&
      (category !== 'other' || customCategory.trim().length > 0) &&
      comment.trim().length >= 10 &&
      comment.length <= 1000 &&
      address.trim().length > 0 &&
      consent,
    [photos, category, customCategory, comment, address, consent],
  );

  async function addPhotos(files: FileList | null) {
    if (!files) return;
    const room = MAX_PHOTOS - photos.length;
    const incoming = Array.from(files).slice(0, room);
    if (incoming.length === 0) return;
    setCompressing((c) => c + incoming.length);

    // Первое фото: пробуем достать GPS из EXIF ДО сжатия (canvas метаданные съест).
    // Подсказку показываем только если координаты внутри Таганрога и место ещё не задано.
    if (photos.length === 0 && !coords.set && incoming[0]) {
      try {
        const gps = await readExifGps(incoming[0]);
        if (gps && isInTaganrog(gps.lat, gps.lng)) setExifSuggestion(gps);
      } catch {
        /* нет прав / не JPEG — не мешаем */
      }
    }

    const processed = await Promise.all(
      incoming.map(async (file) => {
        try {
          const compressed = await compressImage(file, { maxSide: 1600, quality: 0.8 });
          return { file: compressed, url: URL.createObjectURL(compressed) };
        } catch {
          return { file, url: URL.createObjectURL(file) };
        }
      }),
    );
    setPhotos((prev) => [...prev, ...processed]);
    setCompressing((c) => Math.max(0, c - incoming.length));
  }

  function acceptExifSuggestion() {
    if (!exifSuggestion) return;
    setCoords({ lat: exifSuggestion.lat, lng: exifSuggestion.lng, set: true });
    setAddress(`Из фото: ${exifSuggestion.lat.toFixed(5)}, ${exifSuggestion.lng.toFixed(5)}`);
    setLocMethod('geo');
    setExifSuggestion(null);
  }

  function removePhoto(url: string) {
    URL.revokeObjectURL(url);
    setPhotos((prev) => prev.filter((p) => p.url !== url));
  }

  function useMyLocation() {
    setLocMethod('geo');
    if (!navigator.geolocation) {
      setAddress('Геолокация недоступна — укажите адрес вручную');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, set: true });
        setAddress(`Моя геопозиция (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`);
      },
      () => setAddress('Не удалось определить геопозицию — укажите адрес вручную'),
    );
  }

  async function trySubmit() {
    setError(null);
    // В demo-режиме нет API /nearby — пропускаем проверку дублей.
    if (!DEMO_MODE && category && category !== 'other') {
      try {
        const near = await api.nearby(coords.lat, coords.lng, { radius: 100, category });
        if (near.length > 0) {
          setDuplicates(near);
          return;
        }
      } catch {
        // Если проверка не удалась — не мешаем человеку отправить заявку.
      }
    }
    await submit();
  }

  async function submit() {
    setDuplicates(null);
    setSubmitting(true);
    setError(null);
    // DEMO_MODE: сервер ещё не подключён — имитируем успех, чтобы можно было пройти
    // сценарий целиком. Реальная отправка появится, когда подключим Railway/Render.
    if (DEMO_MODE) {
      await new Promise((r) => setTimeout(r, 600));
      setSubmitted(true);
      setSubmitting(false);
      return;
    }
    try {
      const fd = new FormData();
      photos.forEach((p) => fd.append('photos', p.file));
      fd.append('categorySlug', category);
      if (category === 'other') fd.append('customCategory', customCategory.trim());
      fd.append('description', comment.trim());
      fd.append('lat', String(coords.lat));
      fd.append('lng', String(coords.lng));
      fd.append('addressText', address.trim());
      fd.append('occurredOn', occurredOn);
      fd.append('isAnonymous', String(!showAuthor));
      fd.append('consentVersion', 'v1');
      await api.createSubmission(fd);
      queryClient.invalidateQueries({ queryKey: ['my-submissions'] });
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось отправить заявку');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="report">
        <div className="report-success">
          <span className="report-success__ico">✅</span>
          <h2>Заявка отправлена</h2>
          <p className="muted">
            {DEMO_MODE
              ? 'Демо-режим: сервер ещё не подключён, заявка не сохранена. Так это будет выглядеть в бою — обычно проверяем в течение суток.'
              : 'Обычно проверяем в течение суток. Мы сообщим, когда проблема появится на карте.'}
          </p>
          <button className="cta" style={{ width: '100%' }} onClick={() => navigate('/my')}>
            Посмотреть мои заявки
          </button>
          <button
            className="report-ghost"
            onClick={() => {
              setSubmitted(false);
              setPhotos([]);
              setCategory('');
              setCustomCategory('');
              setComment('');
              setAddress('');
              setConsent(false);
            }}
          >
            Сообщить ещё об одной
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="report">
      <header className="report-head">
        <button className="report-back" onClick={() => navigate(-1)} aria-label="Отменить и вернуться">
          ← Отмена
        </button>
        <h1>Сообщить о проблеме</h1>
      </header>

      <div className="report-body">
        {/* 1. Фотографии */}
        <section className="field">
          <label className="field-label">
            Фотографии <span className="req">*</span>
            <span className="field-hint">от 1 до 3</span>
          </label>
          <div className="photo-row">
            {photos.map((p) => (
              <div key={p.url} className="photo-thumb" style={{ backgroundImage: `url(${p.url})` }}>
                <button className="photo-del" onClick={() => removePhoto(p.url)} aria-label="Удалить фото">
                  ✕
                </button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <label className="photo-add">
                <input type="file" accept="image/*" multiple hidden onChange={(e) => addPhotos(e.target.files)} />
                {compressing > 0 ? (
                  <>
                    <span>⏳</span>
                    <span className="photo-add__txt">Сжимаем…</span>
                  </>
                ) : (
                  <>
                    <span>📷</span>
                    <span className="photo-add__txt">Добавить</span>
                  </>
                )}
              </label>
            )}
          </div>
        </section>

        {/* 2. Категория */}
        <section className="field">
          <label className="field-label">
            Категория <span className="req">*</span>
          </label>
          <div className="cat-grid">
            {CATEGORIES.map((c) => (
              <button
                key={c.slug}
                className={'cat-chip' + (category === c.slug ? ' on' : '')}
                onClick={() => setCategory(c.slug)}
              >
                <span className="cat-ico">{c.icon}</span>
                {c.title}
              </button>
            ))}
          </div>
          {category === 'other' && (
            <input
              className="text-input"
              placeholder="Какая проблема? (до 40 символов)"
              maxLength={40}
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
            />
          )}
        </section>

        {/* 3. Комментарий */}
        <section className="field">
          <label className="field-label">
            Что случилось <span className="req">*</span>
          </label>
          <textarea
            className="text-area"
            placeholder="Опишите проблему: что, где именно, с какого времени"
            maxLength={1000}
            rows={4}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <div className={'char-count' + (comment.length > 0 && comment.trim().length < 10 ? ' warn' : '')}>
            {comment.length}/1000{comment.trim().length < 10 ? ' · минимум 10 символов' : ''}
          </div>
        </section>

        {/* 4. Место */}
        <section className="field">
          <label className="field-label">
            Место <span className="req">*</span>
          </label>
          <div className="seg">
            <button className={'seg-btn' + (locMethod === 'geo' ? ' on' : '')} onClick={useMyLocation}>
              📍 Я здесь
            </button>
            <button
              className={'seg-btn' + (locMethod === 'map' ? ' on' : '')}
              onClick={() => {
                setLocMethod('map');
                setAddress('Точка на карте (выбор на карте — на след. этапе)');
              }}
            >
              🗺️ На карте
            </button>
            <button className={'seg-btn' + (locMethod === 'search' ? ' on' : '')} onClick={() => setLocMethod('search')}>
              🔎 Поиск
            </button>
          </div>
          {locMethod === 'search' ? (
            <AddressSearch
              value={address}
              placeholder="Улица и дом, например «Петровская, 45»"
              onChange={setAddress}
              onPick={(r) => {
                setAddress(r.short);
                setCoords({ lat: r.lat, lng: r.lng, set: true });
              }}
            />
          ) : (
            address && <div className="addr-box">{address}</div>
          )}

          {exifSuggestion && (
            <div className="exif-hint">
              <div>
                <b>Похоже, снято здесь</b>
                <div className="muted" style={{ fontSize: 12 }}>
                  Координаты из фотографии: {exifSuggestion.lat.toFixed(5)}, {exifSuggestion.lng.toFixed(5)}
                </div>
              </div>
              <div className="exif-hint__actions">
                <button className="exif-btn-yes" onClick={acceptExifSuggestion}>
                  Подставить
                </button>
                <button className="exif-btn-no" onClick={() => setExifSuggestion(null)} aria-label="Скрыть">
                  ✕
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Когда обнаружено */}
        <section className="field">
          <label className="field-label">Когда обнаружено</label>
          <input
            className="text-input"
            type="date"
            max={today}
            value={occurredOn}
            onChange={(e) => setOccurredOn(e.target.value)}
          />
        </section>

        {/* Показывать автора */}
        <label className="toggle-row">
          <span>Показывать меня как автора</span>
          <input type="checkbox" checked={showAuthor} onChange={(e) => setShowAuthor(e.target.checked)} />
        </label>

        {/* Согласие */}
        <label className="consent-row">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>
            Я согласен с <a href="/legal/terms" target="_blank" rel="noopener noreferrer">правилами сервиса</a>
            {' и '}
            <a href="/legal/privacy" target="_blank" rel="noopener noreferrer">обработкой персональных данных</a>
          </span>
        </label>

        {error && <div className="report-error">{error}</div>}
      </div>

      <div className="report-footer">
        <button className="cta report-submit" disabled={!valid || submitting} onClick={trySubmit}>
          {submitting ? 'Отправляем…' : 'Отправить заявку'}
        </button>
      </div>

      {duplicates && duplicates.length > 0 && (
        <DuplicatesSheet
          items={duplicates}
          onKeepMine={() => submit()}
          onSupport={(id) => {
            api
              .toggleLike(id)
              .catch(() => {})
              .finally(() => {
                setDuplicates(null);
                navigate(`/problem/${id}`);
              });
          }}
          onClose={() => setDuplicates(null)}
        />
      )}
    </div>
  );
}

function DuplicatesSheet({
  items,
  onKeepMine,
  onSupport,
  onClose,
}: {
  items: NearbyProblem[];
  onKeepMine: () => void;
  onSupport: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="dup-sheet" role="dialog" aria-label="Возможно, об этом уже сообщили">
        <div className="sheet-grabber" />
        <div className="sheet-scroll">
          <h3 style={{ margin: '4px 0 4px' }}>Возможно, об этом уже сообщили</h3>
          <p className="muted" style={{ margin: '0 0 16px', fontSize: 13 }}>
            В радиусе 100 метров есть {items.length === 1 ? 'похожая проблема' : 'похожие проблемы'} той же категории.
            Проще поддержать существующую, чтобы не плодить дубли.
          </p>
          <div className="cards">
            {items.map((p) => {
              const meta = STATUS_META[p.status];
              return (
                <article key={p.id} className="card" style={{ borderLeftColor: meta.color }}>
                  <div className="card-body">
                    <span className="status-chip" style={{ background: meta.color }}>
                      {meta.label}
                    </span>
                    <h3>{p.title}</h3>
                    <div className="meta">
                      📍 {p.addressText ?? '—'} · {p.distance} м отсюда
                    </div>
                    <div className="meta">
                      ✍️ {p.signaturesCount} подписей · 👍 {p.likesCount}
                    </div>
                    <button className="cta" style={{ marginTop: 10, width: '100%' }} onClick={() => onSupport(p.id)}>
                      Да, это она — поддержать
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
        <div className="sheet-footer">
          <button className="reset-btn" onClick={onClose}>
            Отмена
          </button>
          <button className="show-btn" onClick={onKeepMine}>
            Нет, это другая проблема
          </button>
        </div>
      </div>
    </>
  );
}
