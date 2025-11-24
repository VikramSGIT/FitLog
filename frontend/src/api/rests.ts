import { request } from './'
import { RestPeriod } from './'

export const createRest = (exerciseId: string, data: { position: number; durationSeconds: number }) =>
  request<RestPeriod>(`/api/exercises/${exerciseId}/rests`, {
    method: 'POST',
    body: JSON.stringify({
      position: data.position,
      durationSeconds: data.durationSeconds
    })
  })

export const updateRest = (id: string, data: Partial<{ position: number; durationSeconds: number }>) =>
  request<RestPeriod>(`/api/rests/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  })

export const deleteRest = (id: string) => request<void>(`/api/rests/${id}`, { method: 'DELETE' })
