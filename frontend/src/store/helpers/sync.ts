import { getDb } from '@/db/service';
import { api, SaveOperation } from '@/api/client';
import { WorkoutState } from '../useWorkoutStore';

let syncLock: Promise<void> = Promise.resolve();

export const sync = async (get: () => WorkoutState, set: (state: Partial<WorkoutState>) => void) => {
  const runSync = async () => {
    set({ isSyncing: true, saveStatus: 'saving' });

    const db = await getDb();
    
    try {
      // 1. Gather all local changes
      const deletedDocs = await db.deleted_documents.find().exec();
      const unsyncedDays = await db.workout_days.find({ selector: { isSynced: false } }).exec();
      const unsyncedExercises = await db.exercises.find({ selector: { isSynced: false } }).exec();
      const unsyncedSets = await db.sets.find({ selector: { isSynced: false } }).exec();
      const unsyncedRestPeriods = await db.rest_periods.find({ selector: { isSynced: false } }).exec();
      
      // 2. Build the ordered 'ops' array
      const ops: SaveOperation[] = [];

      // Deletions first
      for (const doc of deletedDocs) {
        if (doc.serverId) { // Only delete if it was ever synced
          if (doc.collectionName === 'exercises') {
            ops.push({ type: 'deleteExercise', exerciseId: doc.serverId });
          } else if (doc.collectionName === 'sets') {
            ops.push({ type: 'deleteSet', setId: doc.serverId });
          } else if (doc.collectionName === 'rest_periods') {
            ops.push({ type: 'deleteRest', restId: doc.serverId });
          }
        }
      }

      // Creations (ordered by dependency)
      // Days
      for (const day of unsyncedDays) {
        if (!day.serverId) { // It's a new day
          ops.push({ type: 'createDay', localId: day.id, workoutDate: day.workoutDate, timezone: day.timezone || '' });
        }
      }
      // Exercises
      for (const ex of unsyncedExercises) {
        if (!ex.serverId) { // It's a new exercise
          const dayDoc = await db.workout_days.findOne(ex.dayId).exec();
          // Use serverId if available (existing day), otherwise use localId (new day in this batch)
          const dayRefId = dayDoc?.serverId ? dayDoc.serverId : ex.dayId;
          ops.push({ type: 'createExercise', localId: ex.id, dayId: dayRefId, catalogId: ex.catalogId!, position: ex.position, comment: ex.comment });
        }
      }
      // Sets
      for (const set of unsyncedSets) {
        if (!set.serverId) { // It's a new set
          const parentEx = await db.exercises.findOne(set.exerciseId).exec();
          // Use serverId if available (existing exercise), otherwise use localId (new exercise in this batch)
          const exerciseRefId = parentEx?.serverId ? parentEx.serverId : set.exerciseId;
          ops.push({ type: 'createSet', localId: set.id, exerciseId: exerciseRefId, position: set.position, reps: set.reps, weightKg: set.weightKg, isWarmup: set.isWarmup });
        }
      }
      // Rest Periods
      for (const rest of unsyncedRestPeriods) {
        if (!rest.serverId) { // It's a new rest period
          const parentEx = await db.exercises.findOne(rest.exerciseId).exec();
          // Use serverId if available (existing exercise), otherwise use localId (new exercise in this batch)
          const exerciseRefId = parentEx?.serverId ? parentEx.serverId : rest.exerciseId;
          ops.push({ type: 'createRest', localId: rest.id, exerciseId: exerciseRefId, position: rest.position, durationSeconds: rest.durationSeconds });
        }
      }

      // Updates
      for (const day of unsyncedDays) {
          if (day.serverId) {
            ops.push({ type: 'updateDay', dayId: day.serverId, isRestDay: day.isRestDay });
          }
        }
      for (const ex of unsyncedExercises) {
        if (ex.serverId) {
          ops.push({ type: 'updateExercise', exerciseId: ex.serverId, patch: { comment: ex.comment, position: ex.position } });
        }
      }
      for (const set of unsyncedSets) {
        if (set.serverId) {
          ops.push({ type: 'updateSet', setId: set.serverId, patch: { reps: set.reps, weightKg: set.weightKg, isWarmup: set.isWarmup, position: set.position } });
        }
      }
      for (const rest of unsyncedRestPeriods) {
        if (rest.serverId) {
          ops.push({ type: 'updateRest', restId: rest.serverId, patch: { durationSeconds: rest.durationSeconds, position: rest.position } });
        }
      }

      // 3. Send to server if there are operations
      if (ops.length > 0) {
        const res = await api.saveBatch(ops);

        // 4. Process results and update local DB
        const mapping = res.mapping;
        
        // Update NEW items (from mapping) with serverId
        if (mapping) {
          for (const item of (mapping.exercises || [])) {
            const doc = await db.exercises.findOne(item.localId).exec();
            if (doc) await doc.patch({ serverId: item.id, isSynced: true });
          }
          for (const item of (mapping.sets || [])) {
            const doc = await db.sets.findOne(item.localId).exec();
            if (doc) await doc.patch({ serverId: item.id, isSynced: true });
          }
          for (const item of (mapping.rests || [])) {
            const doc = await db.rest_periods.findOne(item.localId).exec();
            if (doc) await doc.patch({ serverId: item.id, isSynced: true });
          }
        }
        
        // Mark UPDATED items as synced (those that already had a serverId)
        for (const day of unsyncedDays) {
          if (day.serverId) {
            await day.patch({ isSynced: true });
          }
        }
        for (const ex of unsyncedExercises) {
          if (ex.serverId) {
            await ex.patch({ isSynced: true });
          }
        }
        for (const set of unsyncedSets) {
          if (set.serverId) {
            await set.patch({ isSynced: true });
          }
        }
        for (const rest of unsyncedRestPeriods) {
          if (rest.serverId) {
            await rest.patch({ isSynced: true });
          }
        }

        // Clear synced deletions
        await db.deleted_documents.bulkRemove(deletedDocs.map(d => d.id));
      }

      set({ saveStatus: 'saved' });
    } catch (error) {
      console.error('Sync failed:', error);
      set({ saveStatus: 'error' });
      throw error;
    } finally {
      set({ isSyncing: false });
    }
  };

  const currentSync = syncLock.then(runSync);
  syncLock = currentSync.catch(() => {}); // Swallow error for lock to continue
  return currentSync;
};