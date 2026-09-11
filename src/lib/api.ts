import type { ProblemStatus } from './statuses';
import { API_HOST } from './config';

// Единая точка общения фронта с бэкендом (NestJS, префикс /api/v1).
// API_HOST приходит из config.ts — там правильный прод-URL с Render.
const API_BASE = `${API_HOST}/api/v1`;

// Render Free tier засыпает через 15 мин без запросов. Первое обращение
// после сна ждёт ~30-60 сек пока контейнер стартует. Даём длинный таймаут
// и человекочитаемую ошибку, если сервер не поднялся.
const COLD_START_TIMEOUT = 60_000;

async function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs = COLD_START_TIMEOUT): Promise<Response> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: init?.signal ?? ctrl.signal });
  } catch (e) {
    if (e instanceof Error && (e.name === 'AbortError' || e.message === 'Failed to fetch')) {
      throw new Error('Сервер сейчас просыпается — подождите 30 секунд и попробуйте ещё раз.');
    }
    throw e;
  } finally {
    window.clearTimeout(timer);
  }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetchWithTimeout(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API ${res.status} на ${path}`);
  return res.json() as Promise<T>;
}

// Пингуем сервер — просто чтобы разбудить его на Render Free tier.
// Без ожидания результата: если упадёт — не мешаем UI.
export function wakeUpServer(): void {
  fetchWithTimeout(`${API_BASE}/moderation/count`, undefined, 5_000).catch(() => {});
}

export interface ApiCategory {
  id: string;
  slug: string;
  title: string;
  icon?: string;
  color?: string;
}

export interface ApiPhoto {
  id: string;
  path: string;
  kind: 'before' | 'after';
  sort: number;
}

export interface ApiStatusEntry {
  id: string;
  fromStatus: ProblemStatus | null;
  toStatus: ProblemStatus;
  comment: string | null;
  createdAt: string;
}

export interface ApiProblem {
  id: string;
  publicId: number;
  title: string;
  description: string;
  status: ProblemStatus;
  lat: number;
  lng: number;
  addressText?: string;
  signaturesCount: number;
  likesCount: number;
  signatureGoal: number;
  occurredOn?: string;
  publishedAt?: string;
  resolvedAt?: string;
  category?: { slug: string; title: string } | null;
  photos?: ApiPhoto[];
  statusHistory?: ApiStatusEntry[];
}

export interface NearbyProblem {
  id: string;
  publicId: number;
  title: string;
  status: ProblemStatus;
  addressText?: string | null;
  signaturesCount: number;
  likesCount: number;
  distance: number;
  category?: { slug: string; title: string } | null;
}

export interface ProblemsGeoJSON {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: { type: 'Point'; coordinates: [number, number] };
    properties: { id: string; publicId: number; status: ProblemStatus; category?: string; signatures: number; title: string; address?: string };
  }>;
}

export interface ApiSubmission {
  id: string;
  description: string;
  addressText?: string | null;
  lat: number;
  lng: number;
  status: 'pending' | 'published' | 'merged' | 'rejected';
  createdAt: string;
  occurredOn: string;
  rejectReason?: string | null;
  rejectComment?: string | null;
  category?: { slug: string; title: string } | null;
  customCategory?: string | null;
  problem?: { id: string; status: string; title: string } | null;
  photos?: { path: string }[];
}

export const api = {
  categories: () => get<ApiCategory[]>('/categories'),
  problems: (params?: { status?: ProblemStatus; category?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.category) q.set('category', params.category);
    const qs = q.toString();
    return get<ApiProblem[]>('/problems' + (qs ? `?${qs}` : ''));
  },
  geojson: () => get<ProblemsGeoJSON>('/problems/geojson'),
  problem: (id: string) => get<ApiProblem>(`/problems/${id}`),
  nearby: (lat: number, lng: number, opts?: { radius?: number; category?: string }) => {
    const q = new URLSearchParams({ lat: String(lat), lng: String(lng) });
    if (opts?.radius) q.set('radius', String(opts.radius));
    if (opts?.category) q.set('category', opts.category);
    return get<NearbyProblem[]>(`/problems/nearby?${q}`);
  },
  toggleLike: (id: string) => postJson<{ liked: boolean; likesCount: number }>(`/problems/${id}/like`, {}),
  createSubmission: async (fd: FormData): Promise<ApiSubmission> => {
    const res = await fetchWithTimeout(`${API_BASE}/submissions`, { method: 'POST', body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || `Не удалось отправить заявку (${res.status})`);
    }
    return res.json() as Promise<ApiSubmission>;
  },
  mySubmissions: () => get<ApiSubmission[]>('/submissions/my'),

  moderationQueue: () => get<ApiSubmission[]>('/moderation/queue'),
  moderationCount: () => get<{ pending: number }>('/moderation/count'),
  publishSubmission: (id: string, body: { title?: string; categorySlug?: string; description?: string; signatureGoal?: number }) =>
    postJson<ApiProblem>(`/moderation/submissions/${id}/publish`, body),
  rejectSubmission: (id: string, body: { reason: string; comment?: string }) =>
    postJson<ApiSubmission>(`/moderation/submissions/${id}/reject`, body),
  mergeSubmission: (id: string, body: { problemId: string }) =>
    postJson<{ ok: true; problemId: string }>(`/moderation/submissions/${id}/merge`, body),

  changeProblemStatus: (id: string, body: { status: ProblemStatus; comment?: string }) =>
    postJson<ApiProblem>(`/moderation/problems/${id}/status`, body),
  signatureState: (id: string) =>
    get<{ signed: boolean; fullName: string | null; subscribed: boolean; signaturesCount: number }>(
      `/problems/${id}/signature`,
    ),
  sign: (id: string, body: { fullName: string; consentTextVersion?: string }) =>
    postJson<{ signed: boolean; fullName: string | null; subscribed: boolean; signaturesCount: number }>(
      `/problems/${id}/signature`,
      body,
    ),
  revokeSignature: async (id: string) => {
    const res = await fetchWithTimeout(`${API_BASE}/problems/${id}/signature`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`DELETE signature → ${res.status}`);
    return res.json() as Promise<{ signed: boolean; subscribed: boolean; signaturesCount: number }>;
  },
  toggleSubscribe: (id: string) => postJson<{ subscribed: boolean }>(`/problems/${id}/subscribe`, {}),

  analyticsOverview: () =>
    get<{
      submissions: { total: number; week: number; byStatus: Record<string, number> };
      problems: { byStatus: Record<string, number>; resolvedWeek: number; resolvedMonth: number; avgDaysToResolve: number | null };
      topCategories: { title: string; icon: string; count: number }[];
      topStreets: { name: string; total: number; signatures: number }[];
    }>('/moderation/analytics/overview'),

  streetsSummary: () =>
    get<
      Array<{
        key: string;
        name: string;
        total: number;
        found: number;
        inProgress: number;
        resolved: number;
        declined: number;
        signatures: number;
      }>
    >('/moderation/streets'),
  streetProblems: (key: string) => get<ApiProblem[]>(`/moderation/streets/${encodeURIComponent(key)}/problems`),
  createAppeal: (body: { streetKey: string; problemIds: string[] }) =>
    postJson<{ id: string; filePath: string; totalSignatures: number; problems: number; streetName: string }>(
      '/moderation/appeals',
      body,
    ),

  notificationsMine: () =>
    get<
      Array<{
        id: string;
        type: string;
        status: string;
        read: boolean;
        problemId: string | null;
        createdAt: string;
        payload: { message?: string; problemTitle?: string | null; reason?: string | null; comment?: string | null } | null;
      }>
    >('/notifications/mine'),
  notificationsCount: () => get<{ unread: number }>('/notifications/count'),
  notificationsReadAll: () => postJson<{ ok: true }>('/notifications/read-all', {}),

  addProblemPhotos: async (id: string, kind: 'before' | 'after', files: File[]): Promise<ApiPhoto[]> => {
    const fd = new FormData();
    files.forEach((f) => fd.append('photos', f));
    const res = await fetchWithTimeout(`${API_BASE}/moderation/problems/${id}/photos?kind=${kind}`, { method: 'POST', body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || `POST photos → ${res.status}`);
    }
    return res.json() as Promise<ApiPhoto[]>;
  },
};

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetchWithTimeout(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.message || `POST ${path} → ${res.status}`);
  }
  return res.json() as Promise<T>;
}
