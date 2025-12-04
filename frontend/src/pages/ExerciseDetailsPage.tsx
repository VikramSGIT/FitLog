import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Container,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Title,
  useMantineTheme
} from '@mantine/core'
import { IconArrowLeft } from '@/icons/tabler'
import { notifications } from '@mantine/notifications'
import HeaderBar from '@/components/HeaderBar'
import { DEFAULT_SURFACES, ThemeSurfaces, useThemePreset } from '@/theme'
import { api, CatalogRecord, ExerciseHistoryItem } from '@/api/client'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import { useMediaQuery } from '@mantine/hooks'
import { format } from 'date-fns'

export default function ExerciseDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const theme = useMantineTheme()
  const { preset } = useThemePreset()
  const isMobile = useMediaQuery('(max-width: 640px)')
  const flush = useWorkoutStore((s) => s.flush)
  const saving = useWorkoutStore((s) => s.saving)
  const lastSavedAt = useWorkoutStore((s) => s.lastSavedAt)

  const [loading, setLoading] = useState(true)
  const [exercise, setExercise] = useState<CatalogRecord | null>(null)
  const [highestWeight, setHighestWeight] = useState(0)
  const [history, setHistory] = useState<ExerciseHistoryItem[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null)

  const surfaces = (theme.other?.surfaces as ThemeSurfaces) ?? DEFAULT_SURFACES
  const baseTextColor =
    (theme.other?.textColor as string) ?? (preset.colorScheme === 'light' ? '#0f172a' : '#f8fafc')
  const mutedTextColor =
    (theme.other?.mutedText as string) ??
    (preset.colorScheme === 'light' ? 'rgba(15, 23, 42, 0.65)' : 'rgba(226, 232, 240, 0.72)')

  const historyCount = history.length

  const loadMoreHistory = useCallback(async () => {
    if (!id || loadingMore) return
    setLoadingMore(true)
    try {
      const statsData = await api.getExerciseStats(id, 5, historyCount)
      if (statsData) {
        setHistory((prev) => [...prev, ...statsData.history])
        setHasMore(statsData.hasMore || false)
      }
    } catch (error: unknown) {
    } finally {
      setLoadingMore(false)
    }
  }, [id, loadingMore, historyCount])

  useEffect(() => {
    if (!id) {
      navigate('/catalog')
      return
    }

    const loadData = async () => {
      setLoading(true)
      try {
        const [exerciseData, statsData] = await Promise.all([
          api.getCatalogEntry(id),
          api.getExerciseStats(id, 5, 0).catch(() => null)
        ])
        setExercise(exerciseData)
        if (statsData) {
          setHighestWeight(statsData.highestWeightKg)
          setHistory(statsData.history || [])
          setHasMore(statsData.hasMore || false)
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to load exercise details'
        notifications.show({
          title: 'Error',
          message,
          color: 'red'
        })
        navigate('/catalog')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [id, navigate])

  // Infinite scroll observer
  useEffect(() => {
    if (!hasMore || loadingMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMoreHistory()
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
  }, [hasMore, loadingMore, loadMoreHistory])

  if (loading) {
    return (
      <Box
        style={{
          minHeight: '100vh',
          background: surfaces.app,
          color: baseTextColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Loader size="lg" />
      </Box>
    )
  }

  if (!exercise) {
    return null
  }

  return (
    <Box
      style={{
        minHeight: '100vh',
        height: isMobile ? '100vh' : undefined,
        background: isMobile ? surfaces.panel : surfaces.app,
        color: baseTextColor,
        paddingBottom: isMobile ? 0 : '4rem',
        display: isMobile ? 'flex' : undefined,
        flexDirection: isMobile ? 'column' : undefined,
        overflow: isMobile ? 'hidden' : undefined
      }}
    >
      {!isMobile && (
        <HeaderBar
          onBrowseCatalog={() => navigate('/catalog')}
          onSave={() => flush()}
          saving={saving}
          lastSavedAt={lastSavedAt}
          onLogout={async () => {
            try {
              await api.logout()
            } catch {}
            navigate('/')
          }}
          userLabel="Account"
        />
      )}
      {isMobile ? (
        <Stack gap="md" style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '16px' }}>
          <Group justify="space-between" align="center">
            <ActionIcon
              variant="outline"
              color={theme.primaryColor}
              radius="md"
              size="lg"
              onClick={() => navigate(-1)}
              aria-label="Back"
            >
              <IconArrowLeft size={18} />
            </ActionIcon>
            <Title order={3} style={{ margin: 0, flex: 1, textAlign: 'center' }}>
              {exercise.name}
            </Title>
            <div style={{ width: 40 }} />
          </Group>
          <ScrollArea style={{ flex: 1, minHeight: 0 }}>
            <Stack gap="md">
              <Stack gap="md" align="center">
                {exercise.hasImage && (
                  <div
                    style={{
                      width: isMobile ? 200 : 240,
                      height: isMobile ? 200 : 240,
                      borderRadius: 12,
                      overflow: 'hidden',
                      border: `1px solid ${surfaces.border}`,
                      flexShrink: 0,
                      background: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <img
                      src={`${import.meta.env.VITE_API_BASE_URL || ''}/api/catalog/entries/${exercise.id}/image`}
                      alt={exercise.name}
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                    />
                  </div>
                )}
                {!isMobile && (
                  <Title order={2} style={{ textAlign: 'center' }}>{exercise.name}</Title>
                )}
                <Group gap="sm" wrap="wrap" justify="center">
                {exercise.type && (
                  <Badge color={theme.primaryColor} variant="light">
                    {exercise.type}
                  </Badge>
                )}
                {exercise.bodyPart && (
                  <Badge color="blue" variant="light">
                    {exercise.bodyPart}
                  </Badge>
                )}
                {exercise.equipment && (
                  <Badge color="grape" variant="light">
                    {exercise.equipment}
                  </Badge>
                )}
                {exercise.level && (
                  <Badge color="cyan" variant="light">
                    {exercise.level}
                  </Badge>
                )}
              </Group>
            </Stack>

            {exercise.description && (
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
                  <Text size="sm" fw={600} style={{ color: mutedTextColor }}>
                    Description
                  </Text>
                  <Text size="sm" style={{ color: baseTextColor }}>
                    {exercise.description}
                  </Text>
                </Stack>
              </Paper>
            )}

            {(exercise.primaryMuscles?.length > 0 || exercise.secondaryMuscles?.length > 0) && (
              <Stack gap="md">
                {exercise.primaryMuscles && exercise.primaryMuscles.length > 0 && (
                  <Paper
                    p="md"
                    radius="md"
                    withBorder
                    style={{
                      background: surfaces.card,
                      borderColor: surfaces.border
                    }}
                  >
                    <Stack gap="xs">
                      <Text size="sm" fw={600} style={{ color: mutedTextColor }}>
                        Primary Muscles
                      </Text>
                      <Group gap="xs" wrap="wrap">
                        {exercise.primaryMuscles.map((muscle, idx) => (
                          <Badge key={idx} color="orange" variant="light">
                            {muscle}
                          </Badge>
                        ))}
                      </Group>
                    </Stack>
                  </Paper>
                )}
                {exercise.secondaryMuscles && exercise.secondaryMuscles.length > 0 && (
                  <Paper
                    p="md"
                    radius="md"
                    withBorder
                    style={{
                      background: surfaces.card,
                      borderColor: surfaces.border
                    }}
                  >
                    <Stack gap="xs">
                      <Text size="sm" fw={600} style={{ color: mutedTextColor }}>
                        Secondary Muscles
                      </Text>
                      <Group gap="xs" wrap="wrap">
                        {exercise.secondaryMuscles.map((muscle, idx) => (
                          <Badge key={idx} color="gray" variant="light">
                            {muscle}
                          </Badge>
                        ))}
                      </Group>
                    </Stack>
                  </Paper>
                )}
              </Stack>
            )}

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
                      {history.map((item) => (
                        <Paper
                          key={item.workoutDate}
                          p="md"
                          radius="md"
                          withBorder
                          style={{
                            background: surfaces.card,
                            borderColor: surfaces.border
                          }}
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
                      ))}
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
            </Stack>
          </ScrollArea>
        </Stack>
      ) : (
        <Container size="lg" py="xl">
          <Paper
            radius="lg"
            withBorder
            p="xl"
            style={{
              background: surfaces.panel,
              borderColor: surfaces.border,
              color: baseTextColor
            }}
          >
            <Stack gap="lg">
              {!isMobile && (
                <Group justify="space-between" align="center">
                <Button
                  variant="subtle"
                  leftSection={<IconArrowLeft size={16} />}
                  onClick={() => navigate(-1)}
                  style={{ alignSelf: 'flex-start' }}
                >
                  Back
                </Button>
                </Group>
              )}

              <Stack gap="md" align="center">
                {exercise.hasImage && (
                  <div
                    style={{
                      width: isMobile ? 200 : 240,
                      height: isMobile ? 200 : 240,
                      borderRadius: 12,
                      overflow: 'hidden',
                      border: `1px solid ${surfaces.border}`,
                      flexShrink: 0,
                      background: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <img
                      src={`${import.meta.env.VITE_API_BASE_URL || ''}/api/catalog/entries/${exercise.id}/image`}
                      alt={exercise.name}
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                    />
                  </div>
                )}
                {!isMobile && (
                  <Title order={2} style={{ textAlign: 'center' }}>{exercise.name}</Title>
                )}
                <Group gap="sm" wrap="wrap" justify="center">
                  {exercise.type && (
                    <Badge color={theme.primaryColor} variant="light">
                      {exercise.type}
                    </Badge>
                  )}
                  {exercise.bodyPart && (
                    <Badge color="blue" variant="light">
                      {exercise.bodyPart}
                    </Badge>
                  )}
                  {exercise.equipment && (
                    <Badge color="grape" variant="light">
                      {exercise.equipment}
                    </Badge>
                  )}
                  {exercise.level && (
                    <Badge color="cyan" variant="light">
                      {exercise.level}
                    </Badge>
                  )}
                </Group>
              </Stack>

              {exercise.description && (
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
                    <Text size="sm" fw={600} style={{ color: mutedTextColor }}>
                      Description
                    </Text>
                    <Text size="sm" style={{ color: baseTextColor }}>
                      {exercise.description}
                    </Text>
                  </Stack>
                </Paper>
              )}

              {(exercise.primaryMuscles?.length > 0 || exercise.secondaryMuscles?.length > 0) && (
                <Stack gap="md">
                  {exercise.primaryMuscles && exercise.primaryMuscles.length > 0 && (
                    <Paper
                      p="md"
                      radius="md"
                      withBorder
                      style={{
                        background: surfaces.card,
                        borderColor: surfaces.border
                      }}
                    >
                      <Stack gap="xs">
                        <Text size="sm" fw={600} style={{ color: mutedTextColor }}>
                          Primary Muscles
                        </Text>
                        <Group gap="xs" wrap="wrap">
                          {exercise.primaryMuscles.map((muscle, idx) => (
                            <Badge key={idx} color="orange" variant="light">
                              {muscle}
                            </Badge>
                          ))}
                        </Group>
                      </Stack>
                    </Paper>
                  )}
                  {exercise.secondaryMuscles && exercise.secondaryMuscles.length > 0 && (
                    <Paper
                      p="md"
                      radius="md"
                      withBorder
                      style={{
                        background: surfaces.card,
                        borderColor: surfaces.border
                      }}
                    >
                      <Stack gap="xs">
                        <Text size="sm" fw={600} style={{ color: mutedTextColor }}>
                          Secondary Muscles
                        </Text>
                        <Group gap="xs" wrap="wrap">
                          {exercise.secondaryMuscles.map((muscle, idx) => (
                            <Badge key={idx} color="gray" variant="light">
                              {muscle}
                            </Badge>
                          ))}
                        </Group>
                      </Stack>
                    </Paper>
                  )}
                </Stack>
              )}

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
                        {history.map((item) => (
                          <Paper
                            key={item.workoutDate}
                            p="md"
                            radius="md"
                            withBorder
                            style={{
                              background: surfaces.card,
                              borderColor: surfaces.border
                            }}
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
                        ))}
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
            </Stack>
          </Paper>
        </Container>
      )}
    </Box>
  )
}

