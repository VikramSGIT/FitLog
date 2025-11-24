import { request } from './'

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export const getSaveEpoch = () => request<{ serverEpoch: number }>('/api/save/epoch')

export const saveBatch = (
  ops: Array<
    | { type: 'createExercise'; tempId: string; dayId: string; catalogId: string; position: number; comment?: string }
    | { type: 'createSet'; tempId: string; exerciseId: string; position: number; reps: number; weightKg: number; isWarmup?: boolean }
    | { type: 'updateExercise'; id: string; patch: Partial<{ position: number; comment: string }> }
    | { type: 'updateSet'; id: string; patch: Partial<{ position: number; reps: number; weightKg: number; isWarmup: boolean }> }
    | { type: 'reorderExercises'; dayId: string; orderedIds: string[] }
    | { type: 'reorderSets'; exerciseId: string; orderedIds: string[] }
    | { type: 'deleteExercise'; id: string }
    | { type: 'deleteSet'; id: string }
    | { type: 'createRest'; tempId: string; exerciseId: string; position: number; durationSeconds: number }
    | { type: 'updateRest'; id: string; patch: Partial<{ position: number; durationSeconds: number }> }
    | { type: 'deleteRest'; id: string }
    | { type: 'updateDay'; dayId: string; isRestDay: boolean }
  >,
  idempotencyKey?: string,
  clientEpoch?: number
) =>
  (async () => {
    const res = await fetch(`${API_BASE}/api/save`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        version: 'v1',
        idempotencyKey,
        clientEpoch: clientEpoch ?? Number(localStorage.getItem('saveEpoch') || '0'),
        ops
      })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const code = (data && data.error && data.error.code) || ''
      const serverEpoch = data && data.serverEpoch
      const err = new Error(code || `HTTP ${res.status}`)
      ;(err as any).code = code
      ;(err as any).serverEpoch = serverEpoch
      throw err
    }
    return data as {
      applied: boolean
      mapping: {
        exercises: { tempId: string; id: string }[]
        sets: { tempId: string; id: string }[]
        rests: { tempId: string; id: string }[]
      }
      updatedAt: string
      serverEpoch: number
    }
  })()
