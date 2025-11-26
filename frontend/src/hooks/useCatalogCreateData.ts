import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { notifications } from '@mantine/notifications'
import { api, CatalogEntryInput } from '@/api/client'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import { IconDeviceFloppy } from '@tabler/icons-react'
import React from 'react'

export type FacetsState = {
  types: string[]
  bodyParts: string[]
  equipment: string[]
  levels: string[]
  muscles: string[]
}

export const EMPTY_FACETS: FacetsState = { types: [], bodyParts: [], equipment: [], levels: [], muscles: [] }

export type FormState = {
  name: string
  description: string
  type: string
  bodyPart: string
  equipment: string
  level: string
  primaryMuscles: string[]
  secondaryMuscles: string[]
  links: string[]
  multiplier: string
  baseWeightKg: string
  imageFile: File | null
  hasImage: boolean
}

export const INITIAL_FORM: FormState = {
  name: '',
  description: '',
  type: '',
  bodyPart: '',
  equipment: '',
  level: '',
  primaryMuscles: [],
  secondaryMuscles: [],
  links: [],
  multiplier: '',
  baseWeightKg: '',
  imageFile: null,
  hasImage: false
}

export type FieldErrorMap = Partial<Record<'type' | 'bodyPart' | 'equipment' | 'level' | 'primaryMuscles', string | null>>

function toOptionalString(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function normalizeList(values: string[]): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    )
  )
}

function includeOption(list: string[], value: string): string[] {
  const trimmed = value.trim()
  if (!trimmed) {
    return list
  }
  if (list.includes(trimmed)) {
    return list
  }
  return [...list, trimmed].sort((a, b) => a.localeCompare(b))
}

