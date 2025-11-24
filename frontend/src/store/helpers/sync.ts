import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/db/service';
import { api } from '@/api/client';
import { WorkoutDay, Exercise } from '@/db/schema';
import type { Set } from '@/db/schema';
import { WorkoutState } from '../useWorkoutStore';

export const sync = async (get: () => WorkoutState, set: (state: Partial<WorkoutState>) => void) => {
  const { isSyncing } = get();
  if (isSyncing) {
    return;
  }

  set({ isSyncing: true });
  get().setSaving('saving', 'manual');

  const db = await getDb();

  try {
    // Collect all unsynced changes
    const unsyncedDays = await db.workout_days.find({ selector: { isUnsynced: true } }).exec();
    const unsyncedExercises = await db.exercises.find({ selector: { isUnsynced: true } }).exec();
    const unsyncedSets = await db.sets.find({ selector: { isUnsynced: true } }).exec();
    const deletedDocs = await db.deleted_documents.find().exec();

    const ops: any[] = [];
    const dayIdMap = new Map<string, string>(); // tempId -> serverId

    // Helper to resolve day ID (tempId -> serverId)
    const resolveDayId = async (dayId: string): Promise<string | null> => {
      // Check if already in map
      if (dayIdMap.has(dayId)) {
        return dayIdMap.get(dayId)!;
      }

      // Try to find in database by tempId (primary key)
      let dayDoc = await db.workout_days.findOne(dayId).exec();

      // If not found by tempId, try to find by id
      if (!dayDoc) {
        const days = await db.workout_days.find({ selector: { id: dayId } }).exec();
        dayDoc = days[0] || null;
      }

      if (dayDoc) {
        if (dayDoc.id) {
          // Map both tempId and id to server ID
          dayIdMap.set(dayDoc.tempId!, dayDoc.id);
          if (dayDoc.tempId !== dayId) {
            dayIdMap.set(dayId, dayDoc.id);
          }
          return dayDoc.id;
        }
        // Day doesn't have server ID yet, try to create it
        try {
          const remoteDay = await api.getDayByDate(dayDoc.workoutDate, true);
          if (remoteDay && 'id' in remoteDay && remoteDay.id) {
            await dayDoc.incrementalModify((old: WorkoutDay) => ({ ...old, id: remoteDay.id, isUnsynced: false }));
            dayIdMap.set(dayDoc.tempId!, remoteDay.id);
            if (dayDoc.tempId !== dayId) {
              dayIdMap.set(dayId, remoteDay.id);
            }
            return remoteDay.id;
          }
        } catch {
          // Failed to create day
        }
      }
      return null;
    };

    // First pass: resolve all unsynced day IDs
    for (const day of unsyncedDays) {
      if (!day.id) {
        // Day needs to be created - use ensure endpoint
        try {
          const remoteDay = await api.getDayByDate(day.workoutDate, true);
          if (remoteDay && 'id' in remoteDay && remoteDay.id) {
            await day.incrementalModify((old: WorkoutDay) => ({ ...old, id: remoteDay.id, isUnsynced: false }));
            dayIdMap.set(day.tempId!, remoteDay.id);
          }
        } catch {
          // Skip this day for now
        }
      } else {
        dayIdMap.set(day.tempId!, day.id);
        // Update day if needed
        ops.push({
          type: 'updateDay',
          dayId: day.id,
          isRestDay: day.isRestDay,
        });
      }
    }

    const newExerciseTempIds = new Set<string>();

    // Process exercises
    for (const ex of unsyncedExercises) {
      if (!ex.id) {
        // Create - resolve dayId
        const serverDayId = await resolveDayId(ex.dayId);
        if (serverDayId) {
          ops.push({
            type: 'createExercise',
            tempId: ex.tempId!,
            dayId: serverDayId,
            catalogId: ex.catalogId,
            position: ex.position,
            comment: ex.comment,
          });
          newExerciseTempIds.add(ex.tempId!);
        }
      } else {
        // Update
        ops.push({
          type: 'updateExercise',
          id: ex.id,
          patch: {
            position: ex.position,
            comment: ex.comment,
          }
        });
      }
    }

    // Helper to resolve exercise ID (tempId -> serverId)
    const resolveExerciseId = async (exerciseId: string): Promise<string | null> => {
      // Check if it's in unsynced exercises
      const unsyncedEx = unsyncedExercises.find(ex => ex.tempId === exerciseId || ex.id === exerciseId);
      if (unsyncedEx && unsyncedEx.id) {
        return unsyncedEx.id;
      }

      // Try to find in database by tempId (primary key)
      let exDoc = await db.exercises.findOne(exerciseId).exec();

      // If not found by tempId, try to find by id
      if (!exDoc) {
        const exercises = await db.exercises.find({ selector: { id: exerciseId } }).exec();
        exDoc = exercises[0] || null;
      }

      if (exDoc && exDoc.id) {
        return exDoc.id;
      }
      return null;
    };

    // Process sets
    for (const set of unsyncedSets) {
      if (!set.id) {
        // Create - resolve exerciseId
        let serverExerciseId = await resolveExerciseId(set.exerciseId);
        if (!serverExerciseId && newExerciseTempIds.has(set.exerciseId)) {
          serverExerciseId = set.exerciseId; // Use tempId
        }
        
        if (serverExerciseId) {
          ops.push({
            type: 'createSet',
            tempId: set.tempId!,
            exerciseId: serverExerciseId,
            position: set.position,
            reps: set.reps,
            weightKg: set.weightKg,
            isWarmup: set.isWarmup,
          });
        }
      } else {
        // Update
        ops.push({
          type: 'updateSet',
          id: set.id,
          patch: {
            position: set.position,
            reps: set.reps,
            weightKg: set.weightKg,
            isWarmup: set.isWarmup,
          },
        });
      }
    }

    // Process deletions
    for (const doc of deletedDocs) {
      if (doc.id && doc.collectionName === 'exercises') {
        ops.push({ type: 'deleteExercise', id: doc.id });
      } else if (doc.id && doc.collectionName === 'sets') {
        ops.push({ type: 'deleteSet', id: doc.id });
      }
    }

    if (ops.length === 0) {
      set({ isSyncing: false });
      get().setSaving('idle', 'manual');
      return;
    }

    // Send to server
    const clientEpoch = Number(localStorage.getItem('saveEpoch') || '0');
    const res = await api.saveBatch(ops, uuidv4(), clientEpoch);

    // Track all documents that were synced (by tempId)
    const syncedExerciseTempIds = new Set<string>();
    const syncedSetTempIds = new Set<string>();

    // Apply server mappings and mark newly created documents as synced
    if (res.mapping) {
      if (res.mapping.exercises) {
        for (const item of res.mapping.exercises) {
          const doc = await db.exercises.findOne(item.tempId).exec();
          if (doc) {
            await doc.incrementalModify((old: Exercise) => ({ ...old, id: item.id, isUnsynced: false }));
            syncedExerciseTempIds.add(item.tempId);
          }
        }
      }
      if (res.mapping.sets) {
        for (const item of res.mapping.sets) {
          const doc = await db.sets.findOne(item.tempId).exec();
          if (doc) {
            await doc.incrementalModify((old: Set) => ({ ...old, id: item.id, isUnsynced: false }));
            syncedSetTempIds.add(item.tempId);
          }
        }
      }
    }

    // Mark all synced documents as synced
    // For days - mark all that were in ops or have IDs
    for (const day of unsyncedDays) {
      if (day.id) {
        const dayDoc = await db.workout_days.findOne(day.tempId).exec();
        if (dayDoc) {
          await dayDoc.incrementalModify((old: WorkoutDay) => ({ ...old, isUnsynced: false }));
        }
      }
    }

    // For exercises - mark all that were synced (either had ID or got one from mapping)
    for (const ex of unsyncedExercises) {
      // Mark as synced if it already had an ID, or if it was in the mapping
      if (ex.id || syncedExerciseTempIds.has(ex.tempId!)) {
        const doc = await db.exercises.findOne(ex.tempId).exec();
        if (doc) {
          await doc.incrementalModify((old: Exercise) => ({ ...old, isUnsynced: false }));
        }
      }
    }

    // For sets - mark all that were synced (either had ID or got one from mapping)
    for (const set of unsyncedSets) {
      // Mark as synced if it already had an ID, or if it was in the mapping
      if (set.id || syncedSetTempIds.has(set.tempId!)) {
        const doc = await db.sets.findOne(set.tempId).exec();
        if (doc) {
          await doc.incrementalModify((old: Set) => ({ ...old, isUnsynced: false }));
        }
      }
    }

    // Clear deleted documents
    await db.deleted_documents.find().remove();

    // Update epoch
    localStorage.setItem('saveEpoch', String(res.serverEpoch));

    // Mark as saved
    get().setSaving('saved', 'manual');

  } catch (error: any) {
    // Handle stale epoch
    if (error.code === 'stale_epoch' && error.serverEpoch) {
      localStorage.setItem('saveEpoch', String(error.serverEpoch));
      await db.deleted_documents.find().remove();
    }
    get().setSaving('error', 'manual');
    throw error;
  } finally {
    set({ isSyncing: false });
  }
};