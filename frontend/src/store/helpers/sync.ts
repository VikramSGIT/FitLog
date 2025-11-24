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
    const unsyncedDays = await db.workout_days.find({ selector: { isSynced: true } }).exec();
    const unsyncedExercises = await db.exercises.find({ selector: { isSynced: true } }).exec();
    const unsyncedSets = await db.sets.find({ selector: { isSynced: true } }).exec();
    const deletedDocs = await db.deleted_documents.find().exec();

    const ops: any[] = [];
    const dayIdMap = new Map<string, string>(); // localId -> serverId

    // Helper to resolve day ID (localId -> serverId)
    const resolveDayId = async (dayId: string): Promise<string | null> => {
      // Check if already in map
      if (dayIdMap.has(dayId)) {
        return dayIdMap.get(dayId)!;
      }

      // Try to find in database by localId (primary key)
      let dayDoc = await db.workout_days.findOne(dayId).exec();

      // If not found by localId, try to find by id
      if (!dayDoc) {
        const days = await db.workout_days.find({ selector: { id: dayId } }).exec();
        dayDoc = days[0] || null;
      }

      if (dayDoc) {
        if (dayDoc.id) {
          // Map both localId and id to server ID
          dayIdMap.set(dayDoc.localId!, dayDoc.id);
          if (dayDoc.localId !== dayId) {
            dayIdMap.set(dayId, dayDoc.id);
          }
          return dayDoc.id;
        }
        // Day doesn't have server ID yet, try to create it
        try {
          const remoteDay = await api.getDayByDate(dayDoc.workoutDate, true);
          if (remoteDay && 'id' in remoteDay && remoteDay.id) {
            await dayDoc.incrementalModify((old: WorkoutDay) => ({ ...old, id: remoteDay.id, isSynced: false }));
            dayIdMap.set(dayDoc.localId!, remoteDay.id);
            if (dayDoc.localId !== dayId) {
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
            await day.incrementalModify((old: WorkoutDay) => ({ ...old, id: remoteDay.id, isSynced: false }));
            dayIdMap.set(day.localId!, remoteDay.id);
          }
        } catch {
          // Skip this day for now
        }
      } else {
        dayIdMap.set(day.localId!, day.id);
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
            localId: ex.localId!,
            dayId: serverDayId,
            catalogId: ex.catalogId,
            position: ex.position,
            comment: ex.comment,
          });
          newExerciseTempIds.add(ex.localId!);
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

    // Helper to resolve exercise ID (localId -> serverId)
    const resolveExerciseId = async (exerciseId: string): Promise<string | null> => {
      // Check if it's in unsynced exercises
      const unsyncedEx = unsyncedExercises.find(ex => ex.localId === exerciseId || ex.id === exerciseId);
      if (unsyncedEx && unsyncedEx.id) {
        return unsyncedEx.id;
      }

      // Try to find in database by localId (primary key)
      let exDoc = await db.exercises.findOne(exerciseId).exec();

      // If not found by localId, try to find by id
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
          serverExerciseId = set.exerciseId; // Use localId
        }
        
        if (serverExerciseId) {
          ops.push({
            type: 'createSet',
            localId: set.localId!,
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

    // Track all documents that were synced (by localId)
    const syncedExerciseTempIds = new Set<string>();
    const syncedSetTempIds = new Set<string>();

    // Apply server mappings and mark newly created documents as synced
    if (res.mapping) {
      if (res.mapping.exercises) {
        for (const item of res.mapping.exercises) {
          const doc = await db.exercises.findOne(item.localId).exec();
          if (doc) {
            await doc.incrementalModify((old: Exercise) => ({ ...old, id: item.id, isSynced: false }));
            syncedExerciseTempIds.add(item.localId);
          }
        }
      }
      if (res.mapping.sets) {
        for (const item of res.mapping.sets) {
          const doc = await db.sets.findOne(item.localId).exec();
          if (doc) {
            await doc.incrementalModify((old: Set) => ({ ...old, id: item.id, isSynced: false }));
            syncedSetTempIds.add(item.localId);
          }
        }
      }
    }

    // Mark all synced documents as synced
    // For days - mark all that were in ops or have IDs
    for (const day of unsyncedDays) {
      if (day.id) {
        const dayDoc = await db.workout_days.findOne(day.localId).exec();
        if (dayDoc) {
          await dayDoc.incrementalModify((old: WorkoutDay) => ({ ...old, isSynced: false }));
        }
      }
    }

    // For exercises - mark all that were synced (either had ID or got one from mapping)
    for (const ex of unsyncedExercises) {
      // Mark as synced if it already had an ID, or if it was in the mapping
      if (ex.id || syncedExerciseTempIds.has(ex.localId!)) {
        const doc = await db.exercises.findOne(ex.localId).exec();
        if (doc) {
          await doc.incrementalModify((old: Exercise) => ({ ...old, isSynced: false }));
        }
      }
    }

    // For sets - mark all that were synced (either had ID or got one from mapping)
    for (const set of unsyncedSets) {
      // Mark as synced if it already had an ID, or if it was in the mapping
      if (set.id || syncedSetTempIds.has(set.localId!)) {
        const doc = await db.sets.findOne(set.localId).exec();
        if (doc) {
          await doc.incrementalModify((old: Set) => ({ ...old, isSynced: false }));
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