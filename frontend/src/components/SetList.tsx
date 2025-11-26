import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { api, ExerciseEntry, WorkoutSet } from '@/api/client'
import { Exercise, Set, RestPeriod } from '@/db/schema'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import { ActionIcon, Group, Paper, Stack, Text, TextInput, Tooltip, useMantineTheme } from '@mantine/core'
import { IconTrash, IconClock } from '@tabler/icons-react'
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
    const currentSet = useWorkoutStore.getState().sets.find(s => s.id === set.id);
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
    await updateSet(set.id, updates)
    return true
  }, [updateSet, set.id])

  useDebouncedSaveToRxDB(parsed, async (v) => save(v), 2000, false)

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

function RestRow({ rest }: { rest: RestPeriod }) {
  const { updateRest, deleteRest, isLoading: dayLoading } = useWorkoutStore()
  const [durationInput, setDurationInput] = useState<string>(() => String(rest.durationSeconds))
  const theme = useMantineTheme()
  const surfaces = (theme.other?.surfaces as ThemeSurfaces) ?? DEFAULT_SURFACES

  useEffect(() => {
    setDurationInput(String(rest.durationSeconds))
  }, [rest.durationSeconds])

  const parsed = useMemo(() => {
    const durationValue = durationInput.trim() === '' ? null : Number.isFinite(Number(durationInput)) ? Math.round(Number(durationInput)) : null
    return { durationSeconds: durationValue }
  }, [durationInput])

  const save = useCallback(async (payload: { durationSeconds: number | null }) => {
    const currentRest = useWorkoutStore.getState().restPeriods.find(r => r.id === rest.id);
    if (!currentRest) {
      return false;
    }

    if (payload.durationSeconds !== null && payload.durationSeconds > 0) {
      if (payload.durationSeconds !== currentRest.durationSeconds) {
        await updateRest(rest.id, { durationSeconds: payload.durationSeconds })
        return true
      }
    }
    return false
  }, [updateRest, rest.id])

  useDebouncedSaveToRxDB(parsed, async (v) => save(v), 2000, false)

  const onDelete = useCallback(async () => {
    if (dayLoading) return
    deleteRest(rest.id)
  }, [dayLoading, deleteRest, rest.id])

  return (
    <Paper withBorder radius="md" p={0} style={{ borderColor: surfaces.border, backdropFilter: 'none', backgroundColor: 'rgba(0, 0, 0, 0.02)' }}>
      <Group justify="space-between" align="center" wrap="nowrap" gap="sm">
        <Group
          gap="sm"
          wrap="nowrap"
          style={{ flex: 1, minWidth: 0, padding: theme.spacing.sm }}
        >
          <IconClock size={20} style={{ opacity: 0.5 }} />
          <Text size="sm" fw={500}>Rest</Text>
          <Stack gap={4} w={110}>
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
              placeholder="Seconds"
              rightSection={<Text size="xs" c="dimmed" mr={8}>s</Text>}
            />
          </Stack>
        </Group>
        <div style={{ paddingRight: theme.spacing.sm }}>
          <Tooltip label="Remove rest period" position="top" withArrow>
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
        </div>
      </Group>
    </Paper>
  )
}

export default function SetList({ exercise }: { exercise: Exercise }) {
  const allSets = useWorkoutStore((s) => s.sets)
  const allRestPeriods = useWorkoutStore((s) => s.restPeriods)
  
  const items = useMemo(() => {
    const exerciseSets = allSets.filter(s => s.exerciseId === exercise.id).map(s => ({ type: 'set' as const, data: s, position: s.position }));
    const exerciseRests = allRestPeriods.filter(r => r.exerciseId === exercise.id).map(r => ({ type: 'rest' as const, data: r, position: r.position }));
    
    return [...exerciseSets, ...exerciseRests].sort((a, b) => a.position - b.position);
  }, [allSets, allRestPeriods, exercise.id])

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
      {items.map((item) => {
        if (item.type === 'set') {
          return (
            <SetRow
              key={item.data.id}
              set={item.data}
              multiplier={effectiveMultiplier}
              baseWeightKg={effectiveBaseWeight}
            />
          )
        } else {
          return (
            <RestRow
              key={item.data.id}
              rest={item.data}
            />
          )
        }
      })}
    </Stack>
  )
}