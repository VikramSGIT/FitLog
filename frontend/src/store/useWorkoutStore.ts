import { create } from 'zustand'
import type { Subscription } from '@/db/types'
import { getDb } from '@/db/service'
import { WorkoutDay, Exercise } from '@/db/schema'
import type { Set, Rest } from '@/db/schema'

import { sync } from './helpers/sync';
import { loadDay } from './helpers/loadDay';
import * as crud from './helpers/crud';

// Helper to format date strings
const toDateString = (date: Date): string => date.toISOString().split('T')[0];

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
type SaveMode = 'auto' | 'manual';

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
  sets: Set[];
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
  saveMode: SaveMode | null;
  dirtySetIds: Set<string>;

  // Computed selectors
  day: DayWithExercises | null;
  dayLoading: boolean;

  // Actions
  init: (userId: string) => void;
  loadDay: (date: string, userId: string) => Promise<void>;
  addExercise: (catalogId: string, name: string, position?: number) => Promise<string>;
  updateExercise: (id: string, patch: Partial<Exercise>) => Promise<void>;
  deleteExercise: (id: string) => Promise<void>;
  addSet: (exerciseTempId: string) => Promise<void>;
  updateSet: (id: string, patch: Partial<Set>) => Promise<void>;
  deleteSet: (id: string) => Promise<void>;
  addRest: (exerciseId: string, durationSeconds?: number) => Promise<void>;
  updateRest: (id: string, patch: Partial<Rest>) => Promise<void>;
  deleteRest: (id: string) => Promise<void>;
  updateDay: (id: string, patch: Partial<WorkoutDay>) => Promise<void>;
  queueCreateExercise: (payload: QueueCreateExercisePayload) => Promise<void>;
  sync: () => Promise<void>;
  cleanup: () => void;
  setSaving: (status: SaveStatus, mode: SaveMode) => void;
  registerAutoSave: (flush: () => Promise<boolean>) => () => void;
  setSetDirty: (id: string, isDirty: boolean) => void;
};

export const useWorkoutStore = create<WorkoutState>((set, get) => {
  // Auto-save registry
  const autoSaveFlushes: Array<() => Promise<boolean>> = [];

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
    saveMode: null as SaveMode | null,
    dirtySetIds: new Set(),

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

      get().loadDay(get().selectedDate, userId).catch(() => {
        // Error handled silently
      });
    },

    loadDay: (date: string, userId: string) => {
      return loadDay(date, get, set);
    },
    
    addExercise: (catalogId: string, name: string, position?: number) => crud.addExercise(catalogId, name, get, position),

    updateExercise: async (id, patch) => {
        await crud.updateExercise(id, patch);
    },

    deleteExercise: async (id) => {
        await crud.deleteExercise(id);
    },
    
    addSet: async (exerciseTempId: string) => {
        await crud.addSet(exerciseTempId, get);
    },

    updateSet: async (id: string, patch: Partial<Set>) => {
        await crud.updateSet(id, patch);
    },

    deleteSet: async (id: string) => {
        await crud.deleteSet(id);
    },

    addRest: async (exerciseId: string, durationSeconds?: number) => {
        await crud.addRest(exerciseId, get, durationSeconds);
    },

    updateRest: async (id: string, patch: Partial<Rest>) => {
        await crud.updateRest(id, patch);
    },

    deleteRest: async (id: string) => {
        await crud.deleteRest(id);
    },

    updateDay: async (id: string, patch: Partial<WorkoutDay>) => {
        await crud.updateDay(id, patch);
    },

    queueCreateExercise: async ({ catalogId, nameDisplay, position }) => {
      await crud.addExercise(catalogId, nameDisplay, get, position)
    },

    sync: () => sync(get, set),

    cleanup: () => {
      const { daySub, exercisesSub, setsSub, restsSub, deletedDocumentsSub } = get();
      daySub?.unsubscribe();
      exercisesSub?.unsubscribe();
      setsSub?.unsubscribe();
      restsSub?.unsubscribe();
      deletedDocumentsSub?.unsubscribe();
    },

    setSaving: (status: SaveStatus, mode: SaveMode) => {
      set({ saveStatus: status, saveMode: mode });
    },

    registerAutoSave: (flush: () => Promise<boolean>) => {
      autoSaveFlushes.push(flush);
      return () => {
        const index = autoSaveFlushes.indexOf(flush);
        if (index > -1) {
          autoSaveFlushes.splice(index, 1);
        }
      };
    },

    setSetDirty: (id: string, isDirty: boolean) => {
      set(state => {
        const newDirtySetIds = new Set(state.dirtySetIds);
        if (isDirty) {
          newDirtySetIds.add(id);
        } else {
          newDirtySetIds.delete(id);
        }
        return { dirtySetIds: newDirtySetIds };
      });
    },
  };
});