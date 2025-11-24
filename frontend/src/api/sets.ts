import { request } from './'
import { WorkoutSet } from './'

export const createSet = (
  exerciseId: string,
  data: Partial<{
    position: number;
    reps: number;
    weightKg: number;
    rpe: number;
    isWarmup: boolean;
    restSeconds: number;
    tempo: string;
    performedAt: string;
  }>
) => request<WorkoutSet>(`/api/exercises/${exerciseId}/sets`, { method: 'POST', body: JSON.stringify(data) })

export const updateSet = (id: string, data: Partial<WorkoutSet>) =>
  request<WorkoutSet>(`/api/sets/${id}`, { method: 'PATCH', body: JSON.stringify(data) })

export const deleteSet = (id: string) => request<void>(`/api/sets/${id}`, { method: 'DELETE' })
