import { create } from 'zustand'
import { api } from '@/api/client'
import type { DayWithDetails, Exercise, ExerciseEntry, RestPeriod, WorkoutSet } from '@/api/client'

export type SaveMode = 'auto' | 'manual'

type TimelineEntry = ExerciseEntry

const ensureArray = <T>(value: T[] | undefined | null): T[] => (Array.isArray(value) ? [...value] : [])

const buildTimeline = (sets: WorkoutSet[], rests: RestPeriod[]): TimelineEntry[] => {
  const restBuckets = new Map<number, RestPeriod[]>()
  rests.forEach((rest) => {
    if (!rest) return
    const pos = Math.max(0, rest.position ?? 0)
    const bucket = restBuckets.get(pos) ?? []
    bucket.push(rest)
    restBuckets.set(pos, bucket)
  })

  const timeline: TimelineEntry[] = []

  const head = restBuckets.get(0)
  if (head && head.length > 0) {
    head.forEach((rp) => timeline.push({ kind: 'rest', rest: rp }))
    restBuckets.delete(0)
  }

  const orderedSets = [...sets].sort((a, b) => a.position - b.position)

  orderedSets.forEach((set) => {
    timeline.push({ kind: 'set', set })
    const bucket = restBuckets.get(set.position)
    if (bucket && bucket.length > 0) {
      bucket.forEach((rp) => timeline.push({ kind: 'rest', rest: rp }))
      restBuckets.delete(set.position)
    }
  })

  if (restBuckets.size > 0) {
    const leftovers = Array.from(restBuckets.entries()).sort((a, b) => a[0] - b[0])
    leftovers.forEach(([, items]) => {
      items.forEach((rp) => timeline.push({ kind: 'rest', rest: rp }))
    })
  }

  return timeline
}

const normalizeExercise = (exercise: Exercise): Exercise => {
  const sets = ensureArray(exercise.sets)
  const hasExplicitRests = Object.prototype.hasOwnProperty.call(exercise, 'restPeriods')
  const explicitRests = hasExplicitRests ? ensureArray(exercise.restPeriods) : undefined
  const timelineSource = ensureArray(exercise.timeline)
  const derivedRests =
    explicitRests !== undefined
      ? explicitRests
      : timelineSource
          .filter((entry): entry is { kind: 'rest'; rest: RestPeriod } => entry?.kind === 'rest' && !!entry.rest)
          .map((entry) => entry.rest)

  const restSeen = new Set<string>()
  const restList: RestPeriod[] = []
  derivedRests.forEach((rp) => {
    if (!rp) return
    if (!restSeen.has(rp.id)) {
      restSeen.add(rp.id)
      restList.push(rp)
    }
  })

  const timeline = buildTimeline(sets, restList)

  return {
    ...exercise,
    sets,
    restPeriods: restList,
    timeline
  }
}

