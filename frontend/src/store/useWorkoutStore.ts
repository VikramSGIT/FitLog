
import { create } from 'zustand';
import { Subscription } from 'rxjs';
import { getDb } from '@/db/service';
import { WorkoutDay, Exercise, Set, WorkoutDayDoc } from '@/db/schema';
import { api, DayWithDetails } from '@/api/client';
import { v4 as uuidv4 } from 'uuid';

// Helper to format date strings
const toDateString = (date: Date): string => date.toISOString().split('T')[0];

export type WorkoutState = {
  // State
  activeDay: WorkoutDayDoc | null;
  exercises: Exercise[];
  sets: Set[];
  activeDaySub: Subscription | null;
  selectedDate: string;
  isLoading: boolean;
  isSyncing: boolean;
  userId: string | null; // Assuming we can get the user ID

  // Actions
  init: (userId: string) => void;
  loadDay: (date: string) => Promise<void>;
  addExercise: (catalogId: string, name: string) => Promise<string>;
  updateExercise: (tempId: string, patch: Partial<Exercise>) => Promise<void>;
  deleteExercise: (tempId: string) => Promise<void>;
  addSet: (exerciseTempId: string) => Promise<void>;
  updateSet: (tempId: string, patch: Partial<Set>) => Promise<void>;
  deleteSet: (tempId: string) => Promise<void>;
  sync: () => Promise<void>;
  cleanup: () => void;
};

