import { getDb } from '@/db/service'
import { WorkoutDay, Exercise } from '@/db/schema'
import type { Set, Rest } from '@/db/schema'
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
  const { userId, selectedDate, sets, rests } = get();
  if (!userId) return;

  const db = await getDb()
  const exerciseSets = sets.filter(s => s.exerciseId === exerciseId);
  const exerciseRests = rests.filter((rest) => rest.exerciseId === exerciseId)
  const positions = [...exerciseSets, ...exerciseRests].map((item) => item.position)
  const nextPosition = positions.length > 0 ? Math.max(...positions) + 1 : 0

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
  await db.sets.insert(newSet)
};

export const addRest = async (exerciseId: string, get: () => WorkoutState, durationSeconds = 60) => {
  const { rests, sets } = get()
  const db = await getDb()
  const exerciseRests = rests.filter((rest) => rest.exerciseId === exerciseId)
  const exerciseSets = sets.filter((set) => set.exerciseId === exerciseId)
  const positions = [...exerciseRests, ...exerciseSets].map((item) => item.position)
  const nextPosition = positions.length > 0 ? Math.max(...positions) + 1 : 0

  const newRest: Rest = {
    id: uuidv4(),
    serverId: null,
    exerciseId,
    position: nextPosition,
    durationSeconds,
    isSynced: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  await db.rest_periods.insert(newRest)
}

export const updateSet = async (id: string, patch: Partial<Set>) => {
  const db = await getDb()
  await db.sets.update(id, { ...patch, isSynced: false })
};

export const updateRest = async (id: string, patch: Partial<Rest>) => {
  const db = await getDb()
  await db.rest_periods.update(id, { ...patch, isSynced: false })
  }

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

export const deleteRest = async (id: string) => {
  const db = await getDb()
  const doc = await db.rest_periods.findOne(id).exec()
  if (!doc) return

  if (doc.serverId) {
    await db.deleted_documents.insert({
      id: doc.id,
      serverId: doc.serverId,
      collectionName: 'rests',
      deletedAt: new Date().toISOString()
    })
    }

  await db.rest_periods.remove(id)
  }

export const updateDay = async (id: string, patch: Partial<WorkoutDay>) => {
  const db = await getDb()
  await db.workout_days.update(id, { ...patch, isSynced: false })
};
