import { getDb } from '@/db/service';
import { api } from '@/api/client';
import { WorkoutDay, Exercise, Set } from '@/db/schema';
import { WorkoutState } from '../useWorkoutStore';
import { v4 as uuidv4 } from 'uuid';

type DayWithExercises = {
  id: string;
  exercises: Exercise[];
  isRestDay: boolean;
  workoutDate: string;
  notes?: string;
  userId: string;
};

const computeDay = (activeDay: WorkoutDay | null, exercises: Exercise[]): DayWithExercises | null => {
  if (!activeDay) return null;
  return {
    id: activeDay.id,
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

        const newLocalDayId = uuidv4();
        const workoutDayData: WorkoutDay = {
          id: newLocalDayId,
          serverId: remoteDay.id,
          userId: userId,
          workoutDate: workoutDateStr,
          notes: remoteDay.notes || undefined,
          isRestDay: remoteDay.isRestDay,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isSynced: true, // Data from server is considered synced
        };
        dayDoc = await db.workout_days.insert(workoutDayData);

        for (const ex of remoteDay.exercises) {
          const newLocalExerciseId = uuidv4();
          const exerciseData: Exercise = {
            id: newLocalExerciseId,
            serverId: ex.id,
            dayId: newLocalDayId,
            catalogId: ex.catalogId,
            name: ex.name,
            position: ex.position,
            comment: ex.comment,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isSynced: true, // Data from server is considered synced
          };
          await db.exercises.insert(exerciseData);

          if (ex.sets) {
            for (const s of ex.sets) {
              const setData: Set = {
                id: uuidv4(),
                serverId: s.id,
                exerciseId: newLocalExerciseId,
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
                isSynced: true, // Data from server is considered synced
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

      const { exercisesSub: prevExercisesSub } = get();
      prevExercisesSub?.unsubscribe();

      // Step 4: Subscribe to exercises for this day
      const newExercisesSub = db.exercises
        .find({
          selector: { dayId: dayDoc.id },
        })
        .$.subscribe(exercises => {
          const sortedExercises = [...exercises].sort((a, b) => a.position - b.position);
          const { activeDay } = get();
          set({ exercises: sortedExercises, day: computeDay(activeDay, sortedExercises) });

          const { setsSub: prevSetsSub } = get();
          prevSetsSub?.unsubscribe();

          // Step 5: Subscribe to sets for these exercises
          const exerciseIds = sortedExercises.map(ex => ex.id).filter(Boolean) as string[];
          if (exerciseIds.length > 0) {
            const newSetsSub = db.sets
              .find({
                selector: {
                  exerciseId: { $in: exerciseIds }
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
