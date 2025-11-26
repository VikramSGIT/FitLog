import { RxJsonSchema, RxDocument } from 'rxdb';

// This schema uses a stable, client-generated 'id' as the primary key.
// 'serverId' will store the ID from the backend once the document is synced.
// 'isSynced' is a boolean flag to track the sync status.

export type WorkoutDay = {
  id: string; // Stable, client-generated UUID, Primary Key
  serverId: string | null;
  isSynced: boolean;
  userId: string;
  workoutDate: string; // ISO 8601 date string 'YYYY-MM-DD'
  timezone?: string;
  notes?: string;
  isRestDay: boolean;
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
};

export type Exercise = {
  id: string; // Stable, client-generated UUID, Primary Key
  serverId: string | null;
  isSynced: boolean;
  dayId: string; // Corresponds to WorkoutDay's stable 'id'
  catalogId?: string;
  name: string;
  position: number;
  comment?: string;
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
};

export type Set = {
  id: string; // Stable, client-generated UUID, Primary Key
  serverId: string | null;
  isSynced: boolean;
  exerciseId: string; // Corresponds to Exercise's stable 'id'
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

export type RestPeriod = {
  id: string; // Stable, client-generated UUID, Primary Key
  serverId: string | null;
  isSynced: boolean;
  exerciseId: string; // Corresponds to Exercise's stable 'id'
  position: number;
  durationSeconds: number;
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
};

export const workoutDaySchema: RxJsonSchema<WorkoutDay> = {
  title: 'workout day schema',
  version: 0, // Start at version 0 to avoid migration issues
  description: 'describes a single day of a workout',
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 36 },
    serverId: { type: ['string', 'null'] },
    isSynced: { type: 'boolean', default: false },
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
  version: 0, // Start at version 0 to avoid migration issues
  description: 'describes an exercise within a workout day',
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 36 },
    serverId: { type: ['string', 'null'] },
    isSynced: { type: 'boolean', default: false },
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
  version: 0, // Start at version 0 to avoid migration issues
  description: 'describes a set within an exercise',
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 36 },
    serverId: { type: ['string', 'null'] },
    isSynced: { type: 'boolean', default: false },
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

export const restPeriodSchema: RxJsonSchema<RestPeriod> = {
  title: 'rest period schema',
  version: 0,
  description: 'describes a rest period within an exercise',
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 36 },
    serverId: { type: ['string', 'null'] },
    isSynced: { type: 'boolean', default: false },
    exerciseId: { type: 'string', ref: 'exercises', maxLength: 36 },
    position: { type: 'integer', minimum: 0, maximum: 1000, multipleOf: 1 },
    durationSeconds: { type: 'integer', minimum: 0 },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  required: [
    'id',
    'exerciseId',
    'position',
    'durationSeconds',
    'createdAt',
    'updatedAt',
    'isSynced',
  ],
  indexes: ['exerciseId', 'position', 'isSynced'],
};

export type WorkoutDayDoc = RxDocument<WorkoutDay>;
export type ExerciseDoc = RxDocument<Exercise>;
export type SetDoc = RxDocument<Set>;
export type RestPeriodDoc = RxDocument<RestPeriod>;

export type DeletedDocument = {
  id: string; // The local UUID of the deleted document
  serverId: string | null; // The server ID, if it was synced
  collectionName: string;
  deletedAt: string;
};

export const deletedDocumentSchema: RxJsonSchema<DeletedDocument> = {
  title: 'deleted document schema',
  version: 0, // Start at version 0 to avoid migration issues
  description: 'stores information about deleted documents for syncing',
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 36 },
    serverId: { type: ['string', 'null'] },
    collectionName: { type: 'string' },
    deletedAt: { type: 'string', format: 'date-time', maxLength: 30 },
  },
  required: ['id', 'collectionName', 'deletedAt'],
  indexes: ['deletedAt'],
};

export type DeletedDocumentDoc = RxDocument<DeletedDocument>;
