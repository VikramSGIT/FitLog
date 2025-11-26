import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, CatalogItem } from '@/api/client'
import { useWorkoutStore } from '@/store/useWorkoutStore'

type Facets = {
  types: string[]
  bodyParts: string[]
  equipment: string[]
  levels: string[]
  muscles: string[]
}

const EMPTY_FACETS: Facets = {
  types: [],
  bodyParts: [],
  equipment: [],
  levels: [],
  muscles: []
}

export function useCatalogData(embedded: boolean, onClose?: () => void) {
  const day = useWorkoutStore((s) => s.day)
  const addExercise = useWorkoutStore((s) => s.addExercise)
  const dayLoading = useWorkoutStore((s) => s.dayLoading)
  const isRestDay = day?.isRestDay ?? false

  const [facets, setFacets] = useState<Facets>(EMPTY_FACETS)
  const [searchParams, setSearchParams] = useSearchParams()

  const getInitial = (key: string, fallback = '') =>
    embedded ? fallback : (searchParams.get(key) || fallback)
  const getInitialNumber = (key: string, fallback: number) => {
    if (embedded) return fallback
    const str = searchParams.get(key)
    const num = str ? Number(str) : NaN
    return Number.isNaN(num) || num <= 0 ? fallback : num
  }

  const [q, setQ] = useState(getInitial('q'))
  const [type, setType] = useState(getInitial('type'))
  const [bodyPart, setBodyPart] = useState(getInitial('bodyPart'))
  const [equipment, setEquipment] = useState(getInitial('equipment'))
  const [level, setLevel] = useState(getInitial('level'))
  const [muscle, setMuscle] = useState(getInitial('muscle'))
  const [page, setPage] = useState(getInitialNumber('page', 1))
  const [pageSize] = useState(getInitialNumber('pageSize', embedded ? 10 : 20))
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<CatalogItem[]>([])
  const [total, setTotal] = useState(0)
  const [showFilters, setShowFilters] = useState(false)
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set())

  useEffect(() => {
    api.getCatalogFacets()
      .then((res) => {
        setFacets({
          types: Array.isArray((res as any).types) ? (res as any).types : [],
          bodyParts: Array.isArray((res as any).bodyParts) ? (res as any).bodyParts : [],
          equipment: Array.isArray((res as any).equipment) ? (res as any).equipment : [],
          levels: Array.isArray((res as any).levels) ? (res as any).levels : [],
          muscles: Array.isArray((res as any).muscles) ? (res as any).muscles : []
        })
      })
      .catch(() => setFacets(EMPTY_FACETS))
  }, [])

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true)
      const next = new URLSearchParams()
      if (q) next.set('q', q)
      if (type) next.set('type', type)
      if (bodyPart) next.set('bodyPart', bodyPart)
      if (equipment) next.set('equipment', equipment)
      if (level) next.set('level', level)
      if (muscle) next.set('muscle', muscle)
      next.set('page', String(page))
      next.set('pageSize', String(pageSize))
      if (!embedded) {
        setSearchParams(next)
      }
      api
        .searchCatalog({ q, type, bodyPart, equipment, level, muscle, page, pageSize, sort: 'name_asc' })
        .then((res) => {
          const safeItems = Array.isArray((res as any).items) ? (res as any).items : []
          setItems(safeItems as CatalogItem[])
          setTotal(typeof (res as any).total === 'number' ? (res as any).total : 0)
        })
        .catch(() => {
          setItems([])
          setTotal(0)
        })
        .finally(() => setLoading(false))
    }, 400)
    return () => clearTimeout(t)
  }, [q, type, bodyPart, equipment, level, muscle, page, pageSize, setSearchParams, embedded])

  const canAddToDay = !!day && !dayLoading && !isRestDay
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  async function addToDay(item: CatalogItem) {
    if (!day) {
      alert('Pick a day first on the home page.')
      return
    }
    if (dayLoading) {
      alert('Please wait for the day to finish loading before adding exercises.')
      return
    }
    if (day.isRestDay) {
      alert('This day is marked as a rest day. Switch back to a training day to add exercises.')
      return
    }
    const exercises = Array.isArray(day.exercises) ? day.exercises : []
    const position = (exercises[exercises.length - 1]?.position ?? 0) + 1
    addExercise(item.id, item.name, position)
    if (embedded) {
      onClose?.()
    }
  }

  return {
    facets,
    q, setQ,
    type, setType,
    bodyPart, setBodyPart,
    equipment, setEquipment,
    level, setLevel,
    muscle, setMuscle,
    page, setPage,
    pageSize,
    loading,
    items,
    total,
    showFilters, setShowFilters,
    imageErrors, setImageErrors,
    canAddToDay,
    totalPages,
    addToDay,
    isRestDay,
    dayLoading
  }
}
