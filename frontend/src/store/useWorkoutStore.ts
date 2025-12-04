import { create } from 'zustand'
import type { Subscription } from '@/db/types'
import { getDb } from '@/db/service'
import { WorkoutDay, Exercise } from '@/db/schema'
import type { Set as WorkoutSet, Rest } from '@/db/schema'

import { sync } from './helpers/sync';
import { loadDay } from './helpers/loadDay';
import * as crud from './helpers/crud';

// Helper to format date strings
const toDateString = (date: Date): string => date.toISOString().split('T')[0];

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

type DayWithExercises = {
  id: string;
  exercises: Exercise[];
  isRestDay: boolean;
  workoutDate: string;
  notes?: string;
  userId: string;
};

type QueueCreateExercisePayload = {
  dayId: string;
  catalogId: string;
  nameDisplay: string;
  position: number;
};

export type WorkoutState = {
  // State
  activeDay: WorkoutDay | null;
  exercises: Exercise[];
  sets: WorkoutSet[];
  rests: Rest[];
  daySub: Subscription | null;
  exercisesSub: Subscription | null;
  setsSub: Subscription | null;
  restsSub: Subscription | null;
  deletedDocumentsSub: Subscription | null;
  deletedDocumentsCount: number;
  selectedDate: string;
  isLoading: boolean;
  isSyncing: boolean;
  userId: string | null;
  saveStatus: SaveStatus;
  saving: SaveStatus;
  lastSavedAt: number | null;
  pendingChanges: {
    hasAny: boolean;
    unsyncedDays: number;
    unsyncedExercises: number;
    unsyncedSets: number;
    unsyncedRests: number;
    pendingDeletes: number;
  };

  // Computed selectors
  day: DayWithExercises | null;
  dayLoading: boolean;

  // Actions
  init: (userId: string) => void;
  loadDay: (date: string) => Promise<void>;
  addExercise: (catalogId: string, name: string, position?: number) => Promise<string>;
  updateExercise: (id: string, patch: Partial<Exercise>) => Promise<void>;
  deleteExercise: (id: string) => Promise<void>;
  addSet: (exerciseTempId: string) => Promise<void>;
  updateSet: (id: string, patch: Partial<WorkoutSet>) => Promise<void>;
  deleteSet: (id: string) => Promise<void>;
  addRest: (exerciseId: string, durationSeconds?: number) => Promise<void>;
  updateRest: (id: string, patch: Partial<Rest>) => Promise<void>;
  deleteRest: (id: string) => Promise<void>;
  updateDay: (id: string, patch: Partial<WorkoutDay>) => Promise<void>;
  queueCreateExercise: (payload: QueueCreateExercisePayload) => Promise<void>;
  sync: () => Promise<void>;
  flush: () => Promise<void>;
  refreshPendingChanges: () => Promise<void>;
  cleanup: () => void;
};

export const useWorkoutStore = create<WorkoutState>((set, get) => {
  return {
    // Initial State
    activeDay: null,
    exercises: [],
    sets: [],
    rests: [],
    daySub: null,
    exercisesSub: null,
    setsSub: null,
    restsSub: null,
    deletedDocumentsSub: null,
    deletedDocumentsCount: 0,
    selectedDate: toDateString(new Date()),
    isLoading: false,
    isSyncing: false,
    userId: null,
    saveStatus: 'idle' as SaveStatus,
    saving: 'idle' as SaveStatus,
    lastSavedAt: null,
    pendingChanges: {
      hasAny: false,
      unsyncedDays: 0,
      unsyncedExercises: 0,
      unsyncedSets: 0,
      unsyncedRests: 0,
      pendingDeletes: 0
    },

    // Computed selectors
    day: null,
    dayLoading: false,

    // Actions
    init: (userId: string) => {
      set({ userId });

      // Subscribe to deleted documents count
      getDb().then(db => {
        const sub = db.deleted_documents.find().$.subscribe(docs => {
          set({ deletedDocumentsCount: docs.length });
        });
        set({ deletedDocumentsSub: sub });
      }).catch(() => {
        // Failed to subscribe to deleted documents
      });

      get().loadDay(get().selectedDate).catch(() => {
        // Error handled silently
      });

      get().refreshPendingChanges().catch(() => {
        // ignore refresh errors on init
      })
    },

    loadDay: (date: string) => {
      return loadDay(date, get, set);
    },
    
    addExercise: async (catalogId: string, name: string, position?: number) => {
      const id = await crud.addExercise(catalogId, name, get, position)
      await get().refreshPendingChanges()
      return id
    },

    updateExercise: async (id, patch) => {
        await crud.updateExercise(id, patch);
        await get().refreshPendingChanges()
    },

    deleteExercise: async (id) => {
        await crud.deleteExercise(id);
        await get().refreshPendingChanges()
    },
    
    addSet: async (exerciseTempId: string) => {
        await crud.addSet(exerciseTempId, get);
        await get().refreshPendingChanges()
    },

    updateSet: async (id: string, patch: Partial<WorkoutSet>) => {
        await crud.updateSet(id, patch);
        await get().refreshPendingChanges()
    },

    deleteSet: async (id: string) => {
        await crud.deleteSet(id);
        await get().refreshPendingChanges()
    },

    addRest: async (exerciseId: string, durationSeconds?: number) => {
        await crud.addRest(exerciseId, get, durationSeconds);
        await get().refreshPendingChanges()
    },

    updateRest: async (id: string, patch: Partial<Rest>) => {
        await crud.updateRest(id, patch);
        await get().refreshPendingChanges()
    },

    deleteRest: async (id: string) => {
        await crud.deleteRest(id);
        await get().refreshPendingChanges()
    },

    updateDay: async (id: string, patch: Partial<WorkoutDay>) => {
        await crud.updateDay(id, patch);
        await get().refreshPendingChanges()
    },

    queueCreateExercise: async ({ catalogId, nameDisplay, position }) => {
      await crud.addExercise(catalogId, nameDisplay, get, position)
      await get().refreshPendingChanges()
    },

    sync: () => sync(get, set),

    flush: () => {
      return get().sync()
    },

    refreshPendingChanges: async () => {
      try {
        const db = await getDb()
        const [days, exercises, sets, rests, deletedDocs] = await Promise.all([
          db.workout_days.find({ selector: { isSynced: false } }).exec(),
          db.exercises.find({ selector: { isSynced: false } }).exec(),
          db.sets.find({ selector: { isSynced: false } }).exec(),
          db.rest_periods.find({ selector: { isSynced: false } }).exec(),
          db.deleted_documents.find().exec()
        ])
        const hasPending =
          days.length > 0 ||
          exercises.length > 0 ||
          sets.length > 0 ||
          rests.length > 0 ||
          deletedDocs.length > 0
        set({
          pendingChanges: {
            hasAny: hasPending,
            unsyncedDays: days.length,
            unsyncedExercises: exercises.length,
            unsyncedSets: sets.length,
            unsyncedRests: rests.length,
            pendingDeletes: deletedDocs.length
          },
          deletedDocumentsCount: deletedDocs.length
        })
      } catch (error) {
        console.error('Failed to refresh pending changes', error)
      }
    },

    cleanup: () => {
      const { daySub, exercisesSub, setsSub, restsSub, deletedDocumentsSub } = get();
      daySub?.unsubscribe();
      exercisesSub?.unsubscribe();
      setsSub?.unsubscribe();
      restsSub?.unsubscribe();
      deletedDocumentsSub?.unsubscribe();
    },

  };
});