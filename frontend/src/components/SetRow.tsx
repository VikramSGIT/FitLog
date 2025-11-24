import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Set } from '@/db/schema'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import { useAutoSave } from '@/hooks/useAutoSave'
import { ActionIcon, Group, Paper, Stack, Text, TextInput, Tooltip, useMantineTheme } from '@mantine/core'
import { IconTrash } from '@tabler/icons-react'
import { DEFAULT_SURFACES, ThemeSurfaces } from '@/theme'
import { AUTO_SAVE_DELAY_MS } from '@/config'

export default function SetRow({ set, multiplier, baseWeightKg }: { set: Set; multiplier?: number | null; baseWeightKg?: number | null }) {
  const { updateSet, deleteSet, isLoading: dayLoading } = useWorkoutStore()
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
    const updates: Partial<Pick<Set, 'reps' | 'weightKg'>> = {}
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
    updateSet(set.tempId, updates)
    return true
  }, [updateSet, set.tempId, set.reps, set.weightKg])

  useAutoSave(parsed, async (v) => save(v), AUTO_SAVE_DELAY_MS)

  const onDelete = useCallback(async () => {
    if (dayLoading) return
    deleteSet(set.tempId)
  }, [dayLoading, deleteSet, set.tempId])

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
