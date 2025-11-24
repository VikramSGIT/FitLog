import React, { useMemo, useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { api } from '@/api/client'
import { Exercise } from '@/db/schema'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import SetList from './SetList'
import { useAutoSave } from '@/hooks/useAutoSave'
import { ActionIcon, Badge, Button, Card, Divider, Group, Stack, Text, Title, Textarea, Tooltip, useMantineTheme } from '@mantine/core'
import { IconPlus, IconTrash, IconNote, IconMoonStars } from '@tabler/icons-react'
import { DEFAULT_SURFACES, ThemeSurfaces } from '@/theme'
import { AUTO_SAVE_DELAY_MS } from '@/config'
import { useMediaQuery } from '@mantine/hooks'

const DEFAULT_REST_DURATION_SECONDS = 90

export default function ExerciseItem({ exercise }: { exercise: Exercise }) {
  const navigate = useNavigate()
  const { updateExercise, deleteExercise, addSet, activeDay, isLoading: dayLoading, sets } = useWorkoutStore()
  const isRestDay = activeDay?.isRestDay ?? false
  const [comment, setComment] = useState(exercise.comment || '')
  const [showNote, setShowNote] = useState<boolean>(() => (exercise.comment || '').trim().length > 0)
  const [imageError, setImageError] = useState(false)
  const theme = useMantineTheme()
  const surfaces = (theme.other?.surfaces as ThemeSurfaces) ?? DEFAULT_SURFACES
  const accentGradient = (theme.other?.accentGradient as string) ?? 'linear-gradient(135deg, #8f5afc 0%, #5197ff 100%)'
  const primaryText = theme.colorScheme === 'light' ? '#0f172a' : '#f8fafc'
  const isMobile = useMediaQuery('(max-width: 640px)')

  // Check if exercise or any of its sets are unsynced
  const exerciseSets = sets.filter(s => exercise.id)
  const hasUnsyncedSets = exerciseSets.some(s => s.isSynced === true)
  const isUnsaved = exercise.isSynced === true || hasUnsyncedSets

  const saveComment = useCallback(async (value: string) => {
    if ((exercise.comment || '') !== value) {
      updateExercise(exercise.id, { comment: value })
      return true
    }
    return false
  }, [exercise.id, exercise.comment, updateExercise])
  useAutoSave(comment, saveComment, AUTO_SAVE_DELAY_MS)

  useEffect(() => {
    setImageError(false)
  }, [exercise.catalogId])

  async function onDelete() {
    if (dayLoading) return
    deleteExercise(exercise.id)
  }

  const handleAddSet = () => {
    if (dayLoading) return
    addSet(exercise.id)
  }

  // addRest is not implemented in the new store yet
  async function addRest() {
    // if (dayLoading) return
    // useWorkoutStore.getState().queueCreateRest(exercise.id, {
    //   position: nextRestPosition,
    //   durationSeconds: DEFAULT_REST_DURATION_SECONDS
    // })
  }

  return (
    <>
      {isUnsaved && (
        <style>{`
          @keyframes redGlow {
            0%, 100% {
              box-shadow: 0 0 0 1px rgba(239, 68, 68, 0.3), 0 0 20px rgba(239, 68, 68, 0.2), 0 0 40px rgba(239, 68, 68, 0.1);
            }
            50% {
              box-shadow: 0 0 0 1px rgba(239, 68, 68, 0.5), 0 0 30px rgba(239, 68, 68, 0.4), 0 0 60px rgba(239, 68, 68, 0.2);
            }
          }
        `}</style>
      )}
      <Card
        withBorder
        radius="lg"
        padding="lg"
        style={{
          background: surfaces.card,
          borderColor: isUnsaved ? '#ef4444' : surfaces.border,
          backdropFilter: 'none',
          animation: isUnsaved ? 'redGlow 2s ease-in-out infinite' : undefined
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
                {isUnsaved && !isMobile && (
                  <Text size="sm" c="red" fw={500} style={{ opacity: 0.9 }}>
                    (unsaved)
                  </Text>
                )}
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
