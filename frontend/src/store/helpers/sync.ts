import { getDb } from '@/db/service'
import { api, SaveOperation } from '@/api/client'
import { WorkoutState } from '../useWorkoutStore'

const SAVE_EPOCH_KEY = 'saveEpoch'

const getStorage = (): Storage | null => {
  if (typeof globalThis === 'undefined') return null
  if (!('localStorage' in globalThis)) return null
  try {
    return (globalThis as typeof globalThis & { localStorage: Storage }).localStorage
  } catch {
    return null
  }
}

const getStoredEpoch = (): number | null => {
  const storage = getStorage()
  if (!storage) return null
  const raw = storage.getItem(SAVE_EPOCH_KEY)
  if (!raw) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

const setStoredEpoch = (value?: number) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return
  }
  const storage = getStorage()
  storage?.setItem(SAVE_EPOCH_KEY, String(value))
}

const ensureEpoch = async () => {
  if (getStoredEpoch() !== null) return
  try {
    const { serverEpoch } = await api.getSaveEpoch()
    if (typeof serverEpoch === 'number') {
      setStoredEpoch(serverEpoch)
    }
  } catch (error) {
    console.warn('Failed to fetch server save epoch', error)
  }
}

const saveWithEpochRetry = async (ops: SaveOperation[], attempt = 0) => {
  try {
    const response = await api.save(ops)
    if (typeof response.serverEpoch === 'number') {
      setStoredEpoch(response.serverEpoch)
    }
    return response
  } catch (error) {
    const serverEpoch = (error as { serverEpoch?: number } | undefined)?.serverEpoch
    if (typeof serverEpoch === 'number') {
      setStoredEpoch(serverEpoch)
    }
    if (typeof serverEpoch === 'number' && attempt < 1) {
      return saveWithEpochRetry(ops, attempt + 1)
    }
    throw error
  }
}

export const sync = async (get: () => WorkoutState, set: (state: Partial<WorkoutState>) => void) => {
  if (get().isSyncing) {
    return
  }
  set({ isSyncing: true, saveStatus: 'saving' })

  await ensureEpoch()

  const db = await getDb()
  
  try {
    // 1. Gather all local changes
    const deletedDocs = await db.deleted_documents.find().exec()
    const unsyncedDays = await db.workout_days.find({ selector: { isSynced: false } }).exec()
    const unsyncedExercises = await db.exercises.find({ selector: { isSynced: false } }).exec()
    const unsyncedSets = await db.sets.find({ selector: { isSynced: false } }).exec()
    
    // 2. Build the ordered 'ops' array
    const ops: SaveOperation[] = []

    // Deletions first
    for (const doc of deletedDocs) {
      if (doc.serverId) { // Only delete if it was ever synced
        const type = doc.collectionName === 'exercises' ? 'deleteExercise' : 'deleteSet';
        ops.push({ type, id: doc.serverId })
      }
    }

    // Creations (ordered by dependency)
    // Days
    for (const day of unsyncedDays) {
      if (!day.serverId) { // It's a new day
        ops.push({ type: 'createDay', localId: day.id, workoutDate: day.workoutDate, timezone: day.timezone || '' })
      }
    }
    // Exercises
    for (const ex of unsyncedExercises) {
      if (!ex.serverId) { // It's a new exercise
        if (!ex.catalogId) continue
        ops.push({
          type: 'createExercise',
          localId: ex.id,
          dayId: `temp:${ex.dayId}`,
          catalogId: ex.catalogId,
          position: ex.position,
          comment: ex.comment
        })
      }
    }
    // Sets
    for (const set of unsyncedSets) {
      if (!set.serverId) { // It's a new set
        const parentEx = await db.exercises.findOne(set.exerciseId).exec()
        // Parent exercise could be already on server or new in this batch
        const exerciseIdRef = parentEx?.serverId ? parentEx.serverId : `temp:${set.exerciseId}`
        ops.push({
          type: 'createSet',
          localId: set.id,
          exerciseId: exerciseIdRef,
          position: set.position,
          reps: set.reps,
          weightKg: set.weightKg,
          isWarmup: set.isWarmup
        })
      }
    }

    // Updates
    for (const day of unsyncedDays) {
      if (day.serverId) {
        ops.push({ type: 'updateDay', dayId: day.serverId, isRestDay: day.isRestDay })
      }
      }
    for (const ex of unsyncedExercises) {
      if (ex.serverId) {
        ops.push({ type: 'updateExercise', id: ex.serverId, patch: { comment: ex.comment, position: ex.position } })
      }
    }
    for (const set of unsyncedSets) {
      if (set.serverId) {
        ops.push({
          type: 'updateSet',
          id: set.serverId,
          patch: { reps: set.reps, weightKg: set.weightKg, isWarmup: set.isWarmup, position: set.position }
        })
      }
    }

    // 3. Send to server if there are operations
    if (ops.length > 0) {
      const res = await saveWithEpochRetry(ops)

      // 4. Process results and update local DB
      const mapping = res.mapping
      for (const item of mapping.exercises) {
        await db.exercises.update(item.localId, { serverId: item.id, isSynced: true })
      }
      for (const item of mapping.sets) {
        await db.sets.update(item.localId, { serverId: item.id, isSynced: true })
      }
      
      // Mark updated items as synced
      const dayDocsToSync = unsyncedDays.filter(d => d.serverId).map(d => ({ ...d, isSynced: true }))
      if (dayDocsToSync.length > 0) await db.workout_days.bulkUpsert(dayDocsToSync)

      const exDocsToSync = unsyncedExercises.filter(e => e.serverId).map(e => ({ ...e, isSynced: true }))
      if (exDocsToSync.length > 0) await db.exercises.bulkUpsert(exDocsToSync)
      
      const setDocsToSync = unsyncedSets.filter(s => s.serverId).map(s => ({ ...s, isSynced: true }))
      if (setDocsToSync.length > 0) await db.sets.bulkUpsert(setDocsToSync)

      // Clear synced deletions
      await db.deleted_documents.bulkRemove(deletedDocs.map(d => d.id))
    }

    set({ saveStatus: 'saved' })
  } catch (error) {
    console.error('Sync failed', error)
    set({ saveStatus: 'error' })
  } finally {
    set({ isSyncing: false })
  }
}