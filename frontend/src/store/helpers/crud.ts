import { getDb } from '@/db/service'
import { WorkoutDay, Exercise } from '@/db/schema'
import type { Set } from '@/db/schema'
import { v4 as uuidv4 } from 'uuid'
import { WorkoutState } from '../useWorkoutStore'

export const addExercise = async (
  catalogId: string,
  name: string,
  get: () => WorkoutState,
  positionOverride?: number
): Promise<string> => {
  const { userId, selectedDate, exercises, activeDay } = get()
  if (!userId) return ''

  const db = await getDb()
  let dayDoc = activeDay

  if (!dayDoc) {
    const newDay: WorkoutDay = {
      id: uuidv4(),
      serverId: null,
      userId,
      workoutDate: selectedDate,
      isRestDay: false,
      isSynced: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    dayDoc = await db.workout_days.insert(newDay)
  }

  const position = typeof positionOverride === 'number' ? positionOverride : exercises.length

  const newExercise: Exercise = {
    id: uuidv4(),
    serverId: null,
    dayId: dayDoc.id,
    catalogId,
    name,
    position,
    isSynced: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  await db.exercises.insert(newExercise)
  return newExercise.id
}

export const updateExercise = async (id: string, patch: Partial<Exercise>) => {
  const db = await getDb()
  await db.exercises.update(id, { ...patch, isSynced: false })
};

export const deleteExercise = async (id: string) => {
  const db = await getDb()
  const doc = await db.exercises.findOne(id).exec()
  if (!doc) return

  if (doc.serverId) {
    await db.deleted_documents.insert({
      id: doc.id,
      serverId: doc.serverId,
      collectionName: 'exercises',
      deletedAt: new Date().toISOString()
    })
  }

  await db.exercises.remove(id)
};

export const addSet = async (exerciseId: string, get: () => WorkoutState) => {
  const { userId, selectedDate, sets } = get();
  if (!userId) return;

  const db = await getDb()
  const exerciseSets = sets.filter(s => s.exerciseId === exerciseId);

  const newSet: Set = {
    id: uuidv4(),
    serverId: null,
    exerciseId: exerciseId,
    userId: userId,
    workoutDate: selectedDate,
    position: exerciseSets.length,
    reps: 1,
    weightKg: 0,
    isWarmup: false,
    isSynced: false, // Mark as not synced
    volumeKg: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await db.sets.insert(newSet)
};

export const updateSet = async (id: string, patch: Partial<Set>) => {
  const db = await getDb()
  await db.sets.update(id, { ...patch, isSynced: false })
};

export const deleteSet = async (id: string) => {
  const db = await getDb()
  const doc = await db.sets.findOne(id).exec()
  if (!doc) return

  if (doc.serverId) {
    await db.deleted_documents.insert({
      id: doc.id,
      serverId: doc.serverId,
      collectionName: 'sets',
      deletedAt: new Date().toISOString()
    })
  }

  await db.exercises.update(doc.exerciseId, { isSynced: false })
  await db.sets.remove(id)
};

export const updateDay = async (id: string, patch: Partial<WorkoutDay>) => {
  const db = await getDb()
  await db.workout_days.update(id, { ...patch, isSynced: false })
};
