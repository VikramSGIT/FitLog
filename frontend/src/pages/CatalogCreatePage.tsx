import React, { useEffect, useMemo, useState } from 'react'
import {
  Autocomplete,
  Box,
  Button,
  Container,
  Group,
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
import { IconArrowLeft, IconCirclePlus, IconDeviceFloppy } from '@tabler/icons-react'
import { useNavigate, useParams } from 'react-router-dom'
import { notifications } from '@mantine/notifications'
import HeaderBar from '@/components/HeaderBar'
import { DEFAULT_SURFACES, ThemeSurfaces } from '@/theme'
import { api, CatalogEntryInput } from '@/api/client'
import { useWorkoutStore } from '@/store/useWorkoutStore'

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
  baseWeightKg: ''
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
  const [loadingFacets, setLoadingFacets] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrorMap>({})
  const [loadingEntry, setLoadingEntry] = useState(false)

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
            record.baseWeightKg !== null && record.baseWeightKg !== undefined ? record.baseWeightKg.toString() : ''
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
        const updated = await api.updateCatalogEntry(catalogId, payload)
        setFieldErrors({})
        notifications.show({
          title: 'Catalog exercise updated',
          message: `${updated.name} was updated in the shared catalog.`,
          color: 'teal',
          icon: <IconDeviceFloppy size={16} />
        })
        navigate('/catalog')
      } else {
        const result = await api.createCatalogEntry(payload)
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

  const disableControls = loadingEntry || submitting
  const pageTitle = isEditMode ? 'Edit catalog exercise' : 'Add catalog exercise'
  const pageSubtitle = isEditMode
    ? 'Update the details below and save to keep the catalog in sync.'
    : 'Use the form below to add a new exercise to the shared catalog. All classification fields are required so the entry can be discovered by filters.'
  const submitLabel = isEditMode ? 'Update exercise' : 'Save exercise'

  return (
    <Box
      style={{
        minHeight: '100vh',
        background: surfaces.app,
        color: baseTextColor,
        paddingBottom: '4rem'
      }}
    >
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
              <Group gap="sm">
                <IconCirclePlus size={20} color="var(--mantine-color-primary-4)" />
                <Title order={2}>{pageTitle}</Title>
              </Group>
              <Text size="sm" style={{ color: mutedTextColor }}>
                {pageSubtitle}
              </Text>
            </Stack>

            <Stack gap="md">
              <TextInput
                label="Exercise name"
                placeholder="e.g., Barbell Romanian Deadlift"
                description="Required"
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
                minRows={3}
                autosize
                radius="md"
                size="md"
                value={form.description}
                disabled={disableControls}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.currentTarget.value }))}
              />

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
                description="Required — choose one or more primary muscles"
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
                description="Optional — helps with catalog searches"
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
                description="Optional — add demo videos or articles (press Enter after each URL)"
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

            <Group justify="flex-end" mt="md">
              <Button
                type="submit"
                radius="md"
                leftSection={<IconDeviceFloppy size={16} />}
                loading={submitting}
                disabled={disableControls}
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
    </Box>
  )
}


