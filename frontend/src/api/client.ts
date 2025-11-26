const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  try {
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
    const data = await res.json() as Promise<T>;
    return data;
  } catch (error) {
    throw error;
  }
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
  hasImage?: boolean;
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
  hasImage?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type ExerciseStats = {
  highestWeightKg: number;
  history: ExerciseHistoryItem[];
  hasMore?: boolean;
};

export type ExerciseHistoryItem = {
  workoutDate: string;
  sets: SetHistory[];
};

export type SetHistory = {
  reps: number;
  weightKg: number;
  isWarmup: boolean;
};

export type SaveOperation =
  | { type: 'createDay'; localId: string; workoutDate: string; timezone?: string }
  | { type: 'createExercise'; localId: string; dayId: string; catalogId: string; position: number; comment?: string }
  | { type: 'createSet'; localId: string; exerciseId: string; position: number; reps: number; weightKg: number; isWarmup?: boolean }
  | { type: 'createRest'; localId: string; exerciseId: string; position: number; durationSeconds: number }
  | { type: 'updateExercise'; exerciseId: string; patch: Partial<{ position: number; comment: string }> }
  | { type: 'updateSet'; setId: string; patch: Partial<{ position: number; reps: number; weightKg: number; isWarmup: boolean }> }
  | { type: 'updateRest'; restId: string; patch: Partial<{ position: number; durationSeconds: number }> }
  | { type: 'reorderExercises'; dayId: string; orderedIds: string[] }
  | { type: 'reorderSets'; exerciseId: string; orderedIds: string[] }
  | { type: 'deleteExercise'; exerciseId: string }
  | { type: 'deleteSet'; setId: string }
  | { type: 'deleteRest'; restId: string }
  | { type: 'updateDay'; dayId: string; isRestDay: boolean };

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
  getDayByDate: (date: string, ensure = true) => {
    return request<DayWithDetails | { day: null }>(`/api/days?date=${date}&ensure=${ensure ? 'true' : 'false'}`);
  },
  createDay: (date: string) =>
    request<DayWithDetails>('/api/days', { method: 'POST', body: JSON.stringify({ date }) }),
  updateDay: (dayId: string, data: { isRestDay: boolean }) =>
    request<DayWithDetails>(`/api/days/${dayId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  getSaveEpoch: () => request<{ serverEpoch: number }>('/api/save/epoch'),

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
  updateCatalogEntry: async (id: string, data: CatalogEntryInput, imageFile?: File | null, removeImage?: boolean) => {
    const formData = new FormData()
    formData.append('metadata', JSON.stringify(data))
    if (imageFile) {
      formData.append('file', imageFile)
    }
    if (removeImage) {
      formData.append('removeImage', 'true')
    }
    const res = await fetch(`${API_BASE}/api/catalog/entries/${id}`, {
      method: 'PUT',
      credentials: 'include',
      body: formData
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      let message = text
      try {
        const json = JSON.parse(text)
        message = json.error || json.message || text
      } catch {
        // Not JSON, use text as-is
      }
      throw new Error(message || `HTTP ${res.status}`)
    }
    const json = await res.json()
    return json as CatalogRecord
  },
  createCatalogEntry: async (data: CatalogEntryInput, imageFile?: File | null) => {
    if (imageFile) {
      // Use multipart/form-data when image is present
      const formData = new FormData()
      formData.append('metadata', JSON.stringify(data))
      formData.append('file', imageFile)
      const res = await fetch(`${API_BASE}/api/catalog/admin/import`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        let message = text
        try {
          const json = JSON.parse(text)
          message = json.error || json.message || text
        } catch {
          // Not JSON, use text as-is
        }
        throw new Error(message || `HTTP ${res.status}`)
      }
      const json = await res.json()
      return json as { upserted: number; entry?: CatalogRecord }
    } else {
      // Use JSON when no image
      return request<{ upserted: number }>('/api/catalog/admin/import', {
        method: 'POST',
        body: JSON.stringify([data])
      })
    }
  },
  deleteCatalogEntry: (id: string) => request<void>(`/api/catalog/entries/${id}`, { method: 'DELETE' }),
  getExerciseStats: (id: string, limit?: number, offset?: number) => {
    const params = new URLSearchParams()
    if (limit !== undefined) params.append('limit', limit.toString())
    if (offset !== undefined) params.append('offset', offset.toString())
    const query = params.toString()
    return request<ExerciseStats>(`/api/catalog/entries/${id}/stats${query ? `?${query}` : ''}`)
  },

  // Batch save
  saveBatch: (
    ops: Array<SaveOperation>,
    idempotencyKey?: string,
    clientEpoch?: number
  ) =>
    (async () => {
      const res = await fetch(`${API_BASE}/api/save`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: 'v1',
          idempotencyKey,
          clientEpoch: clientEpoch ?? Number(localStorage.getItem('saveEpoch') || '0'),
          ops
        })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const code = (data && data.error && data.error.code) || ''
        const serverEpoch = data && data.serverEpoch
        const err = new Error(code || `HTTP ${res.status}`)
        ;(err as any).code = code
        ;(err as any).serverEpoch = serverEpoch
        throw err
      }
      return data as {
        applied: boolean
        mapping: {
          exercises: { localId: string; id: string }[]
          sets: { localId: string; id: string }[]
          rests: { localId: string; id: string }[]
        }
        updatedAt: string
        serverEpoch: number
      }
    })()
};

