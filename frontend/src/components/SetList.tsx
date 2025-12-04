import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '@/api/client'
import { Exercise, Set, Rest } from '@/db/schema'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import { ActionIcon, Group, Paper, Stack, Text, TextInput, Tooltip, useMantineTheme } from '@mantine/core'
import { IconTrash } from '@/icons/tabler'
import { DEFAULT_SURFACES, ThemeSurfaces } from '@/theme'

const LOCAL_DB_COMMIT_DELAY_MS = 2000

const parseRepsInput = (value: string): number | null => {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const numeric = Number(trimmed)
  if (!Number.isFinite(numeric)) return null
  const rounded = Math.round(numeric)
  if (rounded <= 0) return null
  return rounded
}

const parseWeightInput = (value: string): number | null => {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const numeric = Number(trimmed)
  if (!Number.isFinite(numeric) || numeric < 0) return null
  return Math.round(numeric * 100) / 100
}

const parseDurationInput = (value: string): number | null => {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const numeric = Number(trimmed)
  if (!Number.isFinite(numeric) || numeric < 0) return null
  return Math.round(numeric)
}

function SetRow({
  set,
  multiplier,
  baseWeightKg
}: Readonly<{ set: Set; multiplier?: number | null; baseWeightKg?: number | null }>) {
  const { updateSet, deleteSet, isLoading: dayLoading } = useWorkoutStore()
  const [repsInput, setRepsInput] = useState<string>(() => String(set.reps))
  const [weightInput, setWeightInput] = useState<string>(() => String(set.weightKg))
  const repsInputRef = useRef(repsInput)
  const weightInputRef = useRef(weightInput)
  const pendingCommitTimeout = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null)
  const theme = useMantineTheme()
  const surfaces = (theme.other?.surfaces as ThemeSurfaces) ?? DEFAULT_SURFACES

  useEffect(() => {
    repsInputRef.current = repsInput
  }, [repsInput])

  useEffect(() => {
    weightInputRef.current = weightInput
  }, [weightInput])

  useEffect(() => {
    setRepsInput(String(set.reps))
  }, [set.reps])

  useEffect(() => {
    setWeightInput(String(set.weightKg))
  }, [set.weightKg])

  const parsedReps = useMemo(() => parseRepsInput(repsInput), [repsInput])
  const parsedWeight = useMemo(() => parseWeightInput(weightInput), [weightInput])

  const effectiveWeight = useMemo(() => {
    if (multiplier == null && baseWeightKg == null) {
      return null
    }
    const weightValue = weightInput.trim() === '' ? null : Number(weightInput)
    if (weightValue == null || Number.isNaN(weightValue)) {
      return null
    }
    const eff = (multiplier ?? 1) * weightValue + (baseWeightKg ?? 0)
    return Math.round(eff * 100) / 100
  }, [weightInput, multiplier, baseWeightKg])

  const flushPendingCommit = useCallback(() => {
    if (pendingCommitTimeout.current) {
      globalThis.clearTimeout(pendingCommitTimeout.current)
      pendingCommitTimeout.current = null
    }
  }, [])

  const commitSetChanges = useCallback(() => {
    const repsValue = parseRepsInput(repsInputRef.current)
    const weightValue = parseWeightInput(weightInputRef.current)

    const updates: Partial<Pick<Set, 'reps' | 'weightKg'>> = {}
    if (repsValue !== null && repsValue > 0 && repsValue !== set.reps) {
      updates.reps = repsValue
    }
    if (weightValue !== null && weightValue >= 0) {
      const roundedWeight = Math.round(weightValue * 100) / 100
      if (roundedWeight !== set.weightKg) {
        updates.weightKg = roundedWeight
      }
    }

    if (Object.keys(updates).length > 0) {
      updateSet(set.id, updates)
    }
  }, [set.id, set.reps, set.weightKg, updateSet])

  const scheduleDebouncedCommit = useCallback(() => {
    flushPendingCommit()
    pendingCommitTimeout.current = globalThis.setTimeout(() => {
      pendingCommitTimeout.current = null
      commitSetChanges()
    }, LOCAL_DB_COMMIT_DELAY_MS)
  }, [commitSetChanges, flushPendingCommit])

  useEffect(() => {
    return () => {
      flushPendingCommit()
      commitSetChanges()
    }
  }, [commitSetChanges, flushPendingCommit])

  const hasPendingChanges = useMemo(() => {
    const repsValue = parsedReps ?? null
    const weightValue = parsedWeight ?? null
    return repsValue !== set.reps || weightValue !== set.weightKg
  }, [parsedReps, parsedWeight, set.reps, set.weightKg])

  useEffect(() => {
    if (hasPendingChanges) {
      scheduleDebouncedCommit()
      return () => {
        flushPendingCommit()
      }
    }
    return () => {
      flushPendingCommit()
    }
  }, [hasPendingChanges, scheduleDebouncedCommit, flushPendingCommit])

  const handleBlur = useCallback(() => {
    flushPendingCommit()
    commitSetChanges()
  }, [commitSetChanges, flushPendingCommit])

  const onDelete = useCallback(async () => {
    if (dayLoading) return
    deleteSet(set.id)
  }, [dayLoading, deleteSet, set.id])

  return (
    <Paper withBorder radius="md" p={0} style={{ borderColor: surfaces.border, backdropFilter: 'none' }}>
      <Group justify="space-between" align="center" wrap="nowrap" gap="sm">
        <Group
          gap="sm"
          wrap="nowrap"
          style={{ flex: 1, minWidth: 0, padding: theme.spacing.sm }}
        >
          <Stack gap={4} w={110}>
            <TextInput
          type="number"
          value={repsInput}
          min={1}
          step={1}
          disabled={dayLoading}
              onChange={(e) => setRepsInput(e.currentTarget.value)}
              onBlur={handleBlur}
              size="sm"
              radius="md"
              variant="filled"
              placeholder="Reps"
        />
          </Stack>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
            <Text fw={700} size="sm">
              ×
            </Text>
      </div>
          <Group gap="xs" align="center" wrap="nowrap" w={180}>
            <TextInput
          type="number"
          value={weightInput}
          min={0}
          step="0.25"
          disabled={dayLoading}
              onChange={(e) => setWeightInput(e.currentTarget.value)}
              onBlur={handleBlur}
              size="sm"
              radius="md"
              variant="filled"
              placeholder="Weight (kg)"
              style={{ flex: 1 }}
            />
            {effectiveWeight !== null && (
              <Text size="sm" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                {effectiveWeight.toFixed(2)} kg
              </Text>
            )}
          </Group>
        </Group>
        <div style={{ paddingRight: theme.spacing.sm }}>
          <Tooltip label="Remove set" position="top" withArrow>
            <ActionIcon
              variant="light"
              color="red"
              radius="md"
              size="lg"
              onClick={onDelete}
              aria-label="Delete set"
              disabled={dayLoading}
            >
              <IconTrash size={18} />
            </ActionIcon>
          </Tooltip>
      </div>
      </Group>
    </Paper>
  )
}

