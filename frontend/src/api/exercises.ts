import { request } from './'
import { Exercise } from './'

export const createExercise = (dayId: string, data: { position: number; catalogId: string; comment?: string }) =>
  request<Exercise>(`/api/days/${dayId}/exercises`, { method: 'POST', body: JSON.stringify(data) })

export const updateExercise = (id: string, data: Partial<{ position: number; comment: string }>) =>
  request<Exercise>(`/api/exercises/${id}`, { method: 'PATCH', body: JSON.stringify(data) })

export const deleteExercise = (id: string) => request<void>(`/api/exercises/${id}`, { method: 'DELETE' })
