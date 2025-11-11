const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

export type WorkoutSet = {
  id: string;
  exerciseId: string;
  userId: string;
  workoutDate: string;
  position: number;
  reps: number;
  weightKg: number;
  rpe?: number;
  isWarmup: boolean;
  restSeconds?: number;
  tempo?: string;
  performedAt?: string;
  volumeKg: number;
};

export type RestPeriod = {
  id: string;
  exerciseId: string;
  position: number;
  durationSeconds: number;
  createdAt: string;
  updatedAt: string;
};

export type ExerciseEntry =
  | { kind: 'set'; set: WorkoutSet; rest?: never }
  | { kind: 'rest'; rest: RestPeriod; set?: never };

export type Exercise = {
  id: string;
  dayId: string;
  catalogId?: string;
  name: string;
  position: number;
  comment?: string;
  sets: WorkoutSet[];
  restPeriods?: RestPeriod[];
  timeline?: ExerciseEntry[];
};

export type WorkoutDay = {
  id: string;
  userId: string;
  workoutDate: string; // date
  isRestDay: boolean;
  timezone?: string | null;
  notes?: string | null;
};

export type DayWithDetails = WorkoutDay & { exercises: Exercise[] };

export type CatalogItem = {
  id: string;
  name: string;
  type?: string;
  bodyPart?: string;
  equipment?: string;
  level?: string;
  primaryMuscles: string[];
  multiplier: number;
  baseWeightKg: number;
  secondaryMuscles?: string[];
};

export type CatalogEntryInput = {
  name: string;
  description?: string;
  type: string;
  bodyPart: string;
  equipment: string;
  level: string;
  primaryMuscles: string[];
  secondaryMuscles?: string[];
  links?: string[];
  multiplier?: number;
  baseWeightKg?: number;
};

export type CatalogRecord = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  type: string;
  bodyPart: string;
  equipment: string;
  level: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  links: string[];
  multiplier: number | null;
  baseWeightKg: number | null;
  createdAt?: string;
  updatedAt?: string;
};

