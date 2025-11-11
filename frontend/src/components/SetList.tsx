import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { api, Exercise, ExerciseEntry, RestPeriod, WorkoutSet } from '@/api/client'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import { useAutoSave } from '@/hooks/useAutoSave'
import { ActionIcon, Group, Paper, Stack, Text, TextInput, Tooltip, useMantineTheme } from '@mantine/core'
import { IconTrash } from '@tabler/icons-react'
import { DEFAULT_SURFACES, ThemeSurfaces } from '@/theme'
import { AUTO_SAVE_DELAY_MS } from '@/config'

function SetRow({ set, multiplier, baseWeightKg }: { set: WorkoutSet; multiplier?: number | null; baseWeightKg?: number | null }) {
  const { updateSetLocal, removeSetLocal } = useWorkoutStore()
  const dayLoading = useWorkoutStore((s) => s.dayLoading)
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
    const updates: Partial<Pick<WorkoutSet, 'reps' | 'weightKg'>> = {}
    if (payload.reps !== null && payload.reps > 0) {
      const roundedReps = Math.round(payload.reps)
      if (roundedReps !== set.reps) {
        updates.reps = roundedReps
      }
    }
    if (payload.weight !== null && payload.weight >= 0) {
      const roundedWeight = Math.round(payload.weight * 100) / 100
      if (roundedWeight !== set.weightKg) {
        updates.weightKg = roundedWeight
      }
    }
    if (!('reps' in updates) && !('weightKg' in updates)) {
      return false
    }
    const updated = await api.updateSet(set.id, updates)
    updateSetLocal(set.id, { reps: updated.reps, weightKg: updated.weightKg })
    return true
  }, [set.id, set.reps, set.weightKg, updateSetLocal])

  useAutoSave(parsed, async (v) => save(v), AUTO_SAVE_DELAY_MS)

  const onDelete = useCallback(async () => {
    if (dayLoading) return
    await api.deleteSet(set.id)
    removeSetLocal(set.id)
  }, [dayLoading, removeSetLocal, set.id])

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
  const { updateRestLocal, removeRestLocal } = useWorkoutStore()
  const dayLoading = useWorkoutStore((s) => s.dayLoading)
  const [durationInput, setDurationInput] = useState<string>(() => String(rest.durationSeconds))
  const theme = useMantineTheme()
  const surfaces = (theme.other?.surfaces as ThemeSurfaces) ?? DEFAULT_SURFACES

  useEffect(() => {
    setDurationInput(String(rest.durationSeconds))
  }, [rest.durationSeconds])

  const parsed = useMemo(() => {
    const trimmed = durationInput.trim()
    if (trimmed === '') {
      return { duration: null }
    }
    const value = Number(trimmed)
    if (!Number.isFinite(value)) {
      return { duration: null }
    }
    return { duration: Math.max(0, Math.round(value)) }
  }, [durationInput])

  const save = useCallback(
    async ({ duration }: { duration: number | null }) => {
      if (duration === null) return false
      if (duration === rest.durationSeconds) return false
      const updated = await api.updateRest(rest.id, { durationSeconds: duration })
      updateRestLocal(rest.id, {
        durationSeconds: updated.durationSeconds,
        position: updated.position,
        updatedAt: updated.updatedAt
      })
      return true
    },
    [rest.durationSeconds, rest.id, updateRestLocal]
  )

  useAutoSave(parsed, async (v) => save(v), AUTO_SAVE_DELAY_MS)

  const onDelete = useCallback(async () => {
    if (dayLoading) return
    await api.deleteRest(rest.id)
    removeRestLocal(rest.id)
  }, [dayLoading, removeRestLocal, rest.id])

  const restBackground = theme.colorScheme === 'light' ? 'rgba(56, 189, 248, 0.1)' : 'rgba(56, 189, 248, 0.18)'

  return (
    <Paper
      withBorder
      radius="md"
      p={0}
      style={{ borderColor: surfaces.border, backdropFilter: 'none', background: restBackground }}
    >
      <Group justify="space-between" align="center" wrap="nowrap" gap="sm">
        <Group
          gap="sm"
          wrap="nowrap"
          style={{ flex: 1, minWidth: 0, padding: theme.spacing.sm }}
        >
          <Group gap="xs" align="center" wrap="nowrap" w={200}>
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
              placeholder="Rest"
              style={{ flex: 1 }}
            />
            <Text size="sm" c="dimmed">
              secs
            </Text>
          </Group>
        </Group>
        <div style={{ paddingRight: theme.spacing.sm }}>
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
      </div>
      </Group>
    </Paper>
  )
}

export default function SetList({ exercise }: { exercise: Exercise }) {
  const sets = Array.isArray(exercise.sets) ? exercise.sets : []
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
  const timeline: ExerciseEntry[] = useMemo(() => {
    if (Array.isArray(exercise.timeline) && exercise.timeline.length > 0) {
      return exercise.timeline
    }
    return sets.map((set) => ({ kind: 'set' as const, set }))
  }, [exercise.timeline, sets])
  return (
    <Stack gap="xs" mt="xs">
      {timeline.map((entry) => {
        if (entry.kind === 'rest' && entry.rest) {
          return <RestRow key={`rest-${entry.rest.id}`} rest={entry.rest} />
        }
        if (entry.kind === 'set' && entry.set) {
          return (
            <SetRow
              key={`set-${entry.set.id}`}
              set={entry.set}
              multiplier={effectiveMultiplier}
              baseWeightKg={effectiveBaseWeight}
            />
          )
        }
        return null
      })}
    </Stack>
  )
}


