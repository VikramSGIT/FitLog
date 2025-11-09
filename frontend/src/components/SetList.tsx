import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { api, Exercise, WorkoutSet } from '@/api/client'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import { useAutoSave } from '@/hooks/useAutoSave'
import { ActionIcon, Group, Paper, Stack, Text, TextInput, Tooltip, useMantineTheme } from '@mantine/core'
import { IconTrash } from '@tabler/icons-react'
import { DEFAULT_SURFACES, ThemeSurfaces } from '@/theme'
import { AUTO_SAVE_DELAY_MS } from '@/config'

function SetRow({ set }: { set: WorkoutSet }) {
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
    <Paper
      withBorder
      radius="md"
      p={0}
      style={{
        background: set.dropSetGroupId
          ? (theme.colorScheme === 'light' ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.18)')
          : undefined,
        borderColor: surfaces.border,
        backdropFilter: 'none',
      }}
    >
      <Group justify="space-between" align="center" wrap="nowrap" gap="sm">
        <Group
          gap="sm"
          wrap="nowrap"
          style={{ flex: 1, minWidth: 0, padding: theme.spacing.xs }}
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 2px' }}>
            <Text fw={700} size="sm">
              ×
            </Text>
          </div>
          <Stack gap={4} w={140}>
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
            />
          </Stack>
        </Group>
        <div style={{ paddingRight: theme.spacing.xs }}>
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

export default function SetList({ exercise }: { exercise: Exercise }) {
  const sets = Array.isArray(exercise.sets) ? exercise.sets : []
  return (
    <Stack gap="xs" mt="xs">
      {sets.map((s) => (
        <SetRow key={s.id} set={s} />
      ))}
    </Stack>
  )
}


