import { API_BASE } from './request';
import { SaveOperation } from './types';

export const saveBatch = (
  ops: Array<SaveOperation>,
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
        exercises: { localId: string; id: string }[]
        sets: { localId: string; id: string }[]
        rests: { localId: string; id: string }[]
      }
      updatedAt: string
      serverEpoch: number
    }
  })();