export const api = {
  // Catalog search
  searchCatalog: (params: {
    q?: string
    type?: string
    bodyPart?: string
    equipment?: string
    level?: string
    muscle?: string
    page?: number
    pageSize?: number
    sort?: 'name_asc' | 'name_desc'
  }) => {
    const qs = new URLSearchParams()
    if (params.q) qs.set('q', params.q)
    if (params.type) qs.set('type', params.type)
    if (params.bodyPart) qs.set('bodyPart', params.bodyPart)
    if (params.equipment) qs.set('equipment', params.equipment)
    if (params.level) qs.set('level', params.level)
    if (params.muscle) qs.set('muscle', params.muscle)
    if (params.page) qs.set('page', String(params.page))
    if (params.pageSize) qs.set('pageSize', String(params.pageSize))
    if (params.sort) qs.set('sort', params.sort)
    return request<{ items: CatalogItem[]; page: number; pageSize: number; total: number; hasMore: boolean }>(`/api/catalog?${qs.toString()}`)
  },
  // Auth
  register: (email: string, password: string) =>
    request<{ userId: string; email: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    }),
  login: (email: string, password: string) =>
    request<{ userId: string; email: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    }),
  logout: () => request<void>('/api/auth/logout', { method: 'POST' }),
  me: () => request<{ userId: string; email: string }>('/api/auth/me'),

  // Days
  getDayByDate: (date: string, ensure = true) =>
    request<DayWithDetails | { day: null }>(`/api/days?date=${date}&ensure=${ensure ? 'true' : 'false'}`),
  createDay: (date: string) =>
    request<DayWithDetails>('/api/days', { method: 'POST', body: JSON.stringify({ date }) }),
  updateDay: (dayId: string, data: { isRestDay: boolean }) =>
    request<DayWithDetails>(`/api/days/${dayId}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Exercises
  createExercise: (dayId: string, data: { position: number; catalogId: string; comment?: string }) =>
    request<Exercise>(`/api/days/${dayId}/exercises`, { method: 'POST', body: JSON.stringify(data) }),
  updateExercise: (id: string, data: Partial<{ position: number; comment: string }>) =>
    request<Exercise>(`/api/exercises/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteExercise: (id: string) => request<void>(`/api/exercises/${id}`, { method: 'DELETE' }),

  // Sets
  createSet: (
    exerciseId: string,
    data: Partial<{
      position: number;
      reps: number;
      weightKg: number;
      rpe: number;
      isWarmup: boolean;
      restSeconds: number;
      tempo: string;
      performedAt: string;
    }>
  ) => request<WorkoutSet>(`/api/exercises/${exerciseId}/sets`, { method: 'POST', body: JSON.stringify(data) }),
  updateSet: (id: string, data: Partial<WorkoutSet>) =>
    request<WorkoutSet>(`/api/sets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteSet: (id: string) => request<void>(`/api/sets/${id}`, { method: 'DELETE' }),

  // Rest periods
  createRest: (exerciseId: string, data: { position: number; durationSeconds: number }) =>
    request<RestPeriod>(`/api/exercises/${exerciseId}/rests`, {
      method: 'POST',
      body: JSON.stringify({
        position: data.position,
        durationSeconds: data.durationSeconds
      })
    }),
  updateRest: (id: string, data: Partial<{ position: number; durationSeconds: number }>) =>
    request<RestPeriod>(`/api/rests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),
  deleteRest: (id: string) => request<void>(`/api/rests/${id}`, { method: 'DELETE' }),
  // Facets for catalog filters
  getCatalogFacets: () =>
    request<{ types: string[]; bodyParts: string[]; equipment: string[]; levels: string[]; muscles: string[] }>(
      '/api/catalog/facets'
    ),
  // Admin catalog management
  getCatalogEntry: (id: string) => request<CatalogRecord>(`/api/catalog/entries/${id}`),
  updateCatalogEntry: (id: string, data: CatalogEntryInput) =>
    request<CatalogRecord>(`/api/catalog/entries/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  createCatalogEntry: (data: CatalogEntryInput) =>
    request<{ upserted: number }>('/api/catalog/admin/import', {
      method: 'POST',
      body: JSON.stringify([data])
    }),

  // Batch save
  saveBatch: (
    ops: Array<
      | { type: 'createExercise'; tempId: string; dayId: string; catalogId: string; position: number; comment?: string }
      | { type: 'createSet'; tempId: string; exerciseId: string; position: number; reps: number; weightKg: number; isWarmup?: boolean }
      | { type: 'updateExercise'; id: string; patch: Partial<{ position: number; comment: string }> }
      | { type: 'updateSet'; id: string; patch: Partial<{ position: number; reps: number; weightKg: number; isWarmup: boolean }> }
      | { type: 'reorderExercises'; dayId: string; orderedIds: string[] }
      | { type: 'reorderSets'; exerciseId: string; orderedIds: string[] }
      | { type: 'deleteExercise'; id: string }
      | { type: 'deleteSet'; id: string }
      | { type: 'createRest'; tempId: string; exerciseId: string; position: number; durationSeconds: number }
      | { type: 'updateRest'; id: string; patch: Partial<{ position: number; durationSeconds: number }> }
      | { type: 'deleteRest'; id: string }
      | { type: 'updateDay'; dayId: string; isRestDay: boolean }
    >,
    idempotencyKey?: string
  ) =>
    request<{
      applied: boolean
      mapping: {
        exercises: { tempId: string; id: string }[]
        sets: { tempId: string; id: string }[]
        rests: { tempId: string; id: string }[]
      }
      updatedAt: string
    }>('/api/save', {
      method: 'POST',
      body: JSON.stringify({
        version: 'v1',
        idempotencyKey,
        ops
      })
    })
};

