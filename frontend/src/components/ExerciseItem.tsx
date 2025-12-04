import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { api } from '@/api/client'
import { Exercise } from '@/db/schema'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import SetList from './SetList'
import { ActionIcon, Badge, Button, Card, Divider, Group, Stack, Text, Title, Textarea, Tooltip, useMantineTheme } from '@mantine/core'
import { IconPlus, IconTrash, IconNote, IconMoonStars } from '@/icons/tabler'
import { DEFAULT_SURFACES, ThemeSurfaces } from '@/theme'
import { useMediaQuery } from '@mantine/hooks'
import { DEFAULT_REST_DURATION_SECONDS, NOTE_COMMIT_DELAY_MS } from '@/config'

export default function ExerciseItem({ exercise }: { exercise: Exercise }) {
  const navigate = useNavigate()
  const { updateExercise, deleteExercise, addSet, addRest, activeDay, isLoading: dayLoading, sets } =
    useWorkoutStore()
  const isRestDay = activeDay?.isRestDay ?? false
  const [comment, setComment] = useState(exercise.comment || '')
  const commentRef = useRef(comment)
  const pendingCommentTimeout = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null)
  const [showNote, setShowNote] = useState<boolean>(() => (exercise.comment || '').trim().length > 0)
  const [imageError, setImageError] = useState(false)
  const theme = useMantineTheme()
  const surfaces = (theme.other?.surfaces as ThemeSurfaces) ?? DEFAULT_SURFACES
  const accentGradient = (theme.other?.accentGradient as string) ?? 'linear-gradient(135deg, #8f5afc 0%, #5197ff 100%)'
  const primaryText = theme.colorScheme === 'light' ? '#0f172a' : '#f8fafc'
  const isMobile = useMediaQuery('(max-width: 640px)')

  useEffect(() => {
    setImageError(false)
  }, [exercise.catalogId])

  useEffect(() => {
    commentRef.current = comment
  }, [comment])

  useEffect(() => {
    const incoming = exercise.comment || ''
    if (incoming !== commentRef.current) {
      setComment(incoming)
      commentRef.current = incoming
    }
  }, [exercise.comment])

  const commitComment = useCallback(() => {
    const trimmed = commentRef.current.trim()
    const baseline = (exercise.comment || '').trim()
    if (trimmed !== baseline) {
      updateExercise(exercise.id, { comment: trimmed })
    }
  }, [exercise.comment, exercise.id, updateExercise])

  const flushCommentTimeout = useCallback(() => {
    if (pendingCommentTimeout.current) {
      globalThis.clearTimeout(pendingCommentTimeout.current)
      pendingCommentTimeout.current = null
    }
  }, [])

  const scheduleCommentCommit = useCallback(() => {
    flushCommentTimeout()
    pendingCommentTimeout.current = globalThis.setTimeout(() => {
      pendingCommentTimeout.current = null
      commitComment()
    }, NOTE_COMMIT_DELAY_MS)
  }, [commitComment, flushCommentTimeout])

  useEffect(() => {
    return () => {
      flushCommentTimeout()
    }
  }, [flushCommentTimeout])

  const handleCommentChange = useCallback(
    (value: string) => {
      setComment(value)
      commentRef.current = value
      scheduleCommentCommit()
    },
    [scheduleCommentCommit]
  )

  async function onDelete() {
    if (dayLoading) return
    deleteExercise(exercise.id)
  }

  const handleAddSet = () => {
    if (dayLoading) return
    addSet(exercise.id)
  }

  const handleAddRest = () => {
    if (dayLoading) return
    addRest(exercise.id)
  }

  return (
    <>
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
        <Group justify="space-between" align="center" wrap="nowrap" gap="md">
          <Group align="center" gap="md" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
            {exercise.catalogId && !imageError && (
              <div style={{ width: 56, height: 56, borderRadius: 12, overflow: 'hidden', border: `1px solid ${surfaces.border}`, flexShrink: 0, background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img
                  src={`${import.meta.env.VITE_API_BASE_URL || ''}/api/catalog/entries/${exercise.catalogId}/image`}
                  alt={exercise.name}
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  onError={() => {
                    setImageError(true)
                  }}
                />
              </div>
            )}

            <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
              <Group gap="xs" align="center" wrap="nowrap">
                <Title 
                  order={4} 
                  style={{ 
                    margin: 0,
                    cursor: exercise.catalogId ? 'pointer' : 'default'
                  }}
                  onClick={exercise.catalogId ? () => navigate(`/catalog/${exercise.catalogId}/details`) : undefined}
                  onTouchEnd={exercise.catalogId ? (e) => {
                    const target = e.target as HTMLElement
                    if (target.closest('button, [role="button"], a')) {
                      return
                    }
                    e.preventDefault()
                    navigate(`/catalog/${exercise.catalogId}/details`)
                  } : undefined}
                >
                  {exercise.name}
                </Title>
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
                      onChange={(e) => handleCommentChange(e.currentTarget.value)}
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
          <Group gap="sm" wrap="nowrap" style={{ flexShrink: 0 }}>
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
            </Group>

            <Divider style={{ borderColor: surfaces.border, opacity: 0.6 }} />

            <Group justify="space-between" align="center" wrap="wrap" gap="sm">
              <Title order={5}>Sets & Rest</Title>
              <Group gap="sm">
                <Button
                  onClick={handleAddSet}
                  disabled={isRestDay || dayLoading}
                  leftSection={<IconPlus size={16} />}
                  style={{
                    backgroundImage: accentGradient,
                    color: primaryText,
                    border: 'none'
                  }}
                >
                  Add Set
                </Button>
            <Button
              variant="light"
              onClick={handleAddRest}
              disabled={isRestDay || dayLoading}
              leftSection={<IconMoonStars size={16} />}
            >
              Add Rest
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
      </>
      )
    }