export const useWorkoutStore = create<WorkoutState>((set, get) => ({
  // Initial State
  activeDay: null,
  exercises: [],
  sets: [],
  activeDaySub: null,
  selectedDate: toDateString(new Date()),
  isLoading: false,
  isSyncing: false,
  userId: null,

  // Actions
  init: (userId: string) => {
    set({ userId });
    get().loadDay(get().selectedDate);
  },

  loadDay: async (date: string) => {
    const { activeDaySub, userId } = get();
    if (!userId) return;

    // Unsubscribe from previous subscription
    activeDaySub?.unsubscribe();

    set({ isLoading: true, selectedDate: date, activeDay: null, exercises: [], sets: [] });

    const db = await getDb();

    // 1. Fetch day from backend API
    try {
      const remoteDay = await api.getDay(date);
      if (remoteDay) {
        // 2. Upsert data into RxDB
        // This is a simplified upsert. A real implementation would need to be more robust
        // and handle conflicts between local and remote data.
        const workoutDayData: WorkoutDay = {
            id: remoteDay.id,
            tempId: remoteDay.id, // Using the backend ID as tempId for synced data
            userId: userId,
            workoutDate: remoteDay.workoutDate,
            notes: remoteDay.notes,
            isRestDay: remoteDay.isRestDay,
            createdAt: remoteDay.createdAt,
            updatedAt: remoteDay.updatedAt,
            isUnsynced: false
        };
        await db.workout_days.upsert(workoutDayData);

        for (const ex of remoteDay.exercises) {
            const exerciseData: Exercise = {
                id: ex.id,
                tempId: ex.id,
                dayId: remoteDay.id,
                catalogId: ex.catalogId,
                name: ex.name,
                position: ex.position,
                comment: ex.comment,
                createdAt: ex.createdAt,
                updatedAt: ex.updatedAt,
                isUnsynced: false
            };
            await db.exercises.upsert(exerciseData);

            if(ex.sets) {
                for (const s of ex.sets) {
                    const setData: Set = {
                        id: s.id,
                        tempId: s.id,
                        exerciseId: ex.id,
                        userId: userId,
                        workoutDate: remoteDay.workoutDate,
                        position: s.position,
                        reps: s.reps,
                        weightKg: s.weightKg,
                        rpe: s.rpe,
                        isWarmup: s.isWarmup,
                        restSeconds: s.restSeconds,
                        tempo: s.tempo,
                        performedAt: s.performedAt,
                        volumeKg: s.volumeKg,
                        createdAt: s.createdAt,
                        updatedAt: s.updatedAt,
                        isUnsynced: false,
                    };
                    await db.sets.upsert(setData);
                }
            }
        }
      }
    } catch (error) {
      console.error('Failed to fetch day from backend', error);
      // Day might not exist on the backend, which is fine.
    }

    // 3. Subscribe to the day and its exercises/sets from RxDB
    const daySub = db.workout_days
      .findOne({
        selector: {
          workoutDate: date,
          userId: userId,
        },
      })
      .$.subscribe(async (dayDoc) => {
        set({ activeDay: dayDoc });
        if (dayDoc) {
          // Subscribe to exercises
          const exercisesSub = dayDoc.populate('exercises').then(exercises => {
            set({ exercises });
            // For each exercise, get sets
            const setsPromises = exercises.map(ex => db.sets.find({ selector: { exerciseId: ex.tempId } }).exec());
            Promise.all(setsPromises).then(setsArrays => {
              const allSets = setsArrays.flat();
              set({ sets: allSets });
            });
          });
        } else {
          set({ exercises: [], sets: [] });
        }
      });

    set({ isLoading: false, activeDaySub: daySub });
  },

  addExercise: async (catalogId: string, name: string) => {
    const { userId, selectedDate, exercises, activeDay } = get();
    if (!userId) return '';
    
    const db = await getDb();
    let dayId = activeDay?.tempId;

    // If there's no active day, create one
    if(!activeDay) {
        const newDay: WorkoutDay = {
            id: null,
            tempId: uuidv4(),
            userId: userId,
            workoutDate: selectedDate,
            isRestDay: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isUnsynced: true,
        };
        const newDayDoc = await db.workout_days.insert(newDay);
        dayId = newDayDoc.tempId;
    }

    if(!dayId) return '';

    const newExercise: Exercise = {
        id: null,
        tempId: uuidv4(),
        dayId: dayId,
        catalogId: catalogId,
        name: name,
        position: exercises.length,
        isUnsynced: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    await db.exercises.insert(newExercise);
    return newExercise.tempId;
  },

  updateExercise: async (tempId, patch) => {
    const db = await getDb();
    const doc = await db.exercises.findOne(tempId).exec();
    if (doc) {
      await doc.atomicUpdate(oldData => ({...oldData, ...patch, isUnsynced: true}));
    }
  },

  deleteExercise: async (tempId) => {
    const db = await getDb();
    const doc = await db.exercises.findOne(tempId).exec();
    if (doc) {
      await db.deleted_documents.insert({
        id: doc.id,
        tempId: doc.tempId,
        collectionName: 'exercises',
        deletedAt: new Date().toISOString(),
      });
      await doc.remove();
    }
  },
  
  addSet: async (exerciseTempId: string) => {
    const { userId, selectedDate, sets } = get();
    if(!userId) return;

    const db = await getDb();

    // find how many sets for this exercise
    const exerciseSets = await db.sets.find({ selector: { exerciseId: exerciseTempId } }).exec();

    const newSet: Set = {
        id: null,
        tempId: uuidv4(),
        exerciseId: exerciseTempId,
        userId: userId,
        workoutDate: selectedDate,
        position: exerciseSets.length,
        reps: 0,
        weightKg: 0,
        isWarmup: false,
        isUnsynced: true,
        volumeKg: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    await db.sets.insert(newSet);
  },

  updateSet: async (tempId: string, patch: Partial<Set>) => {
    const db = await getDb();
    const doc = await db.sets.findOne(tempId).exec();
    if(doc) {
        await doc.atomicUpdate(oldData => ({...oldData, ...patch, isUnsynced: true}));
    }
  },

  deleteSet: async (tempId: string) => {
    const db = await getDb();
    const doc = await db.sets.findOne(tempId).exec();
    if(doc) {
        await db.deleted_documents.insert({
            id: doc.id,
            tempId: doc.tempId,
            collectionName: 'sets',
            deletedAt: new Date().toISOString(),
        });
        await doc.remove();
    }
  },

  sync: async () => {
    const { isSyncing } = get();
    if (isSyncing) return;

    set({ isSyncing: true });

    const db = await getDb();
    const ops: any[] = [];

    // Collect unsynced documents
    const unsyncedDays = await db.workout_days.find({ selector: { isUnsynced: true } }).exec();
    const unsyncedExercises = await db.exercises.find({ selector: { isUnsynced: true } }).exec();
    const unsyncedSets = await db.sets.find({ selector: { isUnsynced: true } }).exec();

    // Collect deleted documents
    const deletedDocs = await db.deleted_documents.find().exec();

    // Prepare ops for workout days
    unsyncedDays.forEach(doc => {
      if (!doc.id) { // Create
        // Not implemented in backend batch save, handle separately or extend backend
      } else { // Update
        ops.push({
          type: 'updateDay',
          dayId: doc.id,
          isRestDay: doc.isRestDay,
          // notes are not in the api spec for batch update
        });
      }
    });

    // Prepare ops for exercises
    unsyncedExercises.forEach(doc => {
      if (!doc.id) { // Create
        ops.push({
          type: 'createExercise',
          tempId: doc.tempId,
          dayId: doc.dayId,
          catalogId: doc.catalogId,
          position: doc.position,
          comment: doc.comment,
        });
      } else { // Update
        ops.push({
          type: 'updateExercise',
          id: doc.id,
          patch: {
            position: doc.position,
            comment: doc.comment,
          }
        });
      }
    });

    // Prepare ops for sets
    unsyncedSets.forEach(doc => {
      const exercise = unsyncedExercises.find(ex => ex.tempId === doc.exerciseId);
      const exerciseId = exercise ? `temp:${exercise.tempId}` : doc.exerciseId;

      if (!doc.id) { // Create
        ops.push({
          type: 'createSet',
          tempId: doc.tempId,
          exerciseId: exerciseId,
          position: doc.position,
          reps: doc.reps,
          weightKg: doc.weightKg,
          isWarmup: doc.isWarmup,
        });
      } else { // Update
        ops.push({
          type: 'updateSet',
          id: doc.id,
          patch: {
            position: doc.position,
            reps: doc.reps,
            weightKg: doc.weightKg,
            isWarmup: doc.isWarmup,
          },
        });
      }
    });

    // Prepare ops for deleted documents
    deletedDocs.forEach(doc => {
      const id = doc.id || `temp:${doc.tempId}`;
      if (doc.collectionName === 'exercises') {
        ops.push({ type: 'deleteExercise', id: id });
      } else if (doc.collectionName === 'sets') {
        ops.push({ type: 'deleteSet', id: id });
      }
    });

    if (ops.length === 0) {
      set({ isSyncing: false });
      return;
    }

    try {
      const res = await api.saveBatch(ops, crypto.randomUUID?.() || `${Date.now()}`);

      // Process mappings
      const { mapping } = res;
      if (mapping) {
        if (mapping.exercises) {
            for (const item of mapping.exercises) {
                const doc = await db.exercises.findOne(item.tempId).exec();
                if(doc) await doc.atomicUpdate(old => ({...old, id: item.id, isUnsynced: false}));
            }
        }
        if (mapping.sets) {
            for (const item of mapping.sets) {
                const doc = await db.sets.findOne(item.tempId).exec();
                if(doc) await doc.atomicUpdate(old => ({...old, id: item.id, isUnsynced: false}));
            }
        }
      }

      // Mark updated documents as synced
      unsyncedDays.forEach(doc => doc.id && doc.atomicPatch({ isUnsynced: false }));
      unsyncedExercises.forEach(doc => doc.id && doc.atomicPatch({ isUnsynced: false }));
      unsyncedSets.forEach(doc => doc.id && doc.atomicPatch({ isUnsynced: false }));

      // Clear deleted documents log
      await db.deleted_documents.find().remove();

      localStorage.setItem('saveEpoch', String(res.serverEpoch));

    } catch (error) {
      console.error('Sync failed', error);
      // Handle error, maybe show a notification to the user
    } finally {
      set({ isSyncing: false });
    }
  },

  cleanup: () => {
    get().activeDaySub?.unsubscribe();
  },
}));
