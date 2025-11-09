import { create } from 'zustand'
import type { DayWithDetails, Exercise, WorkoutSet } from '@/api/client'

export type SaveMode = 'auto' | 'manual'

export type WorkoutState = {
  day: DayWithDetails | null
  dayLoading: boolean
  saving: 'idle' | 'saving' | 'saved' | 'error'
  lastSaveMode: SaveMode | null
  lastSavedAt: number | null
  autoSaveHandlers: Set<() => Promise<void>>
  setDay: (day: DayWithDetails | null) => void
  setDayLoading: (loading: boolean) => void
  setSaving: (state: WorkoutState['saving'], mode?: SaveMode) => void
  registerAutoSave: (handler: () => Promise<void>) => () => void
  flushAutoSaves: (mode?: SaveMode) => Promise<void>
  // Local state update helpers
  addExerciseLocal: (ex: Exercise) => void
  updateExerciseLocal: (id: string, patch: Partial<Exercise>) => void
  removeExerciseLocal: (id: string) => void
  addSetLocal: (exerciseId: string, s: WorkoutSet) => void
  updateSetLocal: (id: string, patch: Partial<WorkoutSet>) => void
  removeSetLocal: (id: string) => void
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
      exercises: Array.isArray(day.exercises)
        ? day.exercises.map((ex) => ({
            ...ex,
            sets: Array.isArray(ex.sets) ? ex.sets : []
          }))
        : []
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
      setSaving('saved', mode)
      return
    }
    setSaving('saving', mode)
    try {
      for (const fn of handlers) {
        await fn()
      }
      setSaving('saved', mode)
    } catch (err) {
      console.error(err)
      setSaving('error', mode)
    }
  },
  addExerciseLocal: (ex) => {
    const d = get().day
    if (!d) return
    set({
      day: {
        ...d,
        exercises: [
          ...d.exercises,
          { ...ex, sets: Array.isArray(ex.sets) ? ex.sets : [] }
        ]
      }
    })
  },
  updateExerciseLocal: (id, patch) => {
    const d = get().day
    if (!d) return
    set({
      day: {
        ...d,
        exercises: d.exercises.map((e) => (e.id === id ? { ...e, ...patch } : e))
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
        exercises: d.exercises.map((e) =>
          e.id === exerciseId
            ? { ...e, sets: [...(Array.isArray(e.sets) ? e.sets : []), s] }
            : e
        )
      }
    })
  },
  updateSetLocal: (id, patch) => {
    const d = get().day
    if (!d) return
    set({
      day: {
        ...d,
        exercises: d.exercises.map((e) => ({
          ...e,
          sets: (Array.isArray(e.sets) ? e.sets : []).map((s) =>
            s.id === id ? { ...s, ...patch } : s
          )
        }))
      }
    })
  },
  removeSetLocal: (id) => {
    const d = get().day
    if (!d) return
    set({
      day: {
        ...d,
        exercises: d.exercises.map((e) => ({
          ...e,
          sets: (Array.isArray(e.sets) ? e.sets : []).filter((s) => s.id !== id)
        }))
      }
    })
  }
}))

