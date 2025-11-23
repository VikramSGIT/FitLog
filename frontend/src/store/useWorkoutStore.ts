import { create } from 'zustand';
import { Subscription } from 'rxjs';
import { getDb } from '@/db/service';
import { WorkoutDay, Exercise, Set, WorkoutDayDoc } from '@/db/schema';
import { api } from '@/api/client';
import { v4 as uuidv4 } from 'uuid';

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
  selectedDate: string;
  isLoading: boolean;
  isSyncing: boolean;
  userId: string | null;
  saveStatus: SaveStatus;
  saveMode: SaveMode | null;

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
};

export const useWorkoutStore = create<WorkoutState>((set, get) => {
  // Auto-save registry
  const autoSaveFlushes: Array<() => Promise<boolean>> = [];

  // Helper function to compute day from activeDay and exercises
  const computeDay = (activeDay: WorkoutDayDoc | null, exercises: Exercise[]): DayWithExercises | null => {
    if (!activeDay) return null;
    return {
      id: activeDay.id || activeDay.tempId || '',
      tempId: activeDay.tempId,
      exercises: exercises || [],
      isRestDay: activeDay.isRestDay,
      workoutDate: activeDay.workoutDate,
      notes: activeDay.notes,
      userId: activeDay.userId,
    };
  };

  return {
    // Initial State
    activeDay: null,
    exercises: [],
    sets: [],
    daySub: null,
    exercisesSub: null,
    setsSub: null,
    selectedDate: toDateString(new Date()),
    isLoading: false,
    isSyncing: false,
    userId: null,
    saveStatus: 'idle' as SaveStatus,
    saveMode: null as SaveMode | null,
    
    // Computed selectors
    day: null,
    dayLoading: false,

    // Actions
    init: (userId: string) => {
      set({ userId });
      get().loadDay(get().selectedDate).catch(() => {
        // Error handled silently
      });
    },

    loadDay: async (date: string) => {
      const { userId, daySub, exercisesSub, setsSub } = get();
      if (!userId) return;

      // Clean up previous subscriptions
      daySub?.unsubscribe();
      exercisesSub?.unsubscribe();
      setsSub?.unsubscribe();

      set({ 
        isLoading: true, 
        dayLoading: true, 
        selectedDate: date, 
        activeDay: null, 
        exercises: [], 
        sets: [], 
        day: null 
      });

      const db = await getDb();

      // Step 1: Try to find day in local DB first
      let dayDoc = await db.workout_days.findOne({
        selector: {
          workoutDate: date,
          userId: userId,
        },
      }).exec();

      // Step 2: If not found locally, fetch from server and save locally
      if (!dayDoc) {
        try {
          const remoteDay = await api.getDayByDate(date, true);
          if (remoteDay && 'id' in remoteDay && remoteDay.id) {
            const workoutDateStr = remoteDay.workoutDate.includes('T') 
              ? remoteDay.workoutDate.split('T')[0] 
              : remoteDay.workoutDate;
            
            const workoutDayData: WorkoutDay = {
              id: remoteDay.id,
              tempId: uuidv4(), // Generate tempId for local reference
              userId: userId,
              workoutDate: workoutDateStr,
              notes: remoteDay.notes || undefined,
              isRestDay: remoteDay.isRestDay,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              isUnsynced: false
            };
            dayDoc = await db.workout_days.insert(workoutDayData);

            // Save exercises and sets
            for (const ex of remoteDay.exercises) {
              const exerciseData: Exercise = {
                id: ex.id,
                tempId: uuidv4(),
                dayId: dayDoc.tempId!, // Always use tempId for local references
                catalogId: ex.catalogId,
                name: ex.name,
                position: ex.position,
                comment: ex.comment,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                isUnsynced: false
              };
              const exerciseDoc = await db.exercises.insert(exerciseData);

              if (ex.sets) {
                for (const s of ex.sets) {
                  const setData: Set = {
                    id: s.id,
                    tempId: uuidv4(),
                    exerciseId: exerciseDoc.tempId!, // Always use tempId for local references
                    userId: userId,
                    workoutDate: workoutDateStr,
                    position: s.position,
                    reps: s.reps,
                    weightKg: s.weightKg,
                    rpe: s.rpe,
                    isWarmup: s.isWarmup,
                    restSeconds: s.restSeconds,
                    tempo: s.tempo,
                    performedAt: s.performedAt,
                    volumeKg: s.volumeKg,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    isUnsynced: false,
                  };
                  await db.sets.insert(setData);
                }
              }
            }
          }
        } catch (error) {
          // Day doesn't exist on server, that's fine - we'll create it locally when needed
        }
      }

      // Step 3: Subscribe to day document
      const newDaySub = db.workout_days
        .findOne({
          selector: {
            workoutDate: date,
            userId: userId,
          },
        })
        .$.subscribe(async (dayDoc) => {
          if (!dayDoc) {
            set({ activeDay: null, exercises: [], sets: [], day: null, dayLoading: false });
            return;
          }

          set({ activeDay: dayDoc, day: computeDay(dayDoc, get().exercises), dayLoading: false });

          // Clean up previous exercise subscription
          const { exercisesSub: prevExercisesSub } = get();
          prevExercisesSub?.unsubscribe();

          // Step 4: Subscribe to exercises for this day
          const exercisesSub = db.exercises
            .find({
              selector: { dayId: dayDoc.tempId },
            })
            .$.subscribe(exercises => {
              const sortedExercises = [...exercises].sort((a, b) => a.position - b.position);
              const { activeDay } = get();
              set({ exercises: sortedExercises, day: computeDay(activeDay, sortedExercises) });

              // Clean up previous sets subscription
              const { setsSub: prevSetsSub } = get();
              prevSetsSub?.unsubscribe();

              // Step 5: Subscribe to sets for these exercises
              const exerciseTempIds = sortedExercises.map(ex => ex.tempId).filter(Boolean) as string[];
              if (exerciseTempIds.length > 0) {
                const setsSub = db.sets
                  .find({
                    selector: {
                      exerciseId: { $in: exerciseTempIds }
                    }
                  })
                  .$.subscribe(sets => {
                    const sortedSets = [...sets].sort((a, b) => a.position - b.position);
                    set({ sets: sortedSets });
                  });
                set({ setsSub });
              } else {
                set({ sets: [], setsSub: null });
              }
            });
          
          set({ exercisesSub });
        });

      set({ daySub: newDaySub, isLoading: false });
    },

    addExercise: async (catalogId: string, name: string) => {
      const { userId, selectedDate, exercises, activeDay } = get();
      if (!userId) return '';
      
      const db = await getDb();
      let dayDoc = activeDay;

      // Create day if it doesn't exist
      if (!dayDoc) {
        const newDay: WorkoutDay = {
          id: null as any,
          tempId: uuidv4(),
          userId: userId,
          workoutDate: selectedDate,
          isRestDay: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isUnsynced: true,
        };
        dayDoc = await db.workout_days.insert(newDay);
        // The subscription will update activeDay automatically
      }

      const newExercise: Exercise = {
        id: null as any,
        tempId: uuidv4(),
        dayId: dayDoc.tempId!,
        catalogId: catalogId,
        name: name,
        position: exercises.length,
        isUnsynced: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await db.exercises.insert(newExercise);
      return newExercise.tempId!;
    },

    queueCreateExercise: async ({ dayId, catalogId, nameDisplay, position }) => {
      const { userId, activeDay, selectedDate } = get();
      if (!userId) return;
      
      const db = await getDb();
      let dayDoc = activeDay;

      // Find or create day
      if (!dayDoc || (dayDoc.tempId !== dayId && dayDoc.id !== dayId)) {
        dayDoc = await db.workout_days.findOne({
          selector: {
            $or: [
              { tempId: dayId },
              { id: dayId }
            ]
          }
        }).exec();

        if (!dayDoc) {
          const newDay: WorkoutDay = {
            id: null as any,
            tempId: uuidv4(),
            userId: userId,
            workoutDate: selectedDate,
            isRestDay: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isUnsynced: true,
          };
          dayDoc = await db.workout_days.insert(newDay);
        }
      }
      
      const newExercise: Exercise = {
        id: null as any,
        tempId: uuidv4(),
        dayId: dayDoc.tempId!,
        catalogId: catalogId,
        name: nameDisplay,
        position: position,
        isUnsynced: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await db.exercises.insert(newExercise);
    },

    updateExercise: async (tempId, patch) => {
      const db = await getDb();
      const doc = await db.exercises.findOne(tempId).exec();
      if (doc) {
        await doc.incrementalModify((oldData: Exercise) => ({...oldData, ...patch, isUnsynced: true}));
      }
    },

    deleteExercise: async (tempId) => {
      const db = await getDb();
      const doc = await db.exercises.findOne(tempId).exec();
      if (doc) {
        // Track deletion if synced
        if (doc.id) {
          await db.deleted_documents.insert({
            id: doc.id as any,
            tempId: uuidv4(),
            collectionName: 'exercises',
            deletedAt: new Date().toISOString(),
          });
        }
        await doc.remove();
      }
    },
    
    addSet: async (exerciseTempId: string) => {
      const { userId, selectedDate, sets } = get();
      if (!userId) return;

      const db = await getDb();
      const exerciseSets = sets.filter(s => s.exerciseId === exerciseTempId);

      const newSet: Set = {
        id: null as any,
        tempId: uuidv4(),
        exerciseId: exerciseTempId,
        userId: userId,
        workoutDate: selectedDate,
        position: exerciseSets.length,
        reps: 1,
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
      if (doc) {
        await doc.incrementalModify((oldData: Set) => ({...oldData, ...patch, isUnsynced: true}));
      }
    },

    deleteSet: async (tempId: string) => {
      const db = await getDb();
      const doc = await db.sets.findOne(tempId).exec();
      if (doc) {
        // Track deletion if synced
        if (doc.id) {
          await db.deleted_documents.insert({
            id: doc.id as any,
            tempId: uuidv4(),
            collectionName: 'sets',
            deletedAt: new Date().toISOString(),
          });
        }
        await doc.remove();
      }
    },

    updateDay: async (tempId: string, patch: Partial<WorkoutDay>) => {
      const db = await getDb();
      const doc = await db.workout_days.findOne(tempId).exec();
      if (doc) {
        await doc.incrementalModify((oldData: WorkoutDay) => ({...oldData, ...patch, isUnsynced: true}));
      }
    },

    sync: async () => {
      const { isSyncing } = get();
      if (isSyncing) {
        console.log('[Sync] Already syncing, skipping');
        return;
      }

      console.log('[Sync] Starting sync...');
      set({ isSyncing: true });
      get().setSaving('saving', 'manual');

      const db = await getDb();

      try {
        // Collect all unsynced changes
        const unsyncedDays = await db.workout_days.find({ selector: { isUnsynced: true } }).exec();
        const unsyncedExercises = await db.exercises.find({ selector: { isUnsynced: true } }).exec();
        const unsyncedSets = await db.sets.find({ selector: { isUnsynced: true } }).exec();
        const deletedDocs = await db.deleted_documents.find().exec();
        
        console.log('[Sync] Found unsynced:', {
          days: unsyncedDays.length,
          exercises: unsyncedExercises.length,
          sets: unsyncedSets.length,
          deleted: deletedDocs.length
        });

        const ops: any[] = [];
        const dayIdMap = new Map<string, string>(); // tempId -> serverId

        // Helper to resolve day ID (tempId -> serverId)
        const resolveDayId = async (dayId: string): Promise<string | null> => {
          // Check if already in map
          if (dayIdMap.has(dayId)) {
            return dayIdMap.get(dayId)!;
          }
          
          // Try to find in database by tempId (primary key)
          let dayDoc = await db.workout_days.findOne(dayId).exec();
          
          // If not found by tempId, try to find by id
          if (!dayDoc) {
            const days = await db.workout_days.find({ selector: { id: dayId } }).exec();
            dayDoc = days[0] || null;
          }
          
          if (dayDoc) {
            if (dayDoc.id) {
              // Map both tempId and id to server ID
              dayIdMap.set(dayDoc.tempId!, dayDoc.id);
              if (dayDoc.tempId !== dayId) {
                dayIdMap.set(dayId, dayDoc.id);
              }
              return dayDoc.id;
            }
            // Day doesn't have server ID yet, try to create it
            try {
              const remoteDay = await api.getDayByDate(dayDoc.workoutDate, true);
              if (remoteDay && 'id' in remoteDay && remoteDay.id) {
                await dayDoc.incrementalModify((old: WorkoutDay) => ({...old, id: remoteDay.id, isUnsynced: false}));
                dayIdMap.set(dayDoc.tempId!, remoteDay.id);
                if (dayDoc.tempId !== dayId) {
                  dayIdMap.set(dayId, remoteDay.id);
                }
                return remoteDay.id;
              }
            } catch (err) {
              console.error('[Sync] Failed to create day:', err);
            }
          }
          return null;
        };

        // First pass: resolve all unsynced day IDs
        for (const day of unsyncedDays) {
          if (!day.id) {
            // Day needs to be created - use ensure endpoint
            try {
              const remoteDay = await api.getDayByDate(day.workoutDate, true);
              if (remoteDay && 'id' in remoteDay && remoteDay.id) {
                await day.incrementalModify((old: WorkoutDay) => ({...old, id: remoteDay.id, isUnsynced: false}));
                dayIdMap.set(day.tempId!, remoteDay.id);
              }
            } catch {
              // Skip this day for now
            }
          } else {
            dayIdMap.set(day.tempId!, day.id);
            // Update day if needed
            ops.push({
              type: 'updateDay',
              dayId: day.id,
              isRestDay: day.isRestDay,
            });
          }
        }

        // Process exercises
        for (const ex of unsyncedExercises) {
          if (!ex.id) {
            // Create - resolve dayId
            const serverDayId = await resolveDayId(ex.dayId);
            if (serverDayId) {
              ops.push({
                type: 'createExercise',
                tempId: ex.tempId!,
                dayId: serverDayId,
                catalogId: ex.catalogId,
                position: ex.position,
                comment: ex.comment,
              });
            }
          } else {
            // Update
            ops.push({
              type: 'updateExercise',
              id: ex.id,
              patch: {
                position: ex.position,
                comment: ex.comment,
              }
            });
          }
        }

        // Helper to resolve exercise ID (tempId -> serverId)
        const resolveExerciseId = async (exerciseId: string): Promise<string | null> => {
          // Check if it's in unsynced exercises
          const unsyncedEx = unsyncedExercises.find(ex => ex.tempId === exerciseId || ex.id === exerciseId);
          if (unsyncedEx && unsyncedEx.id) {
            return unsyncedEx.id;
          }
          
          // Try to find in database by tempId (primary key)
          let exDoc = await db.exercises.findOne(exerciseId).exec();
          
          // If not found by tempId, try to find by id
          if (!exDoc) {
            const exercises = await db.exercises.find({ selector: { id: exerciseId } }).exec();
            exDoc = exercises[0] || null;
          }
          
          if (exDoc && exDoc.id) {
            return exDoc.id;
          }
          return null;
        };

        // Process sets
        for (const set of unsyncedSets) {
          if (!set.id) {
            // Create - resolve exerciseId
            const serverExerciseId = await resolveExerciseId(set.exerciseId);
            if (serverExerciseId) {
              ops.push({
                type: 'createSet',
                tempId: set.tempId!,
                exerciseId: serverExerciseId,
                position: set.position,
                reps: set.reps,
                weightKg: set.weightKg,
                isWarmup: set.isWarmup,
              });
            }
          } else {
            // Update
            ops.push({
              type: 'updateSet',
              id: set.id,
              patch: {
                position: set.position,
                reps: set.reps,
                weightKg: set.weightKg,
                isWarmup: set.isWarmup,
              },
            });
          }
        }

        // Process deletions
        for (const doc of deletedDocs) {
          if (doc.id && doc.collectionName === 'exercises') {
            ops.push({ type: 'deleteExercise', id: doc.id });
          } else if (doc.id && doc.collectionName === 'sets') {
            ops.push({ type: 'deleteSet', id: doc.id });
          }
        }

        console.log('[Sync] Prepared ops:', ops.length);
        
        if (ops.length === 0) {
          console.log('[Sync] No operations to sync');
          set({ isSyncing: false });
          get().setSaving('idle', 'manual');
          return;
        }

        // Send to server
        console.log('[Sync] Sending to server...', ops);
        const clientEpoch = Number(localStorage.getItem('saveEpoch') || '0');
        const res = await api.saveBatch(ops, crypto.randomUUID?.() || `${Date.now()}`, clientEpoch);
        console.log('[Sync] Server response:', res);

        // Apply server mappings
        if (res.mapping) {
          if (res.mapping.exercises) {
            for (const item of res.mapping.exercises) {
              const doc = await db.exercises.findOne(item.tempId).exec();
              if (doc) {
                await doc.incrementalModify((old: Exercise) => ({...old, id: item.id, isUnsynced: false}));
              }
            }
          }
          if (res.mapping.sets) {
            for (const item of res.mapping.sets) {
              const doc = await db.sets.findOne(item.tempId).exec();
              if (doc) {
                await doc.incrementalModify((old: Set) => ({...old, id: item.id, isUnsynced: false}));
              }
            }
          }
        }

        // Mark all synced documents as synced
        for (const day of unsyncedDays) {
          if (day.id) {
            await day.incrementalModify((old: WorkoutDay) => ({...old, isUnsynced: false}));
          }
        }
        for (const ex of unsyncedExercises) {
          if (ex.id) {
            await ex.incrementalModify((old: Exercise) => ({...old, isUnsynced: false}));
          }
        }
        for (const set of unsyncedSets) {
          if (set.id) {
            await set.incrementalModify((old: Set) => ({...old, isUnsynced: false}));
          }
        }

        // Clear deleted documents
        await db.deleted_documents.find().remove();

        // Update epoch
        localStorage.setItem('saveEpoch', String(res.serverEpoch));

        // Mark as saved
        console.log('[Sync] Sync completed successfully');
        get().setSaving('saved', 'manual');

      } catch (error: any) {
        console.error('[Sync] Error during sync:', error);
        // Handle stale epoch
        if (error.code === 'stale_epoch' && error.serverEpoch) {
          console.log('[Sync] Stale epoch detected, updating...');
          localStorage.setItem('saveEpoch', String(error.serverEpoch));
          await db.deleted_documents.find().remove();
        }
        get().setSaving('error', 'manual');
        throw error;
      } finally {
        set({ isSyncing: false });
        console.log('[Sync] Sync finished');
      }
    },

    cleanup: () => {
      const { daySub, exercisesSub, setsSub } = get();
      daySub?.unsubscribe();
      exercisesSub?.unsubscribe();
      setsSub?.unsubscribe();
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
  };
});
