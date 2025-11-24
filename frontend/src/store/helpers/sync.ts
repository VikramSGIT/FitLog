import { getDb } from '@/db/service';
import { api, SaveOperation } from '@/api/client';
import { WorkoutState } from '../useWorkoutStore';

export const sync = async (get: () => WorkoutState, set: (state: Partial<WorkoutState>) => void) => {
  if (get().isSyncing) {
    console.log('Sync already in progress.');
    return;
  }
  set({ isSyncing: true, saveStatus: 'saving' });

  const db = await getDb();
  
  try {
    // 1. Gather all local changes
    const deletedDocs = await db.deleted_documents.find().exec();
    const unsyncedDays = await db.workout_days.find({ selector: { isSynced: false } }).exec();
    const unsyncedExercises = await db.exercises.find({ selector: { isSynced: false } }).exec();
    const unsyncedSets = await db.sets.find({ selector: { isSynced: false } }).exec();
    
    // 2. Build the ordered 'ops' array
    const ops: SaveOperation[] = [];

    // Deletions first
    for (const doc of deletedDocs) {
      if (doc.serverId) { // Only delete if it was ever synced
        const type = doc.collectionName === 'exercises' ? 'deleteExercise' : 'deleteSet';
        ops.push({ type, id: doc.serverId });
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
        ops.push({ type: 'createExercise', localId: ex.id, dayId: `temp:${ex.dayId}`, catalogId: ex.catalogId!, position: ex.position, comment: ex.comment });
      }
    }
    // Sets
    for (const set of unsyncedSets) {
      if (!set.serverId) { // It's a new set
        const parentEx = await db.exercises.findOne(set.exerciseId).exec();
        // Parent exercise could be already on server or new in this batch
        const exerciseIdRef = parentEx?.serverId ? parentEx.serverId : `temp:${set.exerciseId}`;
        ops.push({ type: 'createSet', localId: set.id, exerciseId: exerciseIdRef, position: set.position, reps: set.reps, weightKg: set.weightKg, isWarmup: set.isWarmup });
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
        ops.push({ type: 'updateExercise', id: ex.serverId, patch: { comment: ex.comment, position: ex.position } });
      }
    }
    for (const set of unsyncedSets) {
      if (set.serverId) {
        ops.push({ type: 'updateSet', id: set.serverId, patch: { reps: set.reps, weightKg: set.weightKg, isWarmup: set.isWarmup, position: set.position } });
      }
    }

    // 3. Send to server if there are operations
    if (ops.length > 0) {
      const res = await api.save(ops);

      // 4. Process results and update local DB
      const mapping = res.mapping;
      for (const item of mapping.exercises) {
        const doc = await db.exercises.findOne(item.localId).exec();
        if (doc) await doc.patch({ serverId: item.id, isSynced: true });
      }
      for (const item of mapping.sets) {
        const doc = await db.sets.findOne(item.localId).exec();
        if (doc) await doc.patch({ serverId: item.id, isSynced: true });
      }
      
      // Mark updated items as synced
      const dayDocsToSync = unsyncedDays.filter(d => d.serverId).map(d => ({...d.toJSON(), isSynced: true}));
      if (dayDocsToSync.length > 0) await db.workout_days.bulkUpsert(dayDocsToSync);

      const exDocsToSync = unsyncedExercises.filter(e => e.serverId).map(e => ({...e.toJSON(), isSynced: true}));
      if (exDocsToSync.length > 0) await db.exercises.bulkUpsert(exDocsToSync);
      
      const setDocsToSync = unsyncedSets.filter(s => s.serverId).map(s => ({...s.toJSON(), isSynced: true}));
      if (setDocsToSync.length > 0) await db.sets.bulkUpsert(setDocsToSync);

      // Clear synced deletions
      await db.deleted_documents.bulkRemove(deletedDocs.map(d => d.id));
    }

    set({ saveStatus: 'saved' });
  } catch (error) {
    console.error('Sync failed:', error);
    set({ saveStatus: 'error' });
  } finally {
    set({ isSyncing: false });
  }
};