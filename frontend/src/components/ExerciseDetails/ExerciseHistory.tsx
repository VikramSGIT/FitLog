import React, { useRef, useEffect } from 'react'
import {
  Badge,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Title,
  useMantineTheme
} from '@mantine/core'
import { format } from 'date-fns'
import { ExerciseHistoryItem } from '@/api/client'
import { ThemeSurfaces, useThemePreset } from '@/theme'

interface ExerciseHistoryProps {
  history: ExerciseHistoryItem[]
  highestWeight: number
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: (offset: number) => void
  onItemClick: (date: string) => void
  isMobile: boolean
}

export const ExerciseHistory: React.FC<ExerciseHistoryProps> = ({
  history,
  highestWeight,
  hasMore,
  loadingMore,
  onLoadMore,
  onItemClick,
  isMobile
}) => {
  const theme = useMantineTheme()
  const { preset } = useThemePreset()
  const surfaces = theme.other?.surfaces as ThemeSurfaces || {}
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  
  const mutedTextColor = (theme.other?.mutedText as string) ?? (preset.colorScheme === 'light' ? 'rgba(15, 23, 42, 0.65)' : 'rgba(226, 232, 240, 0.72)')

  useEffect(() => {
    if (!hasMore || loadingMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          onLoadMore(history.length)
        }
      },
      { threshold: 0.1 }
    )

    const trigger = loadMoreTriggerRef.current
    if (trigger) {
      observer.observe(trigger)
    }

    return () => {
      if (trigger) {
        observer.unobserve(trigger)
      }
    }
  }, [hasMore, loadingMore, history.length, onLoadMore])

  return (
    <Stack gap="md" mt="xl">
      <Title order={3}>Your Stats</Title>
      {highestWeight > 0 && (
        <Paper
          p="md"
          radius="md"
          withBorder
          style={{
            background: surfaces.card,
            borderColor: surfaces.border
          }}
        >
          <Stack gap={4}>
            <Text size="sm" style={{ color: mutedTextColor }}>
              Highest Weight Lifted
            </Text>
            <Text size="xl" fw={600}>
              {highestWeight.toFixed(1)} kg
            </Text>
          </Stack>
        </Paper>
      )}

      {history.length > 0 && (
        <Stack gap="md" mt="md">
          <Title order={4}>Exercise History</Title>
          <ScrollArea
            h={isMobile ? 400 : 500}
            type="scroll"
            style={{ width: '100%' }}
            viewportRef={scrollAreaRef}
          >
            <Stack gap="md">
              {history.map((item) => {
                return (
                  <Paper
                    key={item.workoutDate}
                    p="md"
                    radius="md"
                    withBorder
                    style={{
                      background: surfaces.card,
                      borderColor: surfaces.border,
                      cursor: 'pointer'
                    }}
                    onClick={() => onItemClick(item.workoutDate)}
                  >
                    <Stack gap="sm">
                      <Group justify="space-between" align="center">
                        <Text fw={600}>
                          {format(new Date(item.workoutDate), 'MMMM d, yyyy')}
                        </Text>
                      </Group>
                      <Group gap="xs" wrap="wrap">
                        {item.sets.map((set, idx) => (
                          <Badge
                            key={idx}
                            variant={set.isWarmup ? 'light' : 'filled'}
                            color={set.isWarmup ? 'gray' : theme.primaryColor}
                          >
                            {set.reps} × {set.weightKg.toFixed(1)} kg
                            {set.isWarmup && ' (warmup)'}
                          </Badge>
                        ))}
                      </Group>
                    </Stack>
                  </Paper>
                )
              })}
              {hasMore && (
                <div ref={loadMoreTriggerRef} style={{ height: 20, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  {loadingMore && <Loader size="sm" />}
                </div>
              )}
            </Stack>
          </ScrollArea>
        </Stack>
      )}

      {history.length === 0 && highestWeight === 0 && (
        <Paper
          p="md"
          radius="md"
          withBorder
          style={{
            background: surfaces.card,
            borderColor: surfaces.border
          }}
        >
          <Text size="sm" style={{ color: mutedTextColor }}>
            No exercise history yet. Start tracking your workouts to see your progress here!
          </Text>
        </Paper>
      )}
    </Stack>
  )
}
