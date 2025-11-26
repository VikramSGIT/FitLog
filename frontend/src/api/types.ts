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