export type WorkoutState = {
  day: DayWithDetails | null
  dayLoading: boolean
  saving: 'idle' | 'saving' | 'saved' | 'error'
  lastSaveMode: SaveMode | null
  lastSavedAt: number | null
  autoSaveHandlers: Set<() => Promise<boolean>>
  // Batched op-log
  opLog: Array<
    | { type: 'createExercise'; tempId: string; dayId: string; catalogId: string; position: number; comment?: string; displayName?: string }
    | { type: 'createSet'; tempId: string; exerciseId: string; position: number; reps: number; weightKg: number; isWarmup?: boolean }
    | { type: 'updateExercise'; id: string; patch: Partial<{ position: number; comment: string }> }
    | { type: 'updateSet'; id: string; patch: Partial<{ position: number; reps: number; weightKg: number; isWarmup: boolean }> }
    | { type: 'reorderExercises'; dayId: string; orderedIds: string[] }
    | { type: 'reorderSets'; exerciseId: string; orderedIds: string[] }
    | { type: 'deleteExercise'; id: string }
    | { type: 'deleteSet'; id: string }
    | { type: 'createRest'; tempId: string; exerciseId: string; position: number; durationSeconds: number }
    | { type: 'updateRest'; id: string; patch: Partial<{ position: number; durationSeconds: number }> }
    | { type: 'deleteRest'; id: string }
    | { type: 'updateDay'; dayId: string; isRestDay: boolean }
  >
  hiddenIds: Set<string>
  flushInFlight: boolean
  tempIdCounter: number
  setDay: (day: DayWithDetails | null) => void
  setDayLoading: (loading: boolean) => void
  setSaving: (state: WorkoutState['saving'], mode?: SaveMode) => void
  registerAutoSave: (handler: () => Promise<boolean>) => () => void
  flushAutoSaves: (mode?: SaveMode) => Promise<void>
  // Batch queue helpers
  queueCreateExercise: (params: { dayId: string; catalogId: string; nameDisplay: string; position?: number; comment?: string }) => string
  queueCreateSet: (exerciseId: string, params: { position: number; reps: number; weightKg: number; isWarmup?: boolean }) => string
  queueUpdateExercise: (id: string, patch: Partial<{ position: number; comment: string }>) => void
  queueUpdateSet: (id: string, patch: Partial<{ position: number; reps: number; weightKg: number; isWarmup: boolean }>) => void
  queueReorderExercises: (dayId: string, orderedIds: string[]) => void
  queueReorderSets: (exerciseId: string, orderedIds: string[]) => void
  queueDeleteExercise: (id: string) => void
  queueDeleteSet: (id: string) => void
  queueCreateRest: (exerciseId: string, params: { position: number; durationSeconds: number }) => string
  queueUpdateRest: (id: string, patch: Partial<{ position: number; durationSeconds: number }>) => void
  queueDeleteRest: (id: string) => void
  queueUpdateDay: (dayId: string, isRestDay: boolean) => void
  flushOpLog: () => Promise<boolean>
  // Local state update helpers
  addExerciseLocal: (ex: Exercise) => void
  updateExerciseLocal: (id: string, patch: Partial<Exercise>) => void
  removeExerciseLocal: (id: string) => void
  addSetLocal: (exerciseId: string, s: WorkoutSet) => void
  updateSetLocal: (id: string, patch: Partial<WorkoutSet>) => void
  removeSetLocal: (id: string) => void
  addRestLocal: (exerciseId: string, rest: RestPeriod) => void
  updateRestLocal: (id: string, patch: Partial<RestPeriod>) => void
  removeRestLocal: (id: string) => void
}

