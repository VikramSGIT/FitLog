import { create } from 'zustand'
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
  setDay: (day: DayWithDetails | null) => void
  setDayLoading: (loading: boolean) => void
  setSaving: (state: WorkoutState['saving'], mode?: SaveMode) => void
  registerAutoSave: (handler: () => Promise<boolean>) => () => void
  flushAutoSaves: (mode?: SaveMode) => Promise<void>
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
    if (handlers.length === 0) {
      setSaving('idle', mode)
      return
    }
    setSaving('saving', mode)
    try {
      let didSaveAny = false
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

