import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { api, Exercise, WorkoutSet } from '@/api/client'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import { useAutoSave } from '@/hooks/useAutoSave'
import { ActionIcon, Badge, Group, Paper, Stack, Text, TextInput, Tooltip, useMantineTheme } from '@mantine/core'
import { IconTrash } from '@tabler/icons-react'
import { DEFAULT_SURFACES, ThemeSurfaces } from '@/theme'

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
      return
    }
    const updated = await api.updateSet(set.id, updates)
    updateSetLocal(set.id, { reps: updated.reps, weightKg: updated.weightKg })
  }, [set.id, set.reps, set.weightKg, updateSetLocal])

  useAutoSave(parsed, async (v) => save(v), 5000)

  const onDelete = useCallback(async () => {
    if (dayLoading) return
    await api.deleteSet(set.id)
    removeSetLocal(set.id)
  }, [dayLoading, removeSetLocal, set.id])

  return (
    <Paper
      withBorder
      radius="md"
      p="md"
      style={{
        borderColor: surfaces.border,
        backdropFilter: 'none',
      }}
    >
      <Group justify="space-between" align="center" wrap="wrap" gap="md">
        <Group gap="md" wrap="wrap">
          <Stack gap={4} w={110}>
            <Text size="xs" c="dimmed">
              Reps
            </Text>
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
        />
          </Stack>
          <Stack gap={4} w={140}>
            <Text size="xs" c="dimmed">
              Weight (kg)
            </Text>
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
            />
          </Stack>
          <Stack gap={4}>
            <Text size="xs" c="dimmed">
              Type
            </Text>
            <Badge color={set.dropSetGroupId ? theme.primaryColor : 'gray'} variant="light">
              {set.dropSetGroupId ? 'Drop set' : 'Straight set'}
            </Badge>
          </Stack>
        </Group>
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
      </Group>
    </Paper>
  )
}

export default function SetList({ exercise }: { exercise: Exercise }) {
  const sets = Array.isArray(exercise.sets) ? exercise.sets : []
  return (
    <Stack gap="sm" mt="xs">
      {sets.map((s) => (
        <SetRow key={s.id} set={s} />
      ))}
    </Stack>
  )
}


