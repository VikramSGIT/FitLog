import { request } from './'
import { DayWithDetails } from './'

export const getDayByDate = (date: string, ensure = true) => {
  return request<DayWithDetails | { day: null }>(`/api/days?date=${date}&ensure=${ensure ? 'true' : 'false'}`);
}

export const createDay = (date: string) =>
  request<DayWithDetails>('/api/days', { method: 'POST', body: JSON.stringify({ date }) })

export const updateDay = (dayId: string, data: { isRestDay: boolean }) =>
  request<DayWithDetails>(`/api/days/${dayId}`, { method: 'PATCH', body: JSON.stringify(data) })
