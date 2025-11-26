import React from 'react'
import { ActionIcon, Badge, Button, Card, Group, Text, useMantineTheme } from '@mantine/core'
import { IconPencil, IconPlus } from '@tabler/icons-react'
import { motion, AnimatePresence } from 'framer-motion'
import { CatalogItem } from '@/api/client'
import { ThemeSurfaces } from '@/theme'

type CatalogListProps = {
  items: CatalogItem[]
  isMobile: boolean
  embedded: boolean
  navigate: (path: string) => void
  handleEdit: (id: string) => void
  addToDay: (item: CatalogItem) => void
  canAddToDay: boolean
  isRestDay: boolean
  dayLoading: boolean
  surfaces: ThemeSurfaces
  baseTextColor: string
  accentGradient: string
  imageErrors: Set<string>
  setImageErrors: React.Dispatch<React.SetStateAction<Set<string>>>
  onClose?: () => void
}

export function CatalogList({
  items,
  isMobile,
  embedded,
  navigate,
  handleEdit,
  addToDay,
  canAddToDay,
  isRestDay,
  dayLoading,
  surfaces,
  baseTextColor,
  accentGradient,
  imageErrors,
  setImageErrors,
  onClose
}: CatalogListProps) {
  const theme = useMantineTheme()
  const buttonTextColor = '#0f172a'

  return (
    <AnimatePresence initial={false}>
      {items.map((it) => (
        <motion.div
          key={it.id}
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
              const target = e.target as HTMLElement
              if (target.closest('button, [role="button"], a')) return
              navigate(`/catalog/${it.id}/details`)
            }}
            onTouchEnd={embedded ? undefined : (e) => {
              const target = e.target as HTMLElement
              if (target.closest('button, [role="button"], a')) return
              e.preventDefault()
              navigate(`/catalog/${it.id}/details`)
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
                {it.hasImage && !imageErrors.has(it.id) && (
                  <div style={{ width: 56, height: 56, borderRadius: 12, overflow: 'hidden', border: `1px solid ${surfaces.border}`, flexShrink: 0, background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <img
                      src={`${import.meta.env.VITE_API_BASE_URL || ''}/api/catalog/entries/${it.id}/image`}
                      alt={it.name}
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', pointerEvents: 'none' }}
                      onError={() => {
                        setImageErrors((prev) => new Set(prev).add(it.id))
                      }}
                    />
                  </div>
                )}

                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 2 : 4, minWidth: 0, flex: 1, pointerEvents: 'none' }}
                >
                  <Text fw={600} style={{ whiteSpace: 'normal', overflow: 'visible', textOverflow: 'clip', lineHeight: 1.2, pointerEvents: 'none' }}>
                    {it.name}
                  </Text>
                  <Group 
                    gap={6} 
                    wrap="wrap" 
                    style={{ minWidth: 0, overflow: 'hidden', pointerEvents: 'none' }}
                  >
                    {it.type && (
                      <Badge size={isMobile ? 'xs' : 'sm'} color={theme.primaryColor} variant="light" style={{ pointerEvents: 'none' }}>
                        {it.type}
                      </Badge>
                    )}
                    {it.bodyPart && (
                      <Badge size={isMobile ? 'xs' : 'sm'} color="blue" variant="light" style={{ pointerEvents: 'none' }}>
                        {it.bodyPart}
                      </Badge>
                    )}
                    {it.equipment && (
                      <Badge size={isMobile ? 'xs' : 'sm'} color="grape" variant="light" style={{ pointerEvents: 'none' }}>
                        {it.equipment}
                      </Badge>
                    )}
                    {it.level && (
                      <Badge size={isMobile ? 'xs' : 'sm'} color="cyan" variant="light" style={{ pointerEvents: 'none' }}>
                        {it.level}
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
                        handleEdit(it.id)
                      }}
                      style={{
                        background: theme.colorScheme === 'light' ? '#ffffff' : surfaces.card,
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
                        addToDay(it)
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
                        handleEdit(it.id)
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
                        addToDay(it)
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
      ))}
    </AnimatePresence>
  )
}
