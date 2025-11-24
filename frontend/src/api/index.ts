const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
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

export * from './auth'
export * from './catalog'
export * from './days'
export * from './exercises'
export * from './sets'
export * from './rests'
export * from './save'

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