export function useCatalogCreateData() {
  const navigate = useNavigate()
  const { catalogId } = useParams<{ catalogId?: string }>()
  const isEditMode = Boolean(catalogId)

  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [facets, setFacets] = useState<FacetsState>(EMPTY_FACETS)
  const imageUrl = useMemo(() => {
    if (!catalogId) return null
    return `${import.meta.env.VITE_API_BASE_URL || ''}/api/catalog/entries/${catalogId}/image`
  }, [catalogId])
  const hasImage = useMemo(() => {
    return Boolean(form.imageFile || (form.hasImage && catalogId && imageUrl))
  }, [form.imageFile, form.hasImage, catalogId, imageUrl])

  const [loadingFacets, setLoadingFacets] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrorMap>({})
  const [loadingEntry, setLoadingEntry] = useState(false)
  const [imageHovered, setImageHovered] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let mounted = true
    setLoadingFacets(true)
    api
      .getCatalogFacets()
      .then((result) => {
        if (!mounted) return
        setFacets({
          types: result.types ?? [],
          bodyParts: result.bodyParts ?? [],
          equipment: result.equipment ?? [],
          levels: result.levels ?? [],
          muscles: result.muscles ?? []
        })
      })
      .catch((err) => {
        notifications.show({
          title: 'Could not load catalog metadata',
          message: 'You can still fill in the form manually.',
          color: 'yellow'
        })
      })
      .finally(() => {
        if (mounted) setLoadingFacets(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!catalogId) {
      setForm(INITIAL_FORM)
      setFieldErrors({})
      return
    }
    let cancelled = false
    setLoadingEntry(true)
    api
      .getCatalogEntry(catalogId)
      .then((record) => {
        if (cancelled) return
        const primaryMuscles = Array.isArray(record.primaryMuscles) ? record.primaryMuscles : []
        const secondaryMuscles = Array.isArray(record.secondaryMuscles) ? record.secondaryMuscles : []
        const links = Array.isArray(record.links) ? record.links : []
        setForm({
          name: record.name ?? '',
          description: record.description ?? '',
          type: record.type ?? '',
          bodyPart: record.bodyPart ?? '',
          equipment: record.equipment ?? '',
          level: record.level ?? '',
          primaryMuscles,
          secondaryMuscles,
          links,
          multiplier:
            record.multiplier !== null && record.multiplier !== undefined ? record.multiplier.toString() : '',
          baseWeightKg:
            record.baseWeightKg !== null && record.baseWeightKg !== undefined ? record.baseWeightKg.toString() : '',
          imageFile: null,
          hasImage: Boolean(record.hasImage)
        })
        setFieldErrors({})
        setFacets((prev) => {
          let musclesList = prev.muscles.slice()
          primaryMuscles.forEach((muscle) => {
            musclesList = includeOption(musclesList, muscle)
          })
          secondaryMuscles.forEach((muscle) => {
            musclesList = includeOption(musclesList, muscle)
          })
          return {
            types: includeOption(prev.types, record.type ?? ''),
            bodyParts: includeOption(prev.bodyParts, record.bodyPart ?? ''),
            equipment: includeOption(prev.equipment, record.equipment ?? ''),
            levels: includeOption(prev.levels, record.level ?? ''),
            muscles: musclesList
          }
        })
      })
      .catch((err) => {
        if (cancelled) return
        
        notifications.show({
          title: 'Could not load catalog exercise',
          message: 'Please try opening the catalog entry again.',
          color: 'red'
        })
        navigate('/catalog')
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingEntry(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [catalogId, navigate])

  const updateField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (fieldErrors[field as keyof FieldErrorMap]) {
      setFieldErrors((prev) => ({ ...prev, [field as keyof FieldErrorMap]: null }))
    }
  }

  const validateSelect = (value: string, options: string[], label: string) => {
    const trimmed = value.trim()
    if (!trimmed) {
      return `Select a ${label.toLowerCase()} from the list.`
    }
    if (options.length > 0 && !options.includes(trimmed)) {
      return `${label} must be chosen from the provided list.`
    }
    return null
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = form.name.trim()
    if (!trimmedName) {
      notifications.show({
        title: 'Name is required',
        message: 'Please provide a name for the exercise.',
        color: 'red'
      })
      return
    }
    const selectChecks: Array<{ key: keyof FieldErrorMap; label: string; value: string; options: string[] }> = [
      { key: 'type', label: 'Type', value: form.type, options: facets.types },
      { key: 'bodyPart', label: 'Body part', value: form.bodyPart, options: facets.bodyParts },
      { key: 'equipment', label: 'Equipment', value: form.equipment, options: facets.equipment },
      { key: 'level', label: 'Level', value: form.level, options: facets.levels }
    ]

    const newErrors: FieldErrorMap = {}
    let hasErrors = false
    selectChecks.forEach(({ key, label, value, options }) => {
      const message = validateSelect(value, options, label)
      if (message) {
        newErrors[key] = message
        hasErrors = true
      }
    })
    const normalizedPrimary = normalizeList(form.primaryMuscles)
    if (normalizedPrimary.length === 0) {
      newErrors.primaryMuscles = 'Add at least one primary muscle.'
      hasErrors = true
    } else if (facets.muscles.length > 0) {
      const missingPrimary = normalizedPrimary.filter((muscle) => !facets.muscles.includes(muscle))
      if (missingPrimary.length > 0) {
        newErrors.primaryMuscles = 'Primary muscles must be chosen from the provided list.'
        hasErrors = true
      }
    }
    if (hasErrors) {
      setFieldErrors(newErrors)
      notifications.show({
        title: 'Choose from the list',
        message: 'Please select the classification fields from the provided dropdown options.',
        color: 'red'
      })
      return
    }

    const trimmedType = form.type.trim()
    const trimmedBodyPart = form.bodyPart.trim()
    const trimmedEquipment = form.equipment.trim()
    const trimmedLevel = form.level.trim()
    const payload: CatalogEntryInput = {
      name: trimmedName,
      description: toOptionalString(form.description),
      type: trimmedType,
      bodyPart: trimmedBodyPart,
      equipment: trimmedEquipment,
      level: trimmedLevel,
      primaryMuscles: normalizedPrimary,
      secondaryMuscles: normalizeList(form.secondaryMuscles),
      links: normalizeList(form.links),
      multiplier: form.multiplier.trim() ? Number(form.multiplier) : undefined,
      baseWeightKg: form.baseWeightKg.trim() ? Number(form.baseWeightKg) : undefined
    }

    setSubmitting(true)
    try {
      if (isEditMode && catalogId) {
        const removeImage = !form.hasImage && !form.imageFile
        const updated = await api.updateCatalogEntry(catalogId, payload, form.imageFile, removeImage)

        setFieldErrors({})
        notifications.show({
          title: 'Catalog exercise updated',
          message: `${updated.name} was updated in the shared catalog.`,
          color: 'teal'
        })
        navigate('/catalog')
      } else {
        const result = await api.createCatalogEntry(payload, form.imageFile)
        const upserted = typeof result?.upserted === 'number' ? result.upserted : 0
        notifications.show({
          title: upserted > 0 ? 'Catalog exercise created' : 'Catalog exercise not saved',
          message:
            upserted > 0
              ? `${trimmedName} was added to the shared catalog.`
              : 'No changes were made to the catalog.',
          color: upserted > 0 ? 'teal' : 'yellow'
        })
        if (upserted > 0) {
          setForm(INITIAL_FORM)
          setFieldErrors({})
          navigate('/catalog')
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Something went wrong while saving the entry.'
      notifications.show({
        title: isEditMode ? 'Could not update catalog exercise' : 'Could not create catalog exercise',
        message,
        color: 'red'
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!catalogId || !isEditMode) return
    setDeleting(true)
    try {
      await api.deleteCatalogEntry(catalogId)
      notifications.show({
        title: 'Catalog exercise deleted',
        message: `${form.name} was removed from the catalog.`,
        color: 'teal'
      })
      navigate('/catalog')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Something went wrong while deleting the entry.'
      notifications.show({
        title: 'Could not delete catalog exercise',
        message,
        color: 'red'
      })
    } finally {
      setDeleting(false)
      setDeleteModalOpen(false)
    }
  }

  return {
    form,
    setForm,
    facets,
    hasImage,
    imageUrl,
    loadingFacets,
    submitting,
    fieldErrors,
    setFieldErrors,
    loadingEntry,
    imageHovered,
    setImageHovered,
    deleteModalOpen,
    setDeleteModalOpen,
    deleting,
    fileInputRef,
    updateField,
    handleSubmit,
    handleDelete,
    isEditMode,
    navigate
  }
}
