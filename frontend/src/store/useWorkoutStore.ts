import { create } from 'zustand';
import { Subscription } from 'rxjs';
import { getDb } from '@/db/service';
import { WorkoutDay, Exercise, WorkoutDayDoc } from '@/db/schema';
import type { Set } from '@/db/schema';
import { v4 as uuidv4 } from 'uuid';

import { sync } from './helpers/sync';
import { loadDay } from './helpers/loadDay';
import * as crud from './helpers/crud';

// Helper to format date strings
const toDateString = (date: Date): string => date.toISOString().split('T')[0];

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
type SaveMode = 'auto' | 'manual';

type DayWithExercises = {
  id: string;
  tempId?: string;
  exercises: Exercise[];
  isRestDay: boolean;
  workoutDate: string;
  notes?: string;
  userId: string;
};

export type WorkoutState = {
  // State
  activeDay: WorkoutDayDoc | null;
  exercises: Exercise[];
  sets: Set[];
  daySub: Subscription | null;
  exercisesSub: Subscription | null;
  setsSub: Subscription | null;
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
  loadDay: (date: string) => Promise<void>;
  addExercise: (catalogId: string, name: string) => Promise<string>;
  queueCreateExercise: (params: { dayId: string; catalogId: string; nameDisplay: string; position: number }) => Promise<void>;
  updateExercise: (tempId: string, patch: Partial<Exercise>) => Promise<void>;
  deleteExercise: (tempId: string) => Promise<void>;
  addSet: (exerciseTempId: string) => Promise<void>;
  updateSet: (tempId: string, patch: Partial<Set>) => Promise<void>;
  deleteSet: (tempId: string) => Promise<void>;
  updateDay: (tempId: string, patch: Partial<WorkoutDay>) => Promise<void>;
  sync: () => Promise<void>;
  cleanup: () => void;
  setSaving: (status: SaveStatus, mode: SaveMode) => void;
  registerAutoSave: (flush: () => Promise<boolean>) => () => void;
  setSetDirty: (tempId: string, isDirty: boolean) => void;
};

export const useWorkoutStore = create<WorkoutState>((set, get) => {
  // Auto-save registry
  const autoSaveFlushes: Array<() => Promise<boolean>> = [];

  return {
    // Initial State
    activeDay: null,
    exercises: [],
    sets: [],
    daySub: null,
    exercisesSub: null,
    setsSub: null,
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

      get().loadDay(get().selectedDate).catch(() => {
        // Error handled silently
      });
    },

    loadDay: (date: string) => loadDay(date, get, set),
    
    addExercise: (catalogId: string, name: string) => crud.addExercise(catalogId, name, get),
    
    queueCreateExercise: (params: { dayId: string; catalogId: string; nameDisplay: string; position: number }) => crud.queueCreateExercise(params, get),

    updateExercise: async (tempId, patch) => {
        await crud.updateExercise(tempId, patch);
    },

    deleteExercise: async (tempId) => {
        await crud.deleteExercise(tempId);
    },
    
    addSet: async (exerciseTempId: string) => {
        await crud.addSet(exerciseTempId, get);
    },

    updateSet: async (tempId: string, patch: Partial<Set>) => {
        await crud.updateSet(tempId, patch);
    },

    deleteSet: async (tempId: string) => {
        await crud.deleteSet(tempId);
    },

    updateDay: async (tempId: string, patch: Partial<WorkoutDay>) => {
        await crud.updateDay(tempId, patch);
    },

    sync: () => sync(get, set),

    cleanup: () => {
      const { daySub, exercisesSub, setsSub, deletedDocumentsSub } = get();
      daySub?.unsubscribe();
      exercisesSub?.unsubscribe();
      setsSub?.unsubscribe();
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

    setSetDirty: (tempId: string, isDirty: boolean) => {
      set(state => {
        const newDirtySetIds = new Set(state.dirtySetIds);
        if (isDirty) {
          newDirtySetIds.add(tempId);
        } else {
          newDirtySetIds.delete(tempId);
        }
        return { dirtySetIds: newDirtySetIds };
      });
    },
  };
});