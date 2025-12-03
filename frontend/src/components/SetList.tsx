import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { api, ExerciseEntry, RestPeriod, WorkoutSet } from '@/api/client'
import { Exercise, Set, Rest } from '@/db/schema'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import { ActionIcon, Group, Paper, Stack, Text, TextInput, Tooltip, useMantineTheme, Divider } from '@mantine/core'
import { IconTrash } from '@tabler/icons-react'
import { DEFAULT_SURFACES, ThemeSurfaces } from '@/theme'
import { useDebouncedSaveToRxDB } from '@/hooks/useDebouncedSaveToRxDB'

function SetRow({ set, multiplier, baseWeightKg }: { set: Set; multiplier?: number | null; baseWeightKg?: number | null }) {
  const { updateSet, deleteSet, isLoading: dayLoading, setSetDirty } = useWorkoutStore()
  const [repsInput, setRepsInput] = useState<string>(() => String(set.reps))
  const [weightInput, setWeightInput] = useState<string>(() => String(set.weightKg))
  const theme = useMantineTheme()
  const surfaces = (theme.other?.surfaces as ThemeSurfaces) ?? DEFAULT_SURFACES

  useEffect(() => {
    setRepsInput(String(set.reps))
  }, [set.reps])

  useEffect(() => {
    setWeightInput(String(set.weightKg))
  }, [set.weightKg])

  useEffect(() => {
    const repsValue = repsInput.trim() === '' ? null : Number.isFinite(Number(repsInput)) ? Math.round(Number(repsInput)) : null;
    const weightValue = weightInput.trim() === '' ? null : Number.isFinite(Number(weightInput)) ? Number(weightInput) : null;
    
    const isDirty = repsValue !== set.reps || weightValue !== set.weightKg;
    setSetDirty(set.id, isDirty);

  }, [repsInput, weightInput, set.reps, set.weightKg, set.id, setSetDirty]);

  const parsed = useMemo(() => {
    const repsValue = repsInput.trim() === '' ? null : Number.isFinite(Number(repsInput)) ? Math.round(Number(repsInput)) : null
    const weightValue = weightInput.trim() === '' ? null : Number.isFinite(Number(weightInput)) ? Number(weightInput) : null
    return { reps: repsValue, weight: weightValue }
  }, [repsInput, weightInput])

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

  const save = useCallback(async (payload: { reps: number | null; weight: number | null }) => {
    const currentSet = useWorkoutStore.getState().sets.find(s => s.tempId === set.id);
    // If set has been deleted, we can't save.
    if (!currentSet) {
      return false;
    }

    const updates: Partial<Pick<Set, 'reps' | 'weightKg'>> = {}
    if (payload.reps !== null && payload.reps > 0) {
      const roundedReps = Math.round(payload.reps)
      if (roundedReps !== currentSet.reps) {
        updates.reps = roundedReps
      }
    }
    if (payload.weight !== null && payload.weight >= 0) {
      const roundedWeight = Math.round(payload.weight * 100) / 100
      if (roundedWeight !== currentSet.weightKg) {
        updates.weightKg = roundedWeight
      }
    }
    if (!('reps' in updates) && !('weightKg' in updates)) {
      return false
    }
    updateSet(set.id, updates)
    return true
  }, [updateSet, set.id])

  useDebouncedSaveToRxDB(parsed, async (v) => save(v))

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

function RestRow({ rest }: { rest: Rest }) {
  const { updateRest, deleteRest, isLoading: dayLoading } = useWorkoutStore()
  const [durationInput, setDurationInput] = useState<string>(() => String(rest.durationSeconds))
  const theme = useMantineTheme()
  const surfaces = (theme.other?.surfaces as ThemeSurfaces) ?? DEFAULT_SURFACES

  useEffect(() => {
    setDurationInput(String(rest.durationSeconds))
  }, [rest.durationSeconds])

  const parsedDuration = useMemo(() => {
    const value = durationInput.trim() === '' ? null : Number(durationInput)
    if (value === null || Number.isNaN(value) || value < 0) {
      return null
    }
    return Math.round(value)
  }, [durationInput])

  const save = useCallback(
    async (value: number | null) => {
      if (value === null) return false
      const current = useWorkoutStore.getState().rests.find((r) => r.id === rest.id)
      if (!current) return false
      if (current.durationSeconds === value) return false
      await updateRest(rest.id, { durationSeconds: value })
      return true
    },
    [rest.id, updateRest]
  )

  useDebouncedSaveToRxDB(parsedDuration, async (value) => save(value))

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

export default function SetList({ exercise }: { exercise: Exercise }) {
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