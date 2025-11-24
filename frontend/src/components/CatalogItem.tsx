import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, CatalogItem } from '@/api'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import { ActionIcon, Badge, Button, Card, Group, Text, useMantineTheme } from '@mantine/core'
import { IconPlus, IconPencil } from '@tabler/icons-react'
import { motion } from 'framer-motion'
import { useMediaQuery } from '@mantine/hooks'
import { DEFAULT_SURFACES, ThemeSurfaces, useThemePreset } from '@/theme'

type CatalogItemProps = {
  item: CatalogItem
  embedded: boolean
  onClose?: () => void
}

export default function CatalogItemCard({ item, embedded, onClose }: CatalogItemProps) {
  const day = useWorkoutStore((s) => s.day)
  const queueCreateExercise = useWorkoutStore((s) => s.queueCreateExercise)
  const dayLoading = useWorkoutStore((s) => s.dayLoading)
  const isRestDay = day?.isRestDay ?? false
  const navigate = useNavigate()
  const theme = useMantineTheme()
  const { preset } = useThemePreset()
  const isMobile = useMediaQuery('(max-width: 640px)')
  const surfaces = (theme.other?.surfaces as ThemeSurfaces) ?? DEFAULT_SURFACES
  const accentGradient = (theme.other?.accentGradient as string) ?? 'linear-gradient(135deg, #8f5afc 0%, #5197ff 100%)'
  const buttonTextColor = '#0f172a'
  const baseTextColor =
    (theme.other?.textColor as string) ?? (preset.colorScheme === 'light' ? '#0f172a' : '#f8fafc')
  const [imageError, setImageError] = useState(false)

  const canAddToDay = !!day && !dayLoading && !isRestDay

  async function addToDay() {
    if (!day) {
      alert('Pick a day first on the home page.')
      return
    }
    if (dayLoading) {
      alert('Please wait for the day to finish loading before adding exercises.')
      return
    }
    if (day.isRestDay) {
      alert('This day is marked as a rest day. Switch back to a training day to add exercises.')
      return
    }
    const exercises = Array.isArray(day.exercises) ? day.exercises : []
    const position = (exercises[exercises.length - 1]?.position ?? 0) + 1
    queueCreateExercise({ dayId: day.id, catalogId: item.id, nameDisplay: item.name, position })
    if (embedded) {
      onClose?.()
    }
  }

  function handleEdit() {
    if (embedded) {
      onClose?.()
    }
    navigate(`/catalog/${item.id}/edit`)
  }

  return (
    <motion.div
      key={item.id}
      role="listitem"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        withBorder
        radius={isMobile ? 'md' : 'lg'}
        padding={isMobile ? 'sm' : 'lg'}
        onClick={embedded ? undefined : (e) => {
          // Only navigate if click is not on an interactive element
          const target = e.target as HTMLElement
          if (target.closest('button, [role="button"], a')) {
            return
          }
          navigate(`/catalog/${item.id}/details`)
        }}
        onTouchEnd={embedded ? undefined : (e) => {
          // Only navigate if touch is not on an interactive element
          const target = e.target as HTMLElement
          if (target.closest('button, [role="button"], a')) {
            return
          }
          e.preventDefault()
          navigate(`/catalog/${item.id}/details`)
        }}
        style={{
          backdropFilter: 'none',
          background: surfaces.card,
          borderColor: surfaces.border,
          cursor: embedded ? 'default' : 'pointer',
          pointerEvents: 'auto',
          userSelect: 'none',
          WebkitUserSelect: 'none'
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr) auto',
            alignItems: 'center',
            gap: isMobile ? 6 : 8,
            width: '100%'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'none' }}>
            {item.hasImage && !imageError && (
              <div style={{ width: 56, height: 56, borderRadius: 12, overflow: 'hidden', border: `1px solid ${surfaces.border}`, flexShrink: 0, background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <img
                  src={`${import.meta.env.VITE_API_BASE_URL || ''}/api/catalog/entries/${item.id}/image`}
                  alt={item.name}
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', pointerEvents: 'none' }}
                  onError={() => {
                    setImageError(true)
                  }}
                />
              </div>
            )}

            <div
              style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 2 : 4, minWidth: 0, flex: 1, pointerEvents: 'none' }}
            >
              <Text fw={600} style={{ whiteSpace: 'normal', overflow: 'visible', textOverflow: 'clip', lineHeight: 1.2, pointerEvents: 'none' }}>
                {item.name}
              </Text>
              <Group 
                gap={6} 
                wrap="wrap" 
                style={{ minWidth: 0, overflow: 'hidden', pointerEvents: 'none' }}
              >
                {item.type && (
                  <Badge size={isMobile ? 'xs' : 'sm'} color={theme.primaryColor} variant="light" style={{ pointerEvents: 'none' }}>
                    {item.type}
                  </Badge>
                )}
                {item.bodyPart && (
                  <Badge size={isMobile ? 'xs' : 'sm'} color="blue" variant="light" style={{ pointerEvents: 'none' }}>
                    {item.bodyPart}
                  </Badge>
                )}
                {item.equipment && (
                  <Badge size={isMobile ? 'xs' : 'sm'} color="grape" variant="light" style={{ pointerEvents: 'none' }}>
                    {item.equipment}
                  </Badge>
                )}
                {item.level && (
                  <Badge size={isMobile ? 'xs' : 'sm'} color="cyan" variant="light" style={{ pointerEvents: 'none' }}>
                    {item.level}
                  </Badge>
                )}
              </Group>
            </div>
          </div>
              <Group gap={isMobile ? 8 : 'sm'} justify="flex-end" onClick={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
                {isMobile ? (
                  <>
                    <ActionIcon
                      size="lg"
                      radius="md"
                      aria-label="Edit catalog exercise"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEdit()
                      }}
                      style={{
                        background: preset.colorScheme === 'light' ? '#ffffff' : surfaces.card,
                        border: `1px solid ${surfaces.border}`,
                        color: baseTextColor
                      }}
                    >
                      <IconPencil size={18} />
                    </ActionIcon>
                    <ActionIcon
                      size="lg"
                      radius="md"
                      aria-label="Add to day"
                      onClick={(e) => {
                        e.stopPropagation()
                        addToDay()
                      }}
                      disabled={!canAddToDay}
                      style={{
                        backgroundImage: accentGradient,
                        color: buttonTextColor,
                        border: 'none'
                      }}
                    >
                      <IconPlus size={18} />
                    </ActionIcon>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      leftSection={<IconPencil size={18} />}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEdit()
                      }}
                      style={{
                        background: surfaces.card,
                        border: `1px solid ${surfaces.border}`,
                        color: baseTextColor
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      leftSection={<IconPlus size={18} />}
                      onClick={(e) => {
                        e.stopPropagation()
                        addToDay()
                      }}
                      disabled={!canAddToDay}
                      style={{
                        backgroundImage: accentGradient,
                        color: buttonTextColor,
                        border: 'none'
                      }}
                    >
                      {isRestDay ? 'Rest day' : dayLoading ? 'Loading...' : 'Add to day'}
                    </Button>
                  </>
                )}
              </Group>
        </div>
      </Card>
    </motion.div>
  )
}