function RestRow({ rest }: Readonly<{ rest: Rest }>) {
  const { updateRest, deleteRest, isLoading: dayLoading } = useWorkoutStore()
  const [durationInput, setDurationInput] = useState<string>(() => String(rest.durationSeconds))
  const durationInputRef = useRef(durationInput)
  const pendingCommitTimeout = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null)
  const theme = useMantineTheme()
  const surfaces = (theme.other?.surfaces as ThemeSurfaces) ?? DEFAULT_SURFACES

  useEffect(() => {
    durationInputRef.current = durationInput
  }, [durationInput])

  useEffect(() => {
    setDurationInput(String(rest.durationSeconds))
  }, [rest.durationSeconds])

  const parsedDuration = useMemo(() => parseDurationInput(durationInput), [durationInput])

  const flushPendingCommit = useCallback(() => {
    if (pendingCommitTimeout.current) {
      globalThis.clearTimeout(pendingCommitTimeout.current)
      pendingCommitTimeout.current = null
    }
  }, [])

  const commitRest = useCallback(() => {
    const durationValue = parseDurationInput(durationInputRef.current)
    if (durationValue === null) return
    if (durationValue !== rest.durationSeconds) {
      updateRest(rest.id, { durationSeconds: durationValue })
    }
  }, [rest.durationSeconds, rest.id, updateRest])

  useEffect(() => {
    return () => {
      flushPendingCommit()
      commitRest()
    }
  }, [commitRest, flushPendingCommit])

  const hasPendingChanges = useMemo(() => {
    const durationValue = parsedDuration ?? null
    return durationValue !== rest.durationSeconds
  }, [parsedDuration, rest.durationSeconds])

  const scheduleDebouncedCommit = useCallback(() => {
    flushPendingCommit()
    pendingCommitTimeout.current = globalThis.setTimeout(() => {
      pendingCommitTimeout.current = null
      commitRest()
    }, LOCAL_DB_COMMIT_DELAY_MS)
  }, [commitRest, flushPendingCommit])

  useEffect(() => {
    if (hasPendingChanges) {
      scheduleDebouncedCommit()
      return () => {
        flushPendingCommit()
      }
    }
    return () => {
      flushPendingCommit()
    }
  }, [hasPendingChanges, scheduleDebouncedCommit, flushPendingCommit])

  const handleBlur = useCallback(() => {
    flushPendingCommit()
    commitRest()
  }, [commitRest, flushPendingCommit])

  const onDelete = useCallback(async () => {
    if (dayLoading) return
    deleteRest(rest.id)
  }, [dayLoading, deleteRest, rest.id])

  return (
    <Paper withBorder radius="md" p={0} style={{ borderColor: surfaces.border, backdropFilter: 'none' }}>
      <Group justify="space-between" align="center" wrap="nowrap" gap="sm" px={theme.spacing.sm} py="xs">
        <Group gap="sm" align="center" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          <Text fw={600} size="sm">
            Rest
          </Text>
          <TextInput
            type="number"
            value={durationInput}
            min={0}
            step={5}
            disabled={dayLoading}
            onChange={(e) => setDurationInput(e.currentTarget.value)}
            onBlur={handleBlur}
            size="sm"
            radius="md"
            variant="filled"
            placeholder="Duration (s)"
            style={{ width: 140 }}
            rightSection={<Text size="xs">sec</Text>}
          />
        </Group>
        <Tooltip label="Remove rest" position="top" withArrow>
          <ActionIcon
            variant="light"
            color="red"
            radius="md"
            size="lg"
            onClick={onDelete}
            aria-label="Delete rest"
            disabled={dayLoading}
          >
            <IconTrash size={18} />
          </ActionIcon>
        </Tooltip>
      </Group>
    </Paper>
  )
}

