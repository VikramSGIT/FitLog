import { getDb } from '@/db/service';
import { api } from '@/api/client';
import { WorkoutDay, Exercise, Set, WorkoutDayDoc } from '@/db/schema';
import { WorkoutState } from '../useWorkoutStore';
import { v4 as uuidv4 } from 'uuid';

type DayWithExercises = {
    id: string;
    tempId?: string;
    exercises: Exercise[];
    isRestDay: boolean;
    workoutDate: string;
    notes?: string;
    userId: string;
  };

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

export const loadDay = async (date: string, get: () => WorkoutState, set: (state: Partial<WorkoutState>) => void) => {
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
      const newExercisesSub = db.exercises
        .find({
          selector: { dayId: dayDoc.tempId },
        })
        .$.subscribe(exercises => {
          // RxDB documents should have all properties accessible
          const sortedExercises = [...exercises].sort((a, b) => a.position - b.position);
          const { activeDay } = get();
          set({ exercises: sortedExercises, day: computeDay(activeDay, sortedExercises) });

          // Clean up previous sets subscription
          const { setsSub: prevSetsSub } = get();
          prevSetsSub?.unsubscribe();

          // Step 5: Subscribe to sets for these exercises
          const exerciseTempIds = sortedExercises.map(ex => ex.tempId).filter(Boolean) as string[];
          if (exerciseTempIds.length > 0) {
            const newSetsSub = db.sets
              .find({
                selector: {
                  exerciseId: { $in: exerciseTempIds }
                }
              })
              .$.subscribe(sets => {
                const sortedSets = [...sets].sort((a, b) => a.position - b.position);
                set({ sets: sortedSets });
              });
            set({ setsSub: newSetsSub });
          } else {
            set({ sets: [], setsSub: null });
          }
        });

      set({ exercisesSub: newExercisesSub });
    });

  set({ daySub: newDaySub, isLoading: false });
};
