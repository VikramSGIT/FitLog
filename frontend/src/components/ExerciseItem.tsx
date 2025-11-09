import React, { useMemo, useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { api, Exercise } from '@/api/client'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import SetList from './SetList'
import { useAutoSave } from '@/hooks/useAutoSave'
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Stack,
  Text,
  Title,
  TextInput,
  Textarea,
  Tooltip,
  useMantineTheme
} from '@mantine/core'
import { IconPlus, IconTrash, IconNote } from '@tabler/icons-react'
import { DEFAULT_SURFACES, ThemeSurfaces } from '@/theme'
import { AUTO_SAVE_DELAY_MS } from '@/config'
import { useMediaQuery } from '@mantine/hooks'

export default function ExerciseItem({ exercise }: { exercise: Exercise }) {
  const { updateExerciseLocal, removeExerciseLocal } = useWorkoutStore()
  const isRestDay = useWorkoutStore((s) => s.day?.isRestDay ?? false)
  const dayLoading = useWorkoutStore((s) => s.dayLoading)
  const [editName, setEditName] = useState(exercise.name)
  const [comment, setComment] = useState(exercise.comment || '')
  const [showNote, setShowNote] = useState<boolean>(() => (exercise.comment || '').trim().length > 0)
  const theme = useMantineTheme()
  const surfaces = (theme.other?.surfaces as ThemeSurfaces) ?? DEFAULT_SURFACES
  const accentGradient = (theme.other?.accentGradient as string) ?? 'linear-gradient(135deg, #8f5afc 0%, #5197ff 100%)'
  const primaryText = theme.colorScheme === 'light' ? '#0f172a' : '#f8fafc'
  const isMobile = useMediaQuery('(max-width: 640px)')

  const saveName = useCallback(async (value: string) => {
    if (value !== exercise.name) {
      const updated = await api.updateExercise(exercise.id, { name: value })
      updateExerciseLocal(exercise.id, { name: updated.name })
      return true
    }
    return false
  }, [exercise.id, exercise.name, updateExerciseLocal])
  useAutoSave(editName, saveName, AUTO_SAVE_DELAY_MS)

  const saveComment = useCallback(async (value: string) => {
    if ((exercise.comment || '') !== value) {
      const updated = await api.updateExercise(exercise.id, { comment: value })
      updateExerciseLocal(exercise.id, { comment: updated.comment })
      return true
    }
    return false
  }, [exercise.id, exercise.comment, updateExerciseLocal])
  useAutoSave(comment, saveComment, AUTO_SAVE_DELAY_MS)

  async function onDelete() {
    if (dayLoading) return
    await api.deleteExercise(exercise.id)
    removeExerciseLocal(exercise.id)
  }

  const nextSetPosition = useMemo(() => {
    const sets = Array.isArray(exercise.sets) ? exercise.sets : []
    return (sets[sets.length - 1]?.position ?? 0) + 1
  }, [exercise.sets])

  async function addSet(isDropStart: boolean) {
    if (dayLoading) return
    const created = await api.createSet(exercise.id, {
      position: nextSetPosition,
      reps: 10,
      weightKg: 20,
      isWarmup: false,
      startDropSet: isDropStart
    })
    useWorkoutStore.getState().addSetLocal(exercise.id, created)
  }

  return (
    <Card
      withBorder
      radius="lg"
      padding="lg"
      style={{
        background: surfaces.card,
        borderColor: surfaces.border,
        backdropFilter: 'none'
      }}
    >
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="nowrap" gap="md">
          <Stack gap={4} style={{ flex: 1 }}>
            <Group align="center" justify="space-between" wrap="nowrap" gap="sm">
              <TextInput
                placeholder="E.g. Back squat"
                value={editName}
                onChange={(e) => setEditName(e.currentTarget.value)}
                disabled={dayLoading}
                radius="md"
                size="md"
                variant="filled"
                style={{ flex: 1 }}
              />
              {isMobile ? (
                <Tooltip label={showNote ? 'Hide note' : 'Add note'} position="top" withArrow>
                  <ActionIcon
                    variant="outline"
                    color={theme.primaryColor}
                    radius="md"
                    size="lg"
                    onClick={() => setShowNote((v) => !v)}
                    aria-label={showNote ? 'Hide note' : 'Add note'}
                    disabled={isRestDay || dayLoading}
                    style={{
                      backgroundColor: 'transparent',
                      borderColor: `var(--mantine-color-${theme.primaryColor}-5)`
                    }}
                  >
                    <IconNote size={18} />
                  </ActionIcon>
                </Tooltip>
              ) : (
                <Button
                  variant="outline"
                  color={theme.primaryColor}
                  onClick={() => setShowNote((v) => !v)}
                  disabled={isRestDay || dayLoading}
                  leftSection={<IconNote size={16} />}
                >
                  {showNote ? 'Hide note' : 'Add note'}
                </Button>
              )}
              <Tooltip label="Remove exercise" position="top" withArrow>
                <ActionIcon
                  variant="light"
                  color="red"
                  radius="md"
                  size="lg"
                  onClick={onDelete}
                  aria-label="Delete exercise"
                  disabled={dayLoading}
                >
                  <IconTrash size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>
            <AnimatePresence initial={false}>
              {showNote && (
                <motion.div
                  key="note"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 240, damping: 26, mass: 0.6 }}
                  style={{ overflow: 'hidden' }}
                >
                  <Textarea
                    label="Notes"
                    placeholder="Add cues, target intensity, or reminders..."
                    value={comment}
                    onChange={(e) => setComment(e.currentTarget.value)}
                    disabled={dayLoading}
                    radius="md"
                    minRows={2}
                    autosize
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </Stack>
        </Group>

        <Divider style={{ borderColor: surfaces.border, opacity: 0.6 }} />

        <Group justify="space-between" align="center" wrap="wrap" gap="sm">
          <Title order={5}>Sets and Weights</Title>
          <Group gap="sm">
            <Button
              onClick={() => addSet(false)}
              disabled={isRestDay || dayLoading}
              leftSection={<IconPlus size={16} />}
              style={{
                backgroundImage: accentGradient,
                color: primaryText,
                border: 'none'
              }}
            >
              Set
            </Button>
            <Button
              variant="outline"
              color={theme.primaryColor}
              onClick={() => addSet(true)}
              disabled={isRestDay || dayLoading}
              leftSection={<IconPlus size={16} />}
            >
              Drop Set
            </Button>
          </Group>
        </Group>
      <SetList exercise={exercise} />

        <Group justify="space-between" align="center" wrap="wrap" gap="sm">
          {isRestDay && (
            <Badge color="yellow" variant="light">
              Rest day - editing disabled
            </Badge>
          )}
        </Group>
      </Stack>
    </Card>
  )
}