export const useWorkoutStore = create<WorkoutState>((set, get) => ({
  day: null,
  dayLoading: false,
  saving: 'idle',
  lastSaveMode: null,
  lastSavedAt: null,
  autoSaveHandlers: new Set(),
  opLog: [],
  hiddenIds: new Set(),
  flushInFlight: false,
  tempIdCounter: 1,
  setDay: (day) => {
    if (!day) {
      set({ day: null, dayLoading: false })
      return
    }
    const normalized = {
      ...day,
      exercises: Array.isArray(day.exercises) ? day.exercises.map((ex) => normalizeExercise(ex)) : []
    }
    set({ day: normalized, dayLoading: false })
    // Capture epoch from server to anchor hydration
    ;(async () => {
      try {
        const res = await api.getSaveEpoch()
        if (res && typeof res.serverEpoch === 'number' && !Number.isNaN(res.serverEpoch)) {
          localStorage.setItem('saveEpoch', String(res.serverEpoch))
        }
      } catch {}
    })()
    // Hydrate persisted op-log for this day if present and not stale
    try {
      const state = get()
      const key = `oplog:v1:${normalized.id}`
      const saved = localStorage.getItem(key)
      if (saved) {
        const parsed = JSON.parse(saved) as { dayId: string; baseEpoch?: number; ops?: WorkoutState['opLog'] }
        const currentEpoch = Number(localStorage.getItem('saveEpoch') || '0')
        if (parsed && parsed.dayId === normalized.id && Array.isArray(parsed.ops)) {
          if (!parsed.baseEpoch || parsed.baseEpoch >= currentEpoch) {
            // restore and replay locally to reflect pending changes
            if (state.opLog.length === 0) {
              set({ opLog: parsed.ops })
            }
            const replay = (ops: WorkoutState['opLog']) => {
              ops.forEach((op) => {
                switch (op.type) {
                  case 'updateDay':
                    set((st) => ({ day: st.day ? { ...st.day, isRestDay: op.isRestDay } : st.day }))
                    break;
                  case 'createExercise': {
                    const dcur = get().day
                    const exists = dcur?.exercises?.some((e) => e.id === op.tempId)
                    if (exists) break
                    const ex: Exercise = {
                      id: op.tempId,
                      dayId: op.dayId,
                      catalogId: op.catalogId,
                      name: op.displayName || 'Pending exercise',
                      position: op.position,
                      comment: op.comment,
                      sets: []
                    }
                    get().addExerciseLocal(ex)
                    break;
                  }
                  case 'deleteExercise':
                    get().removeExerciseLocal(op.id)
                    break;
                  case 'updateExercise':
                    get().updateExerciseLocal(op.id, op.patch as any)
                    break;
                  case 'reorderExercises': {
                    const d2 = get().day
                    if (d2 && d2.id === op.dayId) {
                      const idToPos = new Map<string, number>()
                      op.orderedIds.forEach((id, idx) => idToPos.set(id, idx))
                      const next = d2.exercises.map((e) => ({ ...e, position: idToPos.get(e.id) ?? e.position }))
                      set({ day: { ...d2, exercises: next.sort((a, b) => a.position - b.position) } })
                    }
                    break;
                  }
                  case 'createSet': {
                    const d2 = get().day
                    if (!d2) break
                    const ex = d2.exercises.find((e) => e.id === op.exerciseId)
                    const already = ex?.sets?.some((s) => s.id === op.tempId)
                    if (already) break
                    const s: WorkoutSet = {
                      id: op.tempId,
                      exerciseId: op.exerciseId,
                      userId: '',
                      workoutDate: d2.workoutDate,
                      position: op.position,
                      reps: op.reps,
                      weightKg: op.weightKg,
                      isWarmup: Boolean(op.isWarmup),
                      volumeKg: op.reps * op.weightKg
                    }
                    get().addSetLocal(op.exerciseId, s)
                    break;
                  }
                  case 'deleteSet':
                    get().removeSetLocal(op.id)
                    break;
                  case 'updateSet':
                    get().updateSetLocal(op.id, op.patch as any)
                    break;
                  case 'reorderSets': {
                    const d2 = get().day
                    if (!d2) break
                    const ex = d2.exercises.find((e) => e.id === op.exerciseId)
                    if (!ex) break
                    const idToPos = new Map<string, number>()
                    op.orderedIds.forEach((id, idx) => idToPos.set(id, idx))
                    const updated = ex.sets.map((s) => ({ ...s, position: idToPos.get(s.id) ?? s.position }))
                    get().updateExerciseLocal(op.exerciseId, { sets: updated.sort((a, b) => a.position - b.position) } as any)
                    break;
                  }
                  case 'createRest': {
                    const d2 = get().day
                    const ex = d2?.exercises.find((e) => e.id === op.exerciseId)
                    const rExists = (ex as any)?.restPeriods?.some((rp: any) => rp.id === op.tempId)
                    if (rExists) break
                    const r: RestPeriod = {
                      id: op.tempId,
                      exerciseId: op.exerciseId,
                      position: op.position,
                      durationSeconds: op.durationSeconds,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString()
                    } as any
                    get().addRestLocal(op.exerciseId, r)
                    break;
                  }
                  case 'deleteRest':
                    get().removeRestLocal(op.id)
                    break;
                  case 'updateRest':
                    get().updateRestLocal(op.id, op.patch as any)
                    break;
                  default:
                    break;
                }
              })
            }
            replay(parsed.ops)
          } else {
            // stale queue
            localStorage.removeItem(key)
          }
        }
      } else {
        // No persisted ops; if there is an in-memory queue, replay it now so server state doesn't wipe UI effects
        if (state.opLog.length > 0) {
          const opsCopy = [...state.opLog]
          const replay = (ops: WorkoutState['opLog']) => {
            ops.forEach((op) => {
              switch (op.type) {
                case 'updateDay':
                  set((st) => ({ day: st.day ? { ...st.day, isRestDay: op.isRestDay } : st.day }))
                  break;
                case 'createExercise': {
                  const dcur = get().day
                  const exists = dcur?.exercises?.some((e) => e.id === op.tempId)
                  if (exists) break
                  const ex: Exercise = {
                    id: op.tempId,
                    dayId: op.dayId,
                    catalogId: op.catalogId,
                    name: op.displayName || 'Pending exercise',
                    position: op.position,
                    comment: op.comment,
                    sets: []
                  }
                  get().addExerciseLocal(ex)
                  break;
                }
                case 'deleteExercise':
                  get().removeExerciseLocal(op.id)
                  break;
                case 'updateExercise':
                  get().updateExerciseLocal(op.id, op.patch as any)
                  break;
                case 'reorderExercises': {
                  const d2 = get().day
                  if (d2 && d2.id === op.dayId) {
                    const idToPos = new Map<string, number>()
                    op.orderedIds.forEach((id, idx) => idToPos.set(id, idx))
                    const next = d2.exercises.map((e) => ({ ...e, position: idToPos.get(e.id) ?? e.position }))
                    set({ day: { ...d2, exercises: next.sort((a, b) => a.position - b.position) } })
                  }
                  break;
                }
                case 'createSet': {
                  const d2 = get().day
                  if (!d2) break
                  const ex = d2.exercises.find((e) => e.id === op.exerciseId)
                  const already = ex?.sets?.some((s) => s.id === op.tempId)
                  if (already) break
                  const s: WorkoutSet = {
                    id: op.tempId,
                    exerciseId: op.exerciseId,
                    userId: '',
                    workoutDate: d2.workoutDate,
                    position: op.position,
                    reps: op.reps,
                    weightKg: op.weightKg,
                    isWarmup: Boolean(op.isWarmup),
                    volumeKg: op.reps * op.weightKg
                  }
                  get().addSetLocal(op.exerciseId, s)
                  break;
                }
                case 'deleteSet':
                  get().removeSetLocal(op.id)
                  break;
                case 'updateSet':
                  get().updateSetLocal(op.id, op.patch as any)
                  break;
                case 'reorderSets': {
                  const d2 = get().day
                  if (!d2) break
                  const ex = d2.exercises.find((e) => e.id === op.exerciseId)
                  if (!ex) break
                  const idToPos = new Map<string, number>()
                  op.orderedIds.forEach((id, idx) => idToPos.set(id, idx))
                  const updated = ex.sets.map((s) => ({ ...s, position: idToPos.get(s.id) ?? s.position }))
                  get().updateExerciseLocal(op.exerciseId, { sets: updated.sort((a, b) => a.position - b.position) } as any)
                  break;
                }
                case 'createRest': {
                  const d2 = get().day
                  const ex = d2?.exercises.find((e) => e.id === op.exerciseId)
                  const rExists = (ex as any)?.restPeriods?.some((rp: any) => rp.id === op.tempId)
                  if (rExists) break
                  const r: RestPeriod = {
                    id: op.tempId,
                    exerciseId: op.exerciseId,
                    position: op.position,
                    durationSeconds: op.durationSeconds,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                  } as any
                  get().addRestLocal(op.exerciseId, r)
                  break;
                }
                case 'deleteRest':
                  get().removeRestLocal(op.id)
                  break;
                case 'updateRest':
                  get().updateRestLocal(op.id, op.patch as any)
                  break;
                default:
                  break;
              }
            })
          }
          replay(opsCopy)
        }
      }
    } catch {}
  },
  setDayLoading: (loading) => set({ dayLoading: loading }),
  setSaving: (state, mode) =>
    set((current) => {
      const partial: Partial<WorkoutState> = { saving: state }
      if (state === 'saved') {
        partial.lastSavedAt = Date.now()
        partial.lastSaveMode = mode ?? current.lastSaveMode
      } else if (mode) {
        partial.lastSaveMode = mode
      }
      return partial
    }),
  registerAutoSave: (handler) => {
    const handlers = get().autoSaveHandlers
    handlers.add(handler)
    return () => {
      handlers.delete(handler)
    }
  },
  flushAutoSaves: async (mode: SaveMode = 'manual') => {
    const handlers = Array.from(get().autoSaveHandlers)
    const setSaving = get().setSaving
    // Always attempt to flush operation log first
    const flushedOps = await get().flushOpLog()
    if (handlers.length === 0) {
      if (flushedOps) {
      setSaving('saved', mode)
      } else {
        setSaving('idle', mode)
      }
      return
    }
    setSaving('saving', mode)
    try {
      let didSaveAny = flushedOps
      for (const fn of handlers) {
        const did = await fn()
        if (did) didSaveAny = true
      }
      if (didSaveAny) {
      setSaving('saved', mode)
      } else {
        setSaving('idle', mode)
      }
    } catch (err) {
      console.error(err)
      setSaving('error', mode)
    }
  },
  // Queue helpers
  queueCreateExercise: ({ dayId, catalogId, nameDisplay, position, comment }) => {
    const d = get().day
    if (!d || d.id !== dayId) return ''
    const tempId = `temp-ex-${get().tempIdCounter}`
    set((current) => ({ tempIdCounter: current.tempIdCounter + 1 }))
    const pos = typeof position === 'number' ? position : d.exercises.length
    // Local UI insert
    const ex: Exercise = {
      id: tempId,
      dayId,
      catalogId,
      name: nameDisplay,
      position: pos,
      comment: comment ?? undefined,
      sets: []
    }
    get().addExerciseLocal(ex)
    // Log op
    set((state) => {
      const nextLog = [
        ...state.opLog,
        { type: 'createExercise', tempId, dayId, catalogId, position: pos, comment, displayName: nameDisplay }
      ] as WorkoutState['opLog']
      // persist
      try {
        if (d?.id) {
          const key = `oplog:v1:${d.id}`
          const baseEpoch = Number(localStorage.getItem('saveEpoch') || '0')
          localStorage.setItem(key, JSON.stringify({ dayId: d.id, baseEpoch, createdAt: Date.now(), lastPersistedAt: Date.now(), ops: nextLog }))
        }
      } catch {}
      return { opLog: nextLog }
    })
    return tempId
  },
  queueCreateSet: (exerciseId, { position, reps, weightKg, isWarmup }) => {
    const tempId = `temp-set-${get().tempIdCounter}`
    set((current) => ({ tempIdCounter: current.tempIdCounter + 1 }))
    const d = get().day
    if (d) {
      const setObj: WorkoutSet = {
        id: tempId,
        exerciseId,
        userId: '', // unknown locally
        workoutDate: d.workoutDate,
        position,
        reps,
        weightKg,
        isWarmup: Boolean(isWarmup),
        volumeKg: reps * weightKg
      }
      get().addSetLocal(exerciseId, setObj)
    }
    set((state) => {
      const nextLog = [
        ...state.opLog,
        { type: 'createSet', tempId, exerciseId, position, reps, weightKg, isWarmup: Boolean(isWarmup) }
      ] as WorkoutState['opLog']
      try {
        const d2 = get().day
        if (d2?.id) {
          const key = `oplog:v1:${d2.id}`
          const baseEpoch = Number(localStorage.getItem('saveEpoch') || '0')
          localStorage.setItem(key, JSON.stringify({ dayId: d2.id, baseEpoch, createdAt: Date.now(), lastPersistedAt: Date.now(), ops: nextLog }))
        }
      } catch {}
      return { opLog: nextLog }
    })
    return tempId
  },
  queueUpdateExercise: (id, patch) => {
    // UI reflect change immediately
    get().updateExerciseLocal(id, patch as any)
    set((state) => {
      const nextLog = [...state.opLog, { type: 'updateExercise', id, patch }] as WorkoutState['opLog']
      try {
        const d = get().day
        if (d?.id) {
          const key = `oplog:v1:${d.id}`
          const baseEpoch = Number(localStorage.getItem('saveEpoch') || '0')
          localStorage.setItem(key, JSON.stringify({ dayId: d.id, baseEpoch, createdAt: Date.now(), lastPersistedAt: Date.now(), ops: nextLog }))
        }
      } catch {}
      return { opLog: nextLog }
    })
  },
  queueUpdateSet: (id, patch) => {
    get().updateSetLocal(id, patch as any)
    set((state) => {
      const nextLog = [...state.opLog, { type: 'updateSet', id, patch }] as WorkoutState['opLog']
      try {
        const d = get().day
        if (d?.id) {
          const key = `oplog:v1:${d.id}`
          const baseEpoch = Number(localStorage.getItem('saveEpoch') || '0')
          localStorage.setItem(key, JSON.stringify({ dayId: d.id, baseEpoch, createdAt: Date.now(), lastPersistedAt: Date.now(), ops: nextLog }))
        }
      } catch {}
      return { opLog: nextLog }
    })
  },
  queueReorderExercises: (dayId, orderedIds) => {
    // Update local positions
    const d = get().day
    if (d && d.id === dayId) {
      const idToPos = new Map<string, number>()
      orderedIds.forEach((id, idx) => idToPos.set(id, idx))
      d.exercises.forEach((e) => {
        const next = idToPos.get(e.id)
        if (typeof next === 'number') {
          e.position = next
        }
      })
      set({ day: { ...d, exercises: [...d.exercises].sort((a, b) => a.position - b.position) } })
    }
    set((state) => {
      const nextLog = [...state.opLog, { type: 'reorderExercises', dayId, orderedIds }] as WorkoutState['opLog']
      try {
        const d = get().day
        if (d?.id) {
          const key = `oplog:v1:${d.id}`
          const baseEpoch = Number(localStorage.getItem('saveEpoch') || '0')
          localStorage.setItem(key, JSON.stringify({ dayId: d.id, baseEpoch, createdAt: Date.now(), lastPersistedAt: Date.now(), ops: nextLog }))
        }
      } catch {}
      return { opLog: nextLog }
    })
  },
  queueReorderSets: (exerciseId, orderedIds) => {
    const d = get().day
    if (d) {
      const ex = d.exercises.find((e) => e.id === exerciseId)
      if (ex) {
        const idToPos = new Map<string, number>()
        orderedIds.forEach((id, idx) => idToPos.set(id, idx))
        ex.sets.forEach((s) => {
          const next = idToPos.get(s.id)
          if (typeof next === 'number') s.position = next
        })
        get().updateExerciseLocal(exerciseId, { sets: [...ex.sets].sort((a, b) => a.position - b.position) } as any)
      }
    }
    set((state) => {
      const nextLog = [...state.opLog, { type: 'reorderSets', exerciseId, orderedIds }] as WorkoutState['opLog']
      try {
        const d = get().day
        if (d?.id) {
          const key = `oplog:v1:${d.id}`
          const baseEpoch = Number(localStorage.getItem('saveEpoch') || '0')
          localStorage.setItem(key, JSON.stringify({ dayId: d.id, baseEpoch, createdAt: Date.now(), lastPersistedAt: Date.now(), ops: nextLog }))
        }
      } catch {}
      return { opLog: nextLog }
    })
  },
  queueDeleteExercise: (id) => {
    // Remove from UI immediately but always push delete op (temp or persisted)
    get().removeExerciseLocal(id)
    set((state) => {
      const nextLog = [...state.opLog, { type: 'deleteExercise', id }] as WorkoutState['opLog']
      const nextHidden = new Set<string>([...state.hiddenIds, id])
      try {
        const d = get().day
        if (d?.id) {
          const key = `oplog:v1:${d.id}`
          const baseEpoch = Number(localStorage.getItem('saveEpoch') || '0')
          localStorage.setItem(key, JSON.stringify({ dayId: d.id, baseEpoch, createdAt: Date.now(), lastPersistedAt: Date.now(), ops: nextLog }))
        }
      } catch {}
      return { opLog: nextLog, hiddenIds: nextHidden }
    })
  },
  queueDeleteSet: (id) => {
    // Remove from UI immediately but always push delete op (temp or persisted)
    get().removeSetLocal(id)
    set((state) => {
      const nextLog = [...state.opLog, { type: 'deleteSet', id }] as WorkoutState['opLog']
      const nextHidden = new Set<string>([...state.hiddenIds, id])
      try {
        const d = get().day
        if (d?.id) {
          const key = `oplog:v1:${d.id}`
          const baseEpoch = Number(localStorage.getItem('saveEpoch') || '0')
          localStorage.setItem(key, JSON.stringify({ dayId: d.id, baseEpoch, createdAt: Date.now(), lastPersistedAt: Date.now(), ops: nextLog }))
        }
      } catch {}
      return { opLog: nextLog, hiddenIds: nextHidden }
    })
  },
  queueCreateRest: (exerciseId, { position, durationSeconds }) => {
    const tempId = `temp-rest-${get().tempIdCounter}`
    set((current) => ({ tempIdCounter: current.tempIdCounter + 1 }))
    const d = get().day
    if (d) {
      const restObj: RestPeriod = {
        id: tempId,
        exerciseId,
        position,
        durationSeconds,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as any
      get().addRestLocal(exerciseId, restObj)
    }
    set((state) => {
      const nextLog = [...state.opLog, { type: 'createRest', tempId, exerciseId, position, durationSeconds }] as WorkoutState['opLog']
      try {
        const d2 = get().day
        if (d2?.id) {
          const key = `oplog:v1:${d2.id}`
          const baseEpoch = Number(localStorage.getItem('saveEpoch') || '0')
          localStorage.setItem(key, JSON.stringify({ dayId: d2.id, baseEpoch, createdAt: Date.now(), lastPersistedAt: Date.now(), ops: nextLog }))
        }
      } catch {}
      return { opLog: nextLog }
    })
    return tempId
  },
  queueUpdateRest: (id, patch) => {
    get().updateRestLocal(id, patch as any)
    set((state) => {
      const nextLog = [...state.opLog, { type: 'updateRest', id, patch }] as WorkoutState['opLog']
      try {
        const d = get().day
        if (d?.id) {
          const key = `oplog:v1:${d.id}`
          const baseEpoch = Number(localStorage.getItem('saveEpoch') || '0')
          localStorage.setItem(key, JSON.stringify({ dayId: d.id, baseEpoch, createdAt: Date.now(), lastPersistedAt: Date.now(), ops: nextLog }))
        }
      } catch {}
      return { opLog: nextLog }
    })
  },
  queueDeleteRest: (id) => {
    // Remove from UI immediately but always push delete op (temp or persisted)
    get().removeRestLocal(id)
    set((state) => {
      const nextLog = [...state.opLog, { type: 'deleteRest', id }] as WorkoutState['opLog']
      const nextHidden = new Set<string>([...state.hiddenIds, id])
      try {
        const d = get().day
        if (d?.id) {
          const key = `oplog:v1:${d.id}`
          const baseEpoch = Number(localStorage.getItem('saveEpoch') || '0')
          localStorage.setItem(key, JSON.stringify({ dayId: d.id, baseEpoch, createdAt: Date.now(), lastPersistedAt: Date.now(), ops: nextLog }))
        }
      } catch {}
      return { opLog: nextLog, hiddenIds: nextHidden }
    })
  },
  queueUpdateDay: (dayId, isRestDay) => {
    const d = get().day
    if (d && d.id === dayId) {
      set({ day: { ...d, isRestDay } })
    }
    set((state) => {
      const nextLog = [...state.opLog, { type: 'updateDay', dayId, isRestDay }] as WorkoutState['opLog']
      try {
        const d2 = get().day
        if (d2?.id) {
          const key = `oplog:v1:${d2.id}`
          const baseEpoch = Number(localStorage.getItem('saveEpoch') || '0')
          localStorage.setItem(key, JSON.stringify({ dayId: d2.id, baseEpoch, createdAt: Date.now(), lastPersistedAt: Date.now(), ops: nextLog }))
        }
      } catch {}
      return { opLog: nextLog }
    })
  },
  flushOpLog: async () => {
    const state = get()
    if (state.flushInFlight) return false
    const ops = state.opLog
    if (!ops || ops.length === 0) {
      return false
    }
    set({ flushInFlight: true })
    try {
      const withTempRefs = ops.map((op) => {
        const addPrefix = (id: string) => (id && id.startsWith('temp-') ? `temp:${id}` : id)
        if (op.type === 'createExercise') return op
        if (op.type === 'createSet') {
          return { ...op, exerciseId: addPrefix(op.exerciseId) }
        }
        if (op.type === 'createRest') {
          return { ...op, exerciseId: addPrefix(op.exerciseId) }
        }
        if (op.type === 'updateExercise') {
          return { ...op, id: addPrefix(op.id) }
        }
        if (op.type === 'updateSet') {
          return { ...op, id: addPrefix(op.id) }
        }
        if (op.type === 'updateRest') {
          return { ...op, id: addPrefix(op.id) }
        }
        if (op.type === 'reorderExercises') {
          return { ...op, orderedIds: op.orderedIds.map(addPrefix) }
        }
        if (op.type === 'reorderSets') {
          return { ...op, exerciseId: addPrefix(op.exerciseId), orderedIds: op.orderedIds.map(addPrefix) }
        }
        if (op.type === 'deleteExercise') {
          return { ...op, id: addPrefix(op.id) }
        }
        if (op.type === 'deleteSet') {
          return { ...op, id: addPrefix(op.id) }
        }
        if (op.type === 'deleteRest') {
          return { ...op, id: addPrefix(op.id) }
        }
        if (op.type === 'updateDay') {
          return op
        }
        return op
      })
      const res = await api.saveBatch(withTempRefs as any, crypto.randomUUID?.() || `${Date.now()}`, Number(localStorage.getItem('saveEpoch') || '0'))
      // Apply mapping for temp IDs
      const exerciseMap = new Map<string, string>()
      const setMap = new Map<string, string>()
      const restMap = new Map<string, string>()
      res.mapping?.exercises?.forEach((m) => exerciseMap.set(m.tempId, m.id))
      res.mapping?.sets?.forEach((m) => setMap.set(m.tempId, m.id))
      res.mapping?.rests?.forEach((m) => restMap.set(m.tempId, m.id))
      // Replace temp ids in local state
      const d = get().day
      if (d) {
        const nextExercises = d.exercises.map((ex) => {
          const mappedId = exerciseMap.get(ex.id)
          if (mappedId) {
            return normalizeExercise({ ...ex, id: mappedId, sets: ex.sets.map((s) => ({ ...s, exerciseId: mappedId })) })
          }
          return ex
        })
        // Update sets
        nextExercises.forEach((ex, idx) => {
          const updatedSets = ex.sets.map((s) => {
            const mappedSetId = setMap.get(s.id)
            if (mappedSetId) {
              return { ...s, id: mappedSetId, exerciseId: ex.id }
            }
            return s
          })
          const updatedRests = ensureArray(ex.restPeriods).map((rp) => {
            const mappedId = restMap.get(rp.id)
            return mappedId ? { ...rp, id: mappedId } : rp
          })
          nextExercises[idx] = normalizeExercise({ ...ex, sets: updatedSets, restPeriods: updatedRests })
        })
        set({ day: { ...d, exercises: nextExercises } })
      }
      // Clear op log on success
      set({ opLog: [] })
      // Persist server epoch for future batches
      if (typeof res.serverEpoch === 'number' && !Number.isNaN(res.serverEpoch)) {
        localStorage.setItem('saveEpoch', String(res.serverEpoch))
        try {
          const d3 = get().day
          if (d3?.id) {
            localStorage.removeItem(`oplog:v1:${d3.id}`)
          }
        } catch {}
      }
      return true
    } catch (e) {
      console.error('flushOpLog failed', e)
      const code = (e as any)?.code
      if (code === 'stale_epoch') {
        // Invalidate local queue and reload to server truth
        try {
          const d4 = get().day
          if (d4?.id) {
            localStorage.removeItem(`oplog:v1:${d4.id}`)
          }
        } catch {}
        set({ opLog: [] })
        // Hard reload to ensure full resync
        if (typeof window !== 'undefined' && window.location) {
          window.location.reload()
        }
      }
      return false
    } finally {
      set({ flushInFlight: false })
    }
  },
  addExerciseLocal: (ex) => {
    const d = get().day
    if (!d) return
    const normalizedExercise = normalizeExercise(ex)
    set({
      day: {
        ...d,
        exercises: [...d.exercises, normalizedExercise]
      }
    })
  },
  updateExerciseLocal: (id, patch) => {
    const d = get().day
    if (!d) return
    set({
      day: {
        ...d,
        exercises: d.exercises.map((e) =>
          e.id === id ? normalizeExercise({ ...e, ...patch }) : e
        )
      }
    })
  },
  removeExerciseLocal: (id) => {
    const d = get().day
    if (!d) return
    set({ day: { ...d, exercises: d.exercises.filter((e) => e.id !== id) } })
  },
  addSetLocal: (exerciseId, s) => {
    const d = get().day
    if (!d) return
    set({
      day: {
        ...d,
        exercises: d.exercises.map((e) => {
          if (e.id !== exerciseId) return e
          const sets = ensureArray(e.sets)
          const restPeriods = ensureArray(e.restPeriods)
          return normalizeExercise({
            ...e,
            sets: [...sets, s],
            restPeriods
          })
        })
      }
    })
  },
  updateSetLocal: (id, patch) => {
    const d = get().day
    if (!d) return
    set({
      day: {
        ...d,
        exercises: d.exercises.map((e) => {
          const sets = ensureArray(e.sets)
          let mutated = false
          const updatedSets = sets.map((set) => {
            if (set.id !== id) return set
            mutated = true
            return { ...set, ...patch }
          })
          if (!mutated) return e
          return normalizeExercise({
          ...e,
            sets: updatedSets,
            restPeriods: ensureArray(e.restPeriods)
          })
        })
      }
    })
  },
  removeSetLocal: (id) => {
    const d = get().day
    if (!d) return
    set({
      day: {
        ...d,
        exercises: d.exercises.map((e) => {
          const sets = ensureArray(e.sets)
          const filtered = sets.filter((set) => set.id !== id)
          if (filtered.length === sets.length) return e
          return normalizeExercise({
            ...e,
            sets: filtered,
            restPeriods: ensureArray(e.restPeriods)
          })
        })
      }
    })
  },
  addRestLocal: (exerciseId, rest) => {
    const d = get().day
    if (!d) return
    set({
      day: {
        ...d,
        exercises: d.exercises.map((e) => {
          if (e.id !== exerciseId) return e
          const rests = ensureArray(e.restPeriods).filter((rp) => rp.id !== rest.id)
          rests.push(rest)
          return normalizeExercise({
            ...e,
            restPeriods: rests,
            sets: ensureArray(e.sets)
          })
        })
      }
    })
  },
  updateRestLocal: (id, patch) => {
    const d = get().day
    if (!d) return
    set({
      day: {
        ...d,
        exercises: d.exercises.map((e) => {
          const rests = ensureArray(e.restPeriods)
          const index = rests.findIndex((rp) => rp.id === id)
          if (index === -1) return e
          const updated = [...rests]
          updated[index] = { ...updated[index], ...patch }
          return normalizeExercise({
            ...e,
            restPeriods: updated,
            sets: ensureArray(e.sets)
          })
        })
      }
    })
  },
  removeRestLocal: (id) => {
    const d = get().day
    if (!d) return
    set({
      day: {
        ...d,
        exercises: d.exercises.map((e) => {
          const rests = ensureArray(e.restPeriods)
          const filtered = rests.filter((rp) => rp.id !== id)
          if (filtered.length === rests.length) return e
          return normalizeExercise({
          ...e,
            restPeriods: filtered,
            sets: ensureArray(e.sets)
          })
        })
      }
    })
  }
}))

