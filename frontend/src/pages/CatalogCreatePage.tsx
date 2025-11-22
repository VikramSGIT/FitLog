import React, { useEffect, useMemo, useState } from 'react'
import {
  ActionIcon,
  Autocomplete,
  Box,
  Button,
  Container,
  Group,
  Modal,
  NumberInput,
  Paper,
  Stack,
  TagsInput,
  Text,
  Textarea,
  TextInput,
  Title,
  useMantineTheme
} from '@mantine/core'
import { IconArrowLeft, IconCirclePlus, IconDeviceFloppy, IconPhoto, IconTrash, IconX } from '@tabler/icons-react'
import { useNavigate, useParams } from 'react-router-dom'
import { notifications } from '@mantine/notifications'
import HeaderBar from '@/components/HeaderBar'
import { DEFAULT_SURFACES, ThemeSurfaces } from '@/theme'
import { api, CatalogEntryInput } from '@/api/client'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import { useMediaQuery } from '@mantine/hooks'

type FacetsState = {
  types: string[]
  bodyParts: string[]
  equipment: string[]
  levels: string[]
  muscles: string[]
}

const EMPTY_FACETS: FacetsState = { types: [], bodyParts: [], equipment: [], levels: [], muscles: [] }

type FormState = {
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

const INITIAL_FORM: FormState = {
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

type FieldErrorMap = Partial<Record<'type' | 'bodyPart' | 'equipment' | 'level' | 'primaryMuscles', string | null>>

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

export default function CatalogCreatePage() {
  const theme = useMantineTheme()
  const navigate = useNavigate()
  const { catalogId } = useParams<{ catalogId?: string }>()
  const isEditMode = Boolean(catalogId)
  const isMobile = useMediaQuery('(max-width: 640px)')
  const surfaces = useMemo<ThemeSurfaces>(
    () => (theme.other?.surfaces as ThemeSurfaces) ?? DEFAULT_SURFACES,
    [theme]
  )
  const baseTextColor = (theme.other?.textColor as string) ?? (theme.colorScheme === 'light' ? '#0f172a' : '#f8fafc')
  const mutedTextColor =
    (theme.other?.mutedText as string) ??
    (theme.colorScheme === 'light' ? 'rgba(15, 23, 42, 0.65)' : 'rgba(226, 232, 240, 0.72)')
  const accentGradient = (theme.other?.accentGradient as string) ?? 'linear-gradient(135deg, #8f5afc 0%, #5197ff 100%)'

  const flush = useWorkoutStore((s) => s.flush)
  const saving = useWorkoutStore((s) => s.saving)
  const lastSaveMode = useWorkoutStore((s) => s.lastSaveMode)
  const lastSavedAt = useWorkoutStore((s) => s.lastSavedAt)

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
  const fileInputRef = React.useRef<HTMLInputElement>(null)

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
        console.error('Failed to load catalog facets', err)
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
        console.error('Failed to load catalog entry', err)
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
          color: 'teal',
          icon: <IconDeviceFloppy size={16} />
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
          color: upserted > 0 ? 'teal' : 'yellow',
          icon: <IconDeviceFloppy size={16} />
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

  const disableControls = loadingEntry || submitting || deleting
  const pageTitle = isEditMode ? 'Edit catalog exercise' : 'Add catalog exercise'
  const pageSubtitle = isEditMode
    ? 'Update the details below and save to keep the catalog in sync.'
    : 'Use the form below to add a new exercise to the shared catalog. All classification fields are required so the entry can be discovered by filters.'
  const submitLabel = isEditMode ? 'Update exercise' : 'Save exercise'

  return (
    <Box
      style={{
        minHeight: '100vh',
        height: isMobile ? '100vh' : undefined,
        background: isMobile ? surfaces.panel : surfaces.app,
        color: baseTextColor,
        paddingBottom: isMobile ? 0 : '4rem',
        display: isMobile ? 'flex' : undefined,
        flexDirection: isMobile ? 'column' : undefined,
        overflow: isMobile ? 'hidden' : undefined
      }}
    >
      {!isMobile && (
      <HeaderBar
        onBrowseCatalog={() => navigate('/catalog')}
        onSave={() => flush('manual')}
        saving={saving as any}
        saveMode={lastSaveMode}
        lastSavedAt={lastSavedAt}
        onLogout={async () => {
          try {
            await api.logout()
          } catch {}
          navigate('/')
        }}
        userLabel="Account"
      />
      )}

      {isMobile ? (
        <Paper
          component="form"
          onSubmit={handleSubmit}
          radius={0}
          withBorder={false}
          p="md"
          style={{
            background: surfaces.panel,
            borderColor: surfaces.border,
            color: baseTextColor,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          <Stack gap="md" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <Group justify="space-between" align="center" wrap="nowrap">
              <ActionIcon
                variant="outline"
                color={theme.primaryColor}
                radius="md"
                size="lg"
              onClick={() => navigate('/catalog')}
                aria-label="Back"
              >
                <IconArrowLeft size={18} />
              </ActionIcon>
              <Title order={3} style={{ margin: 0, flex: 1, textAlign: 'center' }}>
                {pageTitle}
              </Title>
              {isEditMode ? (
                <ActionIcon
                  variant="outline"
                  color="red"
                  radius="md"
                  size="lg"
                  onClick={() => setDeleteModalOpen(true)}
                  disabled={disableControls}
                  aria-label="Delete exercise"
                >
                  <IconTrash size={18} />
                </ActionIcon>
              ) : (
                <div style={{ width: 40 }} />
              )}
              </Group>
            <Stack gap="md" style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              <Group align="flex-start" gap="md" wrap={isMobile ? 'wrap' : 'nowrap'}>
                <Stack gap={8} style={{ flexShrink: 0 }}>
                  <div
                    style={{
                      width: 160,
                      height: 160,
                      borderRadius: 12,
                      overflow: 'hidden',
                      border: `1px solid ${surfaces.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: hasImage ? '#ffffff' : surfaces.panel,
                      position: 'relative'
                    }}
                    onMouseEnter={() => !isMobile && setImageHovered(true)}
                    onMouseLeave={() => !isMobile && setImageHovered(false)}
                  >
                    {form.imageFile ? (
                      <img
                        src={URL.createObjectURL(form.imageFile)}
                        alt="Preview"
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                      />
                    ) : form.hasImage && catalogId && imageUrl ? (
                      <img
                        src={`${imageUrl}?_=${Date.now()}`}
                        alt="Existing exercise image"
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                      />
                    ) : (
                      <Text size="sm" c="dimmed">
                        No image
              </Text>
                    )}
                    {(imageHovered || isMobile) && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'rgba(0, 0, 0, 0.5)',
                          borderRadius: 12,
                          gap: 8
                        }}
                      >
                        {hasImage ? (
                          <ActionIcon
                            size="lg"
                            radius="md"
                            variant="filled"
                            color="red"
                            onClick={() => {
                              if (form.imageFile) {
                                setForm((prev) => ({ ...prev, imageFile: null }))
                              } else if (form.hasImage && catalogId) {
                                setForm((prev) => ({ ...prev, hasImage: false }))
                              }
                            }}
                            disabled={disableControls}
                            style={{ zIndex: 1 }}
                          >
                            <IconX size={20} />
                          </ActionIcon>
                        ) : (
                          <ActionIcon
                            size="lg"
                            radius="md"
                            variant="filled"
                            color={theme.primaryColor}
                            onClick={() => fileInputRef.current?.click()}
                            disabled={disableControls}
                            style={{ zIndex: 1 }}
                          >
                            <IconPhoto size={20} />
                          </ActionIcon>
                        )}
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/apng"
                    disabled={disableControls || hasImage}
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0] || null
                      setForm((prev) => ({ ...prev, imageFile: file }))
                    }}
                    style={{ display: 'none' }}
                  />
            </Stack>
                <Stack gap="md" style={{ flex: 1, justifyContent: 'flex-start' }}>
              <TextInput
                label="Exercise name"
                placeholder="e.g., Barbell Romanian Deadlift"
                required
                radius="md"
                size="md"
                value={form.name}
                disabled={disableControls}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.currentTarget.value }))}
              />
              <Textarea
                label="Description"
                placeholder="Short instructions, cues, or variations"
                minRows={1}
                maxRows={3}
                autosize
                radius="md"
                size="md"
                value={form.description}
                disabled={disableControls}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.currentTarget.value }))}
                styles={{
                  input: {
                    overflow: 'auto'
                  }
                }}
              />
                </Stack>
              </Group>

              <Group grow align="start">
                <Autocomplete
                  label="Exercise type"
                  placeholder="e.g., Strength"
                  data={facets.types}
                  radius="md"
                  size="md"
                  value={form.type}
                  onChange={(value) => updateField('type', value)}
                  disabled={disableControls || (loadingFacets && facets.types.length === 0)}
                  required
                  error={fieldErrors.type}
                />
                <Autocomplete
                  label="Body part"
                  placeholder="e.g., Posterior chain"
                  data={facets.bodyParts}
                  radius="md"
                  size="md"
                  value={form.bodyPart}
                  onChange={(value) => updateField('bodyPart', value)}
                  disabled={disableControls || (loadingFacets && facets.bodyParts.length === 0)}
                  required
                  error={fieldErrors.bodyPart}
                />
              </Group>

              <Group grow align="start">
                <Autocomplete
                  label="Equipment"
                  placeholder="e.g., Barbell"
                  data={facets.equipment}
                  radius="md"
                  size="md"
                  value={form.equipment}
                  onChange={(value) => updateField('equipment', value)}
                  disabled={disableControls || (loadingFacets && facets.equipment.length === 0)}
                  required
                  error={fieldErrors.equipment}
                />
                <Autocomplete
                  label="Level"
                  placeholder="e.g., Intermediate"
                  data={facets.levels}
                  radius="md"
                  size="md"
                  value={form.level}
                  onChange={(value) => updateField('level', value)}
                  disabled={disableControls || (loadingFacets && facets.levels.length === 0)}
                  required
                  error={fieldErrors.level}
                />
              </Group>

              <TagsInput
                label="Primary muscles"
                placeholder="Type a muscle and press Enter"
                description="Choose one or more primary muscles"
                radius="md"
                size="md"
                value={form.primaryMuscles}
                data={facets.muscles}
                disabled={disableControls}
                required
                error={fieldErrors.primaryMuscles}
                onChange={(value) => updateField('primaryMuscles', value)}
              />

              <TagsInput
                label="Secondary muscles"
                placeholder="Type a muscle and press Enter"
                radius="md"
                size="md"
                value={form.secondaryMuscles}
                data={facets.muscles}
                disabled={disableControls}
                onChange={(value) => setForm((prev) => ({ ...prev, secondaryMuscles: value }))}
              />

              <TagsInput
                label="Reference links"
                placeholder="https://example.com/demo"
                radius="md"
                size="md"
                value={form.links}
                disabled={disableControls}
                onChange={(value) => setForm((prev) => ({ ...prev, links: value }))}
              />

              <Group grow align="start">
                <NumberInput
                  label="Multiplier"
                  placeholder="Defaults to 1.0"
                  radius="md"
                  size="md"
                  min={0}
                  step={0.05}
                  value={form.multiplier}
                  disabled={disableControls}
                  onChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      multiplier: value === null ? '' : typeof value === 'number' ? value.toString() : value
                    }))
                  }
                />
                <NumberInput
                  label="Base weight (kg)"
                  placeholder="Defaults to 0"
                  radius="md"
                  size="md"
                  min={0}
                  step={0.5}
                  value={form.baseWeightKg}
                  disabled={disableControls}
                  onChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      baseWeightKg: value === null ? '' : typeof value === 'number' ? value.toString() : value
                    }))
                  }
                />
              </Group>

              <Group justify="space-between" mt="md" style={{ flexShrink: 0 }}>
                {isEditMode && (
                  <Button
                    variant="outline"
                    color="red"
                    radius="md"
                    leftSection={<IconTrash size={16} />}
                    onClick={() => setDeleteModalOpen(true)}
                    disabled={disableControls}
                  >
                    Delete
                  </Button>
                )}
                <Button
                  type="submit"
                  radius="md"
                  leftSection={<IconDeviceFloppy size={16} />}
                  loading={submitting}
                  disabled={disableControls}
                  style={{ marginLeft: 'auto' }}
                  styles={{
                    root: {
                      backgroundImage: accentGradient,
                      border: 'none',
                      color: theme.colorScheme === 'light' ? '#0f172a' : '#f8fafc'
                    }
                  }}
                >
                  {submitLabel}
                </Button>
              </Group>
            </Stack>
          </Stack>
        </Paper>
      ) : (
        <Container size="lg" py="xl">
          <Paper
            component="form"
            onSubmit={handleSubmit}
            radius="lg"
            withBorder
            p="xl"
            style={{
              background: surfaces.panel,
              borderColor: surfaces.border,
              color: baseTextColor
            }}
          >
            <Stack gap="lg">
              <Button
                variant="subtle"
                leftSection={<IconArrowLeft size={16} />}
                onClick={() => navigate('/catalog')}
                style={{ alignSelf: 'flex-start' }}
              >
                Back to catalog
              </Button>
              <Stack gap={4}>
                <Title order={2}>{pageTitle}</Title>
                <Text size="sm" style={{ color: mutedTextColor }}>
                  {pageSubtitle}
                </Text>
              </Stack>

              <Stack gap="md">
                <Group align="flex-start" gap="md" wrap="nowrap">
                  <Stack gap={8} style={{ flexShrink: 0 }}>
                    <div
                      style={{
                        width: 160,
                        height: 160,
                        borderRadius: 12,
                        overflow: 'hidden',
                        border: `1px solid ${surfaces.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: hasImage ? '#ffffff' : surfaces.panel,
                        position: 'relative'
                      }}
                      onMouseEnter={() => setImageHovered(true)}
                      onMouseLeave={() => setImageHovered(false)}
                    >
                    {form.imageFile ? (
                      <img
                        src={URL.createObjectURL(form.imageFile)}
                        alt="Preview"
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                      />
                    ) : form.hasImage && catalogId && imageUrl ? (
                      <img
                        src={`${imageUrl}?_=${Date.now()}`}
                        alt="Existing exercise image"
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                      />
                    ) : (
                      <Text size="sm" c="dimmed">
                          No image
                      </Text>
                    )}
                      {imageHovered && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'rgba(0, 0, 0, 0.5)',
                            borderRadius: 12,
                            gap: 8
                          }}
                        >
                          {hasImage ? (
                            <ActionIcon
                              size="lg"
                              radius="md"
                              variant="filled"
                              color="red"
                              onClick={() => {
                                if (form.imageFile) {
                                  setForm((prev) => ({ ...prev, imageFile: null }))
                                } else if (form.hasImage && catalogId) {
                                  setForm((prev) => ({ ...prev, hasImage: false }))
                                }
                              }}
                              disabled={disableControls}
                              style={{ zIndex: 1 }}
                            >
                              <IconX size={20} />
                            </ActionIcon>
                          ) : (
                            <ActionIcon
                              size="lg"
                              radius="md"
                              variant="filled"
                              color={theme.primaryColor}
                              onClick={() => fileInputRef.current?.click()}
                              disabled={disableControls}
                              style={{ zIndex: 1 }}
                            >
                              <IconPhoto size={20} />
                            </ActionIcon>
                    )}
                  </div>
                      )}
                  </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/apng"
                      disabled={disableControls || hasImage}
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0] || null
                        setForm((prev) => ({ ...prev, imageFile: file }))
                      }}
                      style={{ display: 'none' }}
                    />
                  </Stack>
                  <Stack gap="md" style={{ flex: 1, justifyContent: 'flex-start' }}>
                    <TextInput
                      label="Exercise name"
                      placeholder="e.g., Barbell Romanian Deadlift"
                      required
                      radius="md"
                      size="md"
                      value={form.name}
                          disabled={disableControls}
                      onChange={(event) => setForm((prev) => ({ ...prev, name: event.currentTarget.value }))}
                    />
                    <Textarea
                      label="Description"
                      placeholder="Short instructions, cues, or variations"
                      minRows={1}
                      maxRows={3}
                      autosize
                      radius="md"
                      size="md"
                      value={form.description}
                      disabled={disableControls}
                      onChange={(event) => setForm((prev) => ({ ...prev, description: event.currentTarget.value }))}
                      styles={{
                        input: {
                          overflow: 'auto'
                        }
                      }}
                    />
                  </Stack>
                </Group>

                <Group grow align="start">
                  <Autocomplete
                    label="Exercise type"
                    placeholder="e.g., Strength"
                    data={facets.types}
                    radius="md"
                    size="md"
                    value={form.type}
                    onChange={(value) => updateField('type', value)}
                    disabled={disableControls || (loadingFacets && facets.types.length === 0)}
                    required
                    error={fieldErrors.type}
                  />
                  <Autocomplete
                    label="Body part"
                    placeholder="e.g., Posterior chain"
                    data={facets.bodyParts}
                    radius="md"
                    size="md"
                    value={form.bodyPart}
                    onChange={(value) => updateField('bodyPart', value)}
                    disabled={disableControls || (loadingFacets && facets.bodyParts.length === 0)}
                    required
                    error={fieldErrors.bodyPart}
                  />
                </Group>

                <Group grow align="start">
                  <Autocomplete
                    label="Equipment"
                    placeholder="e.g., Barbell"
                    data={facets.equipment}
                    radius="md"
                    size="md"
                    value={form.equipment}
                    onChange={(value) => updateField('equipment', value)}
                    disabled={disableControls || (loadingFacets && facets.equipment.length === 0)}
                    required
                    error={fieldErrors.equipment}
                  />
                  <Autocomplete
                    label="Level"
                    placeholder="e.g., Intermediate"
                    data={facets.levels}
                    radius="md"
                    size="md"
                    value={form.level}
                    onChange={(value) => updateField('level', value)}
                    disabled={disableControls || (loadingFacets && facets.levels.length === 0)}
                    required
                    error={fieldErrors.level}
                  />
                </Group>

                <TagsInput
                  label="Primary muscles"
                  placeholder="Type a muscle and press Enter"
                  description="Choose one or more primary muscles"
                  radius="md"
                  size="md"
                  value={form.primaryMuscles}
                  data={facets.muscles}
                  disabled={disableControls}
                  required
                  error={fieldErrors.primaryMuscles}
                  onChange={(value) => updateField('primaryMuscles', value)}
                />

                <TagsInput
                  label="Secondary muscles"
                  placeholder="Type a muscle and press Enter"
                  radius="md"
                  size="md"
                  value={form.secondaryMuscles}
                  data={facets.muscles}
                  disabled={disableControls}
                  onChange={(value) => setForm((prev) => ({ ...prev, secondaryMuscles: value }))}
                />

                <TagsInput
                  label="Reference links"
                  placeholder="https://example.com/demo"
                  radius="md"
                  size="md"
                  value={form.links}
                  disabled={disableControls}
                  onChange={(value) => setForm((prev) => ({ ...prev, links: value }))}
                />

                <Group grow align="start">
                  <NumberInput
                    label="Multiplier"
                    placeholder="Defaults to 1.0"
                    radius="md"
                    size="md"
                    min={0}
                    step={0.05}
                    value={form.multiplier}
                    disabled={disableControls}
                    onChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        multiplier: value === null ? '' : typeof value === 'number' ? value.toString() : value
                      }))
                    }
                  />
                  <NumberInput
                    label="Base weight (kg)"
                    placeholder="Defaults to 0"
                    radius="md"
                    size="md"
                    min={0}
                    step={0.5}
                    value={form.baseWeightKg}
                    disabled={disableControls}
                    onChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        baseWeightKg: value === null ? '' : typeof value === 'number' ? value.toString() : value
                      }))
                    }
                  />
                </Group>
            </Stack>

            <Group justify="space-between" mt="md">
              {isEditMode && (
                        <Button
                          variant="outline"
                  color="red"
                  radius="md"
                  leftSection={<IconTrash size={16} />}
                  onClick={() => setDeleteModalOpen(true)}
                          disabled={disableControls}
                        >
                  Delete exercise
                        </Button>
                      )}
              <Button
                type="submit"
                radius="md"
                leftSection={<IconDeviceFloppy size={16} />}
                loading={submitting}
                disabled={disableControls}
                style={{ marginLeft: 'auto' }}
                styles={{
                  root: {
                    backgroundImage: accentGradient,
                    border: 'none',
                    color: theme.colorScheme === 'light' ? '#0f172a' : '#f8fafc'
                  }
                }}
              >
                {submitLabel}
              </Button>
            </Group>
          </Stack>
        </Paper>
      </Container>
      )}

      <Modal
        opened={deleteModalOpen}
        onClose={() => !deleting && setDeleteModalOpen(false)}
        title="Delete catalog exercise"
        radius="md"
        centered
      >
        <Stack gap="md">
          <Text>
            Are you sure you want to delete <strong>{form.name}</strong> from the catalog? This action cannot be undone.
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button
              variant="subtle"
              onClick={() => setDeleteModalOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              color="red"
              onClick={handleDelete}
              loading={deleting}
              leftSection={<IconTrash size={16} />}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  )
}


