import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Exercise } from '@/db/schema'
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
  const {
    activeDay,
    isLoading: dayLoading,
    exercises,
  } = useWorkoutStore()
  
  const theme = useMantineTheme()
  const surfaces = (theme.other?.surfaces as ThemeSurfaces) ?? DEFAULT_SURFACES
  const accentGradient = (theme.other?.accentGradient as string) ?? 'linear-gradient(135deg, #22d3ee 0%, #6366f1 100%)'
  const isLight = theme.colorScheme === 'light'
  const ctaTextColor = isLight ? '#0f172a' : '#f8fafc'
  const baseTextColor = (theme.other?.textColor as string) ?? (isLight ? '#0f172a' : '#f8fafc')
  const loadingRef = useRef<string | null>(null)
  const isMobile = useMediaQuery('(max-width: 640px)')

  const isRestDay = Boolean(activeDay?.isRestDay)

  // rest toggle moved to HeaderBar

  // date ensure moved to HeaderBar

  const handleAddFromCatalog = () => {
    if (!activeDay || isRestDay || dayLoading) return
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
            <Tooltip label="Add from catalog">
              <ActionIcon
                size="lg"
                radius="md"
                aria-label="Add from catalog"
                onClick={handleAddFromCatalog}
                disabled={!activeDay || isRestDay || dayLoading}
                style={{
                  backgroundImage: accentGradient,
                  color: ctaTextColor,
                  border: 'none'
                }}
              >
                <IconPlus size={18} />
              </ActionIcon>
            </Tooltip>
          ) : (
            <Button
              onClick={handleAddFromCatalog}
              disabled={!activeDay || isRestDay || dayLoading}
              leftSection={<IconPlus size={18} />}
              style={{
                backgroundImage: accentGradient,
                color: ctaTextColor,
                border: 'none'
              }}
            >
              Add from catalog
            </Button>
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

      {activeDay && isRestDay && (
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
        {!activeDay ? (
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
                Use "Add from catalog" to pull templated movements and start building your workout.
              </Text>
            </Stack>
          </Paper>
        ) : (
          <Stack gap="sm">
        {exercises.map((ex: Exercise) => (
              <motion.div
                key={ex.tempId}
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


