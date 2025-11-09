import React, { useCallback, useEffect, useRef, useState } from 'react'
import { api, Exercise } from '@/api/client'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import ExerciseItem from './ExerciseItem'
import { Alert, Button, Group, Loader, Paper, Stack, Text, Title, Tooltip, useMantineTheme, ActionIcon } from '@mantine/core'
import { IconPlus, IconMoonStars, IconBarbell } from '@tabler/icons-react'
import { AnimatePresence, motion } from 'framer-motion'
import { DEFAULT_SURFACES, ThemeSurfaces } from '@/theme'
import { useMediaQuery } from '@mantine/hooks'

// date picker moved to HeaderBar

type ExerciseListProps = {
  onAddFromCatalog?: () => void
}

export default function ExerciseList({ onAddFromCatalog }: ExerciseListProps) {
  const day = useWorkoutStore((s) => s.day)
  const dayLoading = useWorkoutStore((s) => s.dayLoading)
  const addExerciseLocal = useWorkoutStore((s) => s.addExerciseLocal)
  const theme = useMantineTheme()
  const surfaces = (theme.other?.surfaces as ThemeSurfaces) ?? DEFAULT_SURFACES
  const accentGradient = (theme.other?.accentGradient as string) ?? 'linear-gradient(135deg, #22d3ee 0%, #6366f1 100%)'
  const isLight = theme.colorScheme === 'light'
  const ctaTextColor = isLight ? '#0f172a' : '#f8fafc'
  const baseTextColor = (theme.other?.textColor as string) ?? (isLight ? '#0f172a' : '#f8fafc')
  const loadingRef = useRef<string | null>(null)
  const isMobile = useMediaQuery('(max-width: 640px)')

  const exercises = Array.isArray(day?.exercises) ? (day?.exercises as Exercise[]) : []
  const isRestDay = Boolean(day?.isRestDay)

  // rest toggle moved to HeaderBar

  // date ensure moved to HeaderBar

  async function addCustomExercise() {
    if (!day || day.isRestDay) return
    const position = (exercises[exercises.length - 1]?.position ?? 0) + 1
    const created = await api.createExercise(day.id, { name: 'New Exercise', position })
    addExerciseLocal({ ...created, sets: [] })
  }

  const handleAddFromCatalog = () => {
    if (!day || isRestDay || dayLoading) return
    onAddFromCatalog?.()
  }

  return (
    <Stack gap={isMobile ? 'xs' : 'md'} style={{ flex: 1, minHeight: 0, padding: 0, margin: 0 }}>
      <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
        <Stack gap={4} style={{ flex: 1, minWidth: 220 }}>
          <Title order={3}>Exercises</Title>
          <Text size="sm" c="dimmed">
            Build out today's session with warmups, strength work, and accessories.
          </Text>
        </Stack>
        <Group gap="sm" wrap="wrap">
          {isMobile ? (
            <>
              <Tooltip label="Add custom exercise">
                <ActionIcon
                  size="lg"
                  radius="md"
                  aria-label="Add custom exercise"
                  onClick={addCustomExercise}
                  disabled={!day || isRestDay || dayLoading}
                  variant="outline"
                  color={theme.primaryColor}
                  style={{
                    backgroundColor: 'transparent',
                    borderColor: `var(--mantine-color-${theme.primaryColor}-5)`
                  }}
                >
                  <IconPlus size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Add from catalog">
                <ActionIcon
                  size="lg"
                  radius="md"
                  aria-label="Add from catalog"
                  onClick={handleAddFromCatalog}
                  disabled={!day || isRestDay || dayLoading}
                  style={{
                    backgroundImage: accentGradient,
                    color: ctaTextColor,
                    border: 'none'
                  }}
                >
                  <IconPlus size={18} />
                </ActionIcon>
              </Tooltip>
            </>
          ) : (
            <>
              <Button
                onClick={addCustomExercise}
                disabled={!day || isRestDay || dayLoading}
                variant="outline"
                color={theme.primaryColor}
                leftSection={<IconPlus size={18} />}
                style={{
                  backgroundColor: 'transparent',
                  borderColor: `var(--mantine-color-${theme.primaryColor}-5)`
                }}
              >
                Add custom exercise
              </Button>
              <Button
                onClick={handleAddFromCatalog}
                disabled={!day || isRestDay || dayLoading}
                leftSection={<IconPlus size={18} />}
                style={{
                  backgroundImage: accentGradient,
                  color: ctaTextColor,
                  border: 'none'
                }}
              >
                Add from catalog
              </Button>
            </>
          )}
        </Group>
      </Group>

      {dayLoading && (
        <Group gap={6}>
          <Loader size="sm" color={theme.primaryColor} />
          <Text size="xs" c="dimmed">
            Syncing with the server - hang tight...
          </Text>
        </Group>
      )}

      {day && isRestDay && (
        <Alert
          icon={<IconMoonStars size={18} />}
          color="yellow"
          variant="light"
          title="Rest day"
          radius="md"
        >
          This day is marked as a rest day. Switch back to a training day to add or edit exercises.
        </Alert>
      )}

      <AnimatePresence initial={false}>
        {!day ? (
          <Paper
            withBorder
            radius="lg"
            p="lg"
            style={{
              backdropFilter: 'none',
              borderColor: surfaces.border
            }}
            component={motion.div}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Stack align="center" gap="xs">
              <IconBarbell size={28} color="var(--mantine-color-primary-4)" />
              <Text fw={500}>No workout selected</Text>
              <Text size="sm" c="dimmed" ta="center">
                Choose a date above to load or create a workout day.
              </Text>
            </Stack>
          </Paper>
        ) : !isRestDay && exercises.length === 0 ? (
          <Paper
            withBorder
            radius="lg"
            p="lg"
            style={{
              backdropFilter: 'none',
              borderColor: surfaces.border
            }}
            component={motion.div}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Stack align="center" gap="xs">
              <IconBarbell size={28} color="var(--mantine-color-primary-4)" />
              <Text fw={500}>No exercises yet</Text>
              <Text size="sm" c="dimmed" ta="center">
                Use "Add from catalog" to pull templated movements or add a custom exercise to start from scratch.
              </Text>
            </Stack>
          </Paper>
        ) : (
          <Stack gap="sm">
        {exercises.map((ex: Exercise) => (
              <motion.div
                key={ex.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.2 }}
              >
                <ExerciseItem exercise={ex} />
              </motion.div>
        ))}
          </Stack>
        )}
      </AnimatePresence>

    </Stack>
  )
}


