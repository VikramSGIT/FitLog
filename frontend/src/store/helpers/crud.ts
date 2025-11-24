import { getDb } from '@/db/service';
import { WorkoutDay, Exercise } from '@/db/schema';
import type { Set } from '@/db/schema';
import { v4 as uuidv4 } from 'uuid';
import { WorkoutState } from '../useWorkoutStore';

export const addExercise = async (catalogId: string, name: string, get: () => WorkoutState): Promise<string> => {
    const { userId, selectedDate, exercises, activeDay } = get();
    if (!userId) return '';
    
    const db = await getDb();
      let dayDoc = activeDay;

      // Create day if it doesn't exist
      if (!dayDoc) {
        const newDay: WorkoutDay = {
          id: null as any,
            tempId: uuidv4(),
            userId: userId,
            workoutDate: selectedDate,
            isRestDay: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isUnsynced: true,
        };
        dayDoc = await db.workout_days.insert(newDay);
        // The subscription will update activeDay automatically
    }

    const newExercise: Exercise = {
        id: null as any,
        tempId: uuidv4(),
        dayId: dayDoc.tempId!,
        catalogId: catalogId,
        name: name,
        position: exercises.length,
        isUnsynced: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    await db.exercises.insert(newExercise);
      return newExercise.tempId!;
};

export const queueCreateExercise = async ({ dayId, catalogId, nameDisplay, position }: { dayId: string; catalogId: string; nameDisplay: string; position: number }, get: () => WorkoutState) => {
    const { userId, activeDay, selectedDate } = get();
  if (!userId) return;
  
  const db = await getDb();
    let dayDoc = activeDay;

    // Find or create day
    if (!dayDoc || (dayDoc.tempId !== dayId && dayDoc.id !== dayId)) {
      dayDoc = await db.workout_days.findOne({
      selector: {
        $or: [
            { tempId: dayId },
            { id: dayId }
        ]
      }
    }).exec();
    
      if (!dayDoc) {
      const newDay: WorkoutDay = {
          id: null as any,
        tempId: uuidv4(),
        userId: userId,
          workoutDate: selectedDate,
        isRestDay: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isUnsynced: true,
      };
        dayDoc = await db.workout_days.insert(newDay);
    }
  }
  
  const newExercise: Exercise = {
      id: null as any,
    tempId: uuidv4(),
      dayId: dayDoc.tempId!,
    catalogId: catalogId,
    name: nameDisplay,
    position: position,
    isUnsynced: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await db.exercises.insert(newExercise);
};

export const updateExercise = async (tempId: string, patch: Partial<Exercise>) => {
  const db = await getDb();
  const doc = await db.exercises.findOne(tempId).exec();
  if (doc) {
      await doc.incrementalModify((oldData: Exercise) => ({...oldData, ...patch, isUnsynced: true}));
  }
};

export const deleteExercise = async (tempId: string) => {
  const db = await getDb();
  const doc = await db.exercises.findOne(tempId).exec();
  if (doc) {
      // Track deletion if synced
    if (doc.id) {
      await db.deleted_documents.insert({
          id: doc.id as any,
          tempId: uuidv4(),
        collectionName: 'exercises',
        deletedAt: new Date().toISOString(),
      });
    }
    await doc.remove();
  }
};

export const addSet = async (exerciseTempId: string, get: () => WorkoutState) => {
  const { userId, selectedDate, sets } = get();
    if (!userId) return;

  const db = await getDb();
    const exerciseSets = sets.filter(s => s.exerciseId === exerciseTempId);

  const newSet: Set = {
      id: null as any,
      tempId: uuidv4(),
      exerciseId: exerciseTempId,
      userId: userId,
      workoutDate: selectedDate,
      position: exerciseSets.length,
      reps: 1,
      weightKg: 0,
      isWarmup: false,
      isUnsynced: true,
      volumeKg: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
  };
  await db.sets.insert(newSet);
};

export const updateSet = async (tempId: string, patch: Partial<Set>) => {
  const db = await getDb();
  const doc = await db.sets.findOne(tempId).exec();
    if (doc) {
      await doc.incrementalModify((oldData: Set) => ({...oldData, ...patch, isUnsynced: true}));
  }
};

export const deleteSet = async (tempId: string) => {
  const db = await getDb();
  const doc = await db.sets.findOne(tempId).exec();
    if (doc) {
      // Track deletion if synced
      if (doc.id) {
        await db.deleted_documents.insert({
          id: doc.id as any,
          tempId: uuidv4(),
          collectionName: 'sets',
          deletedAt: new Date().toISOString(),
        });
      }
      
      // Mark parent exercise as unsynced when a set is deleted
      // Try to find exercise by tempId first (most common case)
      let exerciseDoc = await db.exercises.findOne(doc.exerciseId).exec();
      // If not found, try to find by id (in case exerciseId is a server ID)
      if (!exerciseDoc) {
        const exercises = await db.exercises.find({ selector: { id: doc.exerciseId } }).exec();
        exerciseDoc = exercises[0] || null;
      }
      if (exerciseDoc) {
        await exerciseDoc.incrementalModify((oldData: Exercise) => ({...oldData, isUnsynced: true}));
      }
      
      await doc.remove();
  }
};

export const updateDay = async (tempId: string, patch: Partial<WorkoutDay>) => {
  const db = await getDb();
  const doc = await db.workout_days.findOne(tempId).exec();
    if (doc) {
      await doc.incrementalModify((oldData: WorkoutDay) => ({...oldData, ...patch, isUnsynced: true}));
  }
};
