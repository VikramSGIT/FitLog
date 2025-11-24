import { request } from './'
import { CatalogItem, CatalogEntryInput, CatalogRecord, ExerciseStats } from './'

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export const searchCatalog = (params: {
  q?: string
  type?: string
  bodyPart?: string
  equipment?: string
  level?: string
  muscle?: string
  page?: number
  pageSize?: number
  sort?: 'name_asc' | 'name_desc'
}) => {
  const qs = new URLSearchParams()
  if (params.q) qs.set('q', params.q)
  if (params.type) qs.set('type', params.type)
  if (params.bodyPart) qs.set('bodyPart', params.bodyPart)
  if (params.equipment) qs.set('equipment', params.equipment)
  if (params.level) qs.set('level', params.level)
  if (params.muscle) qs.set('muscle', params.muscle)
  if (params.page) qs.set('page', String(params.page))
  if (params.pageSize) qs.set('pageSize', String(params.pageSize))
  if (params.sort) qs.set('sort', params.sort)
  return request<{ items: CatalogItem[]; page: number; pageSize: number; total: number; hasMore: boolean }>(`/api/catalog?${qs.toString()}`)
}

export const getCatalogFacets = () =>
  request<{ types: string[]; bodyParts: string[]; equipment: string[]; levels: string[]; muscles: string[] }>(
    '/api/catalog/facets'
  )

export const getCatalogEntry = (id: string) => request<CatalogRecord>(`/api/catalog/entries/${id}`)

export const updateCatalogEntry = async (id: string, data: CatalogEntryInput, imageFile?: File | null, removeImage?: boolean) => {
  const formData = new FormData()
  formData.append('metadata', JSON.stringify(data))
  if (imageFile) {
    formData.append('file', imageFile)
  }
  if (removeImage) {
    formData.append('removeImage', 'true')
  }
  const res = await fetch(`${API_BASE}/api/catalog/entries/${id}`, {
    method: 'PUT',
    credentials: 'include',
    body: formData
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let message = text
    try {
      const json = JSON.parse(text)
      message = json.error || json.message || text
    } catch {
      // Not JSON, use text as-is
    }
    throw new Error(message || `HTTP ${res.status}`)
  }
  const json = await res.json()
  return json as CatalogRecord
}

export const createCatalogEntry = async (data: CatalogEntryInput, imageFile?: File | null) => {
  if (imageFile) {
    // Use multipart/form-data when image is present
    const formData = new FormData()
    formData.append('metadata', JSON.stringify(data))
    formData.append('file', imageFile)
    const res = await fetch(`${API_BASE}/api/catalog/admin/import`, {
      method: 'POST',
      credentials: 'include',
      body: formData
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      let message = text
      try {
        const json = JSON.parse(text)
        message = json.error || json.message || text
      } catch {
        // Not JSON, use text as-is
      }
      throw new Error(message || `HTTP ${res.status}`)
    }
    const json = await res.json()
    return json as { upserted: number; entry?: CatalogRecord }
  } else {
    // Use JSON when no image
    return request<{ upserted: number }>('/api/catalog/admin/import', {
      method: 'POST',
      body: JSON.stringify([data])
    })
  }
}

export const deleteCatalogEntry = (id: string) => request<void>(`/api/catalog/entries/${id}`, { method: 'DELETE' })

export const getExerciseStats = (id: string, limit?: number, offset?: number) => {
  const params = new URLSearchParams()
  if (limit !== undefined) params.append('limit', limit.toString())
  if (offset !== undefined) params.append('offset', offset.toString())
  const query = params.toString()
  return request<ExerciseStats>(`/api/catalog/entries/${id}/stats${query ? `?${query}` : ''}`)
}
