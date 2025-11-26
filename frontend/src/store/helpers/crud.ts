import { getDb } from '@/db/service';
import { WorkoutDay, Exercise, RestPeriod } from '@/db/schema';
import type { Set } from '@/db/schema';
import { v4 as uuidv4 } from 'uuid';
import { WorkoutState } from '../useWorkoutStore';

export const addExercise = async (catalogId: string, name: string, get: () => WorkoutState, position: number): Promise<string> => {
  const { userId, selectedDate, exercises, activeDay } = get();
  if (!userId) return '';

  const db = await getDb();
  let dayDoc = activeDay;

  // Create day if it doesn't exist
  if (!dayDoc) {
    const newDay: WorkoutDay = {
      id: uuidv4(),
      serverId: null,
      userId: userId,
      workoutDate: selectedDate,
      isRestDay: false,
      isSynced: false, // Mark as not synced
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    dayDoc = await db.workout_days.insert(newDay);
  }

  const newExercise: Exercise = {
    id: uuidv4(),
    serverId: null,
    dayId: dayDoc.id,
    catalogId: catalogId,
    name: name,
    position: position, // Use the provided position
    isSynced: false, // Mark as not synced
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await db.exercises.insert(newExercise);
  return newExercise.id;
};

export const updateExercise = async (id: string, patch: Partial<Exercise>) => {
  const db = await getDb();
  const doc = await db.exercises.findOne(id).exec();
  if (doc) {
    await doc.incrementalPatch({ ...patch, isSynced: false });
  }
};

export const deleteExercise = async (id: string) => {
  const db = await getDb();
  const doc = await db.exercises.findOne(id).exec();
  if (doc) {
    // Track deletion for syncing if it has a serverId
    if (doc.serverId) {
      await db.deleted_documents.insert({
        id: doc.id,
        serverId: doc.serverId,
        collectionName: 'exercises',
        deletedAt: new Date().toISOString(),
      });
    }
    await doc.remove();
  }
};

export const addSet = async (exerciseId: string, get: () => WorkoutState) => {
  const { userId, selectedDate, sets, restPeriods } = get();
  if (!userId) return;

  const db = await getDb();
  
  const exerciseSets = sets.filter(s => s.exerciseId === exerciseId);
  const exerciseRests = restPeriods.filter(r => r.exerciseId === exerciseId);
  
  const maxSetPos = exerciseSets.length > 0 ? Math.max(...exerciseSets.map(s => s.position)) : -1;
  const maxRestPos = exerciseRests.length > 0 ? Math.max(...exerciseRests.map(r => r.position)) : -1;
  const nextPosition = Math.max(maxSetPos, maxRestPos) + 1;

  const newSet: Set = {
    id: uuidv4(),
    serverId: null,
    exerciseId: exerciseId,
    userId: userId,
    workoutDate: selectedDate,
    position: nextPosition,
    reps: 1,
    weightKg: 0,
    isWarmup: false,
    isSynced: false, // Mark as not synced
    volumeKg: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await db.sets.insert(newSet);
};

export const updateSet = async (id: string, patch: Partial<Set>) => {
  const db = await getDb();
  const doc = await db.sets.findOne(id).exec();
  if (doc) {
    await doc.incrementalPatch({ ...patch, isSynced: false });
  }
};

export const deleteSet = async (id: string) => {
  const db = await getDb();
  const doc = await db.sets.findOne(id).exec();
  if (doc) {
    // Track deletion for syncing if it has a serverId
    if (doc.serverId) {
      await db.deleted_documents.insert({
        id: doc.id,
        serverId: doc.serverId,
        collectionName: 'sets',
        deletedAt: new Date().toISOString(),
      });
    }

    await doc.remove();
  }
};

export const addRest = async (exerciseId: string, position: number) => {
  const db = await getDb();
  const newRest: RestPeriod = {
    id: uuidv4(),
    serverId: null,
    exerciseId: exerciseId,
    position: position,
    durationSeconds: 90,
    isSynced: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await db.rest_periods.insert(newRest);
};

export const updateRest = async (id: string, patch: Partial<RestPeriod>) => {
  const db = await getDb();
  const doc = await db.rest_periods.findOne(id).exec();
  if (doc) {
    await doc.incrementalPatch({ ...patch, isSynced: false });
  }
};

export const deleteRest = async (id: string) => {
  const db = await getDb();
  const doc = await db.rest_periods.findOne(id).exec();
  if (doc) {
    // Track deletion for syncing if it has a serverId
    if (doc.serverId) {
      await db.deleted_documents.insert({
        id: doc.id,
        serverId: doc.serverId,
        collectionName: 'rest_periods',
        deletedAt: new Date().toISOString(),
      });
    }
    await doc.remove();
  }
};

export const updateDay = async (id: string, patch: Partial<WorkoutDay>) => {
  const db = await getDb();
  const doc = await db.workout_days.findOne(id).exec();
  if (doc) {
    await doc.incrementalPatch({ ...patch, isSynced: false });
  }
};
