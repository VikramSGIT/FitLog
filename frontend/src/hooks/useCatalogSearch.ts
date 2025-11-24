import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getCatalogFacets, searchCatalog, CatalogItem } from '@/api'

export function useCatalogSearch(embedded: boolean) {
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
  const [facets, setFacets] = useState<{ types: string[]; bodyParts: string[]; equipment: string[]; levels: string[]; muscles: string[] }>({
    types: [],
    bodyParts: [],
    equipment: [],
    levels: [],
    muscles: []
  })

  useEffect(() => {
    getCatalogFacets()
      .then((res) => {
        setFacets({
          types: Array.isArray((res as any).types) ? (res as any).types : [],
          bodyParts: Array.isArray((res as any).bodyParts) ? (res as any).bodyParts : [],
          equipment: Array.isArray((res as any).equipment) ? (res as any).equipment : [],
          levels: Array.isArray((res as any).levels) ? (res as any).levels : [],
          muscles: Array.isArray((res as any).muscles) ? (res as any).muscles : []
        })
      })
      .catch(() => setFacets({ types: [], bodyParts: [], equipment: [], levels: [], muscles: [] }))
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
      searchCatalog({ q, type, bodyPart, equipment, level, muscle, page, pageSize, sort: 'name_asc' })
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

  return {
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
    facets,
  }
}
