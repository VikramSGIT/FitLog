import { RxJsonSchema, RxDocument } from 'rxdb';

// Using a composite key for workout_days to ensure uniqueness per user/date
// However, RxDB doesn't directly support composite primary keys in the same way a relational DB does.
// The 'id' will be a concatenation of user_id and workout_date, e.g., `${userId}_${workoutDate}`.
// For unsynced workout days, we can use a temporary ID.

export type WorkoutDay = {
  id: string; // This will be the backend ID. Can be null if not synced.
  id?: string; // UUID generated on the client. Primary for local documents.
  isSynced?: boolean;
  userId: string;
  workoutDate: string; // ISO 8601 date string 'YYYY-MM-DD'
  timezone?: string;
  notes?: string;
  isRestDay: boolean;
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
};

export type Exercise = {
  id: string; // Backend ID, can be null
  id?: string; // Client-side UUID
  isSynced?: boolean;
  dayId: string; // Corresponds to WorkoutDay's id or id
  catalogId?: string;
  name: string;
  position: number;
  comment?: string;
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
};

export type Set = {
  id: string; // Backend ID, can be null
  id?: string; // Client-side UUID
  isSynced?: boolean;
  exerciseId: string; // Corresponds to Exercise's id or id
  userId: string;
  workoutDate: string; // ISO 8601 date string 'YYYY-MM-DD'
  position: number;
  reps: number;
  weightKg: number;
  rpe?: number;
  isWarmup: boolean;
  restSeconds?: number;
  tempo?: string;
  performedAt?: string; // ISO 8601 timestamp
  volumeKg: number; // This can be a calculated field
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
};

// RxDB requires a primary key to be defined. We will use `id` as the primary
// key for local operations and `id` for synced documents.
// When a document is synced, the backend `id` will be saved.

export const workoutDaySchema: RxJsonSchema<WorkoutDay> = {
  title: 'workout day schema',
  version: 0,
  description: 'describes a single day of a workout',
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: ['string', 'null'] },
    id: { type: 'string', maxLength: 36 },
    isSynced: { type: 'boolean' },
    userId: { type: 'string', final: true, maxLength: 36 },
    workoutDate: { type: 'string', format: 'date', maxLength: 10 },
    timezone: { type: 'string' },
    notes: { type: 'string' },
    isRestDay: { type: 'boolean' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'userId', 'workoutDate', 'isRestDay', 'createdAt', 'updatedAt', 'isSynced'],
  indexes: ['workoutDate', 'isSynced', ['userId', 'workoutDate']],
};

export const exerciseSchema: RxJsonSchema<Exercise> = {
  title: 'exercise schema',
  version: 0,
  description: 'describes an exercise within a workout day',
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: ['string', 'null'] },
    id: { type: 'string', maxLength: 36 },
    isSynced: { type: 'boolean' },
    dayId: { type: 'string', ref: 'workout_days', maxLength: 36 },
    catalogId: { type: 'string' },
    name: { type: 'string' },
    position: { type: 'integer', minimum: 0, maximum: 1000, multipleOf: 1 },
    comment: { type: 'string' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'dayId', 'name', 'position', 'createdAt', 'updatedAt', 'isSynced'],
  indexes: ['dayId', 'position', 'isSynced'],
};

export const setSchema: RxJsonSchema<Set> = {
  title: 'set schema',
  version: 0,
  description: 'describes a set within an exercise',
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: ['string', 'null'] },
    id: { type: 'string', maxLength: 36 },
    isSynced: { type: 'boolean' },
    exerciseId: { type: 'string', ref: 'exercises', maxLength: 36 },
    userId: { type: 'string', maxLength: 36 },
    workoutDate: { type: 'string', format: 'date', maxLength: 10 },
    position: { type: 'integer', minimum: 0, maximum: 1000, multipleOf: 1 },
    reps: { type: 'integer', minimum: 1 },
    weightKg: { type: 'number', minimum: 0 },
    rpe: { type: 'number', minimum: 0, maximum: 10 },
    isWarmup: { type: 'boolean' },
    restSeconds: { type: 'integer', minimum: 0 },
    tempo: { type: 'string' },
    performedAt: { type: 'string', format: 'date-time' },
    volumeKg: { type: 'number' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  required: [
    'id',
    'exerciseId',
    'userId',
    'workoutDate',
    'position',
    'reps',
    'weightKg',
    'isWarmup',
    'createdAt',
    'updatedAt',
    'isSynced',
  ],
  indexes: ['exerciseId', 'position', 'isSynced', 'workoutDate'],
};

export type WorkoutDayDoc = RxDocument<WorkoutDay>;
export type ExerciseDoc = RxDocument<Exercise>;
export type SetDoc = RxDocument<Set>;

export type DeletedDocument = {
  id: string | null;
  id: string;
  collectionName: string;
  deletedAt: string;
};

export const deletedDocumentSchema: RxJsonSchema<DeletedDocument> = {
  title: 'deleted document schema',
  version: 0,
  description: 'stores information about deleted documents for syncing',
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: ['string', 'null'] },
    id: { type: 'string', maxLength: 36 },
    collectionName: { type: 'string' },
    deletedAt: { type: 'string', format: 'date-time', maxLength: 29 },
  },
  required: ['id', 'collectionName', 'deletedAt'],
  indexes: ['deletedAt'],
};

export type DeletedDocumentDoc = RxDocument<DeletedDocument>;