export default function SetList({ exercise }: Readonly<{ exercise: Exercise }>) {
  const allSets = useWorkoutStore((s) => s.sets)
  const allRests = useWorkoutStore((s) => s.rests)
  const entries = useMemo(() => {
    const setEntries = allSets
      .filter((s) => s.exerciseId === exercise.id)
      .map((set) => ({ type: 'set' as const, position: set.position, set }))
    const restEntries = allRests
      .filter((r) => r.exerciseId === exercise.id)
      .map((rest) => ({ type: 'rest' as const, position: rest.position, rest }))
    return [...setEntries, ...restEntries].sort((a, b) => {
      if (a.position !== b.position) return a.position - b.position
      if (a.type === b.type) return 0
      return a.type === 'set' ? -1 : 1
    })
  }, [allSets, allRests, exercise.id])

  const [catalogScaling, setCatalogScaling] = useState<{ multiplier: number; baseWeightKg: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    if (exercise.catalogId) {
      api
        .getCatalogEntry(exercise.catalogId)
        .then((record) => {
          if (cancelled) return
          const multiplier = record.multiplier ?? 1
          const baseWeightKg = record.baseWeightKg ?? 0
          setCatalogScaling({ multiplier, baseWeightKg })
        })
        .catch(() => {
          if (!cancelled) {
            setCatalogScaling(null)
          }
        })
    } else {
      setCatalogScaling(null)
    }
    return () => {
      cancelled = true
    }
  }, [exercise.catalogId])

  const effectiveMultiplier = catalogScaling?.multiplier
  const effectiveBaseWeight = catalogScaling?.baseWeightKg

  return (
    <Stack gap="xs" mt="xs">
      {entries.map((entry) =>
        entry.type === 'set' ? (
          <SetRow
            key={`set-${entry.set.id}`}
            set={entry.set}
            multiplier={effectiveMultiplier}
            baseWeightKg={effectiveBaseWeight}
          />
        ) : (
          <RestRow key={`rest-${entry.rest.id}`} rest={entry.rest} />
        )
      )}
    </Stack>
  )
}