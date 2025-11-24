import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCatalogSearch } from '@/hooks/useCatalogSearch'
import CatalogItemCard from './CatalogItem'
import {
  ActionIcon,
  Badge,
  Group,
  Loader,
  Pagination,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
  useMantineTheme
} from '@mantine/core'
import {
  IconSearch,
  IconArrowLeft,
  IconAdjustments,
  IconX,
  IconBarbell
} from '@tabler/icons-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useMediaQuery } from '@mantine/hooks'
import { DEFAULT_SURFACES, ThemeSurfaces, useThemePreset } from '@/theme'

type CatalogBrowserProps = {
  embedded?: boolean
  onClose?: () => void
  headerAddon?: React.ReactNode
}

const toSelectOptions = (values: string[]) => values.map((value) => ({ value, label: value }))

export default function CatalogBrowser({ embedded = false, onClose, headerAddon }: CatalogBrowserProps) {
  const navigate = useNavigate()
  const theme = useMantineTheme()
  const { preset } = useThemePreset()
  const isMobile = useMediaQuery('(max-width: 640px)')
  const surfaces = (theme.other?.surfaces as ThemeSurfaces) ?? DEFAULT_SURFACES
  const accentGradient = (theme.other?.accentGradient as string) ?? 'linear-gradient(135deg, #8f5afc 0%, #5197ff 100%)'
  const buttonTextColor = '#0f172a'
  const baseTextColor =
    (theme.other?.textColor as string) ?? (preset.colorScheme === 'light' ? '#0f172a' : '#f8fafc')
  
  const {
    q, setQ,
    type, setType,
    bodyPart, setBodyPart,
    equipment, setEquipment,
    level, setLevel,
    muscle, setMuscle,
    page, setPage,
    pageSize,
    loading,
    items,
    total,
    facets,
  } = useCatalogSearch(embedded)
  
  const [showFilters, setShowFilters] = useState(false)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const cards = (
    <AnimatePresence initial={false}>
      {items.map((item) => (
        <CatalogItemCard key={item.id} item={item} embedded={embedded} onClose={onClose} />
      ))}
    </AnimatePresence>
  )

  return (
    <Stack
      gap="lg"
      style={
        embedded || isMobile
          ? {
              height: '100%',
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              overflow: 'hidden',
              background: embedded ? surfaces.panel : undefined,
              padding: embedded ? '16px 24px 24px' : (isMobile ? '16px 16px 24px' : undefined),
              gap: embedded ? 16 : undefined
            }
          : undefined
      }
    >
      {!embedded && !isMobile && (
        <Stack gap={6}>
          <Group justify="space-between" align="center">
            <Title order={2} style={{ margin: 0 }}>
              Exercise catalog
            </Title>
            {headerAddon}
          </Group>
          <Text size="sm" c="dimmed">
            Search thousands of movements by muscle group, equipment, or difficulty.
          </Text>
        </Stack>
      )}

      <Stack gap="sm" style={embedded || isMobile ? { padding: 0 } : undefined}>
        <Group justify="space-between" align="center" wrap="nowrap" gap="sm" style={{ marginTop: embedded || isMobile ? 0 : 8 }}>
          {(embedded || isMobile) && (
            <ActionIcon
              variant="outline"
              color={theme.primaryColor}
              radius="md"
              size="lg"
              onClick={() => {
                if (embedded) {
                  onClose?.()
                } else if (isMobile) {
                  navigate('/')
                }
              }}
              aria-label="Back"
            >
              <IconArrowLeft size={18} />
            </ActionIcon>
          )}
          <TextInput
            placeholder="Search exercises, muscles, equipment..."
            value={q}
            onChange={(e) => {
              setQ(e.currentTarget.value)
              setPage(1)
            }}
            leftSection={<IconSearch size={16} />}
            size="lg"
            radius="md"
            variant="filled"
            style={{ flex: 1 }}
            styles={{
              input: {
                background: preset.colorScheme === 'light' ? '#ffffff' : surfaces.card,
                borderColor: surfaces.border,
                color: baseTextColor
              }
            }}
          />
          {isMobile && !embedded && headerAddon && (
            <div>{headerAddon}</div>
          )}
          <ActionIcon
            size="xl"
            radius="md"
            onClick={() => setShowFilters((v) => !v)}
            aria-label="Toggle filters"
            style={{
              backgroundImage: (q || type || bodyPart || equipment || level || muscle) ? accentGradient : 'none',
              background: (q || type || bodyPart || equipment || level || muscle) ? undefined : (preset.colorScheme === 'light' ? '#ffffff' : surfaces.card),
              border: `1px solid ${surfaces.border}`,
              color: (q || type || bodyPart || equipment || level || muscle) ? buttonTextColor : baseTextColor
            }}
          >
            <IconAdjustments size={20} />
          </ActionIcon>
        </Group>

        {(q || type || bodyPart || equipment || level || muscle) && (
          <Group gap={8} wrap="wrap" style={{ marginTop: 8 }}>
            {q && (
              <Badge
                variant="light"
                radius={0}
                rightSection={
                  <IconX
                    size={12}
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      setQ('')
                      setPage(1)
                    }}
                  />
                }
                styles={{
                  root: {
                    background: 'rgba(99,102,241,0.12)',
                    border: '1px solid transparent',
                    color: baseTextColor
                  }
                }}
              >
                Search: {q}
              </Badge>
            )}
            {type && (
              <Badge
                variant="light"
                radius={0}
                rightSection={
                  <IconX
                    size={12}
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      setType('')
                      setPage(1)
                    }}
                  />
                }
                styles={{ root: { background: 'rgba(99,102,241,0.12)', color: baseTextColor } }}
              >
                Type: {type}
              </Badge>
            )}
            {bodyPart && (
              <Badge
                variant="light"
                radius={0}
                rightSection={
                  <IconX
                    size={12}
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      setBodyPart('')
                      setPage(1)
                    }}
                  />
                }
                styles={{ root: { background: 'rgba(59,130,246,0.12)', color: baseTextColor } }}
              >
                Body: {bodyPart}
              </Badge>
            )}
            {equipment && (
              <Badge
                variant="light"
                radius={0}
                rightSection={
                  <IconX
                    size={12}
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      setEquipment('')
                      setPage(1)
                    }}
                  />
                }
                styles={{ root: { background: 'rgba(147,51,234,0.12)', color: baseTextColor } }}
              >
                Equipment: {equipment}
              </Badge>
            )}
            {level && (
              <Badge
                variant="light"
                radius={0}
                rightSection={
                  <IconX
                    size={12}
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      setLevel('')
                      setPage(1)
                    }}
                  />
                }
                styles={{ root: { background: 'rgba(8,145,178,0.12)', color: baseTextColor } }}
              >
                Level: {level}
              </Badge>
            )}
            {muscle && (
              <Badge
                variant="light"
                radius={0}
                rightSection={
                  <IconX
                    size={12}
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      setMuscle('')
                      setPage(1)
                    }}
                  />
                }
                styles={{ root: { background: 'rgba(99,102,241,0.12)', color: baseTextColor } }}
              >
                Muscle: {muscle}
              </Badge>
            )}
          </Group>
        )}

        <AnimatePresence initial={false}>
          {showFilters && (
            <motion.div
              key="filters"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 240, damping: 24, mass: 0.6 }}
            >
              <SimpleGrid cols={{ base: 2, sm: 3, lg: embedded ? 3 : 5 }} spacing="sm">
          <Select
            data={toSelectOptions(facets.types)}
            placeholder="Type"
            value={type}
            onChange={(value) => {
              setType(value || '')
              setPage(1)
            }}
            clearable
            size="sm"
            radius={0}
            checkIconPosition="right"
            variant="filled"
            styles={{
              input: {
                background: 'rgba(99,102,241,0.12)', // primary (indigo) like facet
                borderColor: 'transparent',
                color: baseTextColor,
                borderRadius: 0
              }
            }}
          />
          <Select
            data={toSelectOptions(facets.bodyParts)}
            placeholder="Body part"
            value={bodyPart}
            onChange={(value) => {
              setBodyPart(value || '')
              setPage(1)
            }}
            clearable
            size="sm"
            radius={0}
            checkIconPosition="right"
            variant="filled"
            styles={{
              input: {
                background: 'rgba(59,130,246,0.12)', // blue
                borderColor: 'transparent',
                color: baseTextColor,
                borderRadius: 0
              }
            }}
          />
          <Select
            data={toSelectOptions(facets.equipment)}
            placeholder="Equipment"
            value={equipment}
            onChange={(value) => {
              setEquipment(value || '')
              setPage(1)
            }}
            clearable
            size="sm"
            radius={0}
            checkIconPosition="right"
            variant="filled"
            styles={{
              input: {
                background: 'rgba(147,51,234,0.12)', // grape
                borderColor: 'transparent',
                color: baseTextColor,
                borderRadius: 0
              }
            }}
          />
          <Select
            data={toSelectOptions(facets.levels)}
            placeholder="Level"
            value={level}
            onChange={(value) => {
              setLevel(value || '')
              setPage(1)
            }}
            clearable
            size="sm"
            radius={0}
            checkIconPosition="right"
            variant="filled"
            styles={{
              input: {
                background: 'rgba(8,145,178,0.12)', // cyan
                borderColor: 'transparent',
                color: baseTextColor,
                borderRadius: 0
              }
            }}
          />
          <Select
            data={toSelectOptions(facets.muscles)}
            placeholder="Muscle"
            value={muscle}
            onChange={(value) => {
              setMuscle(value || '')
              setPage(1)
            }}
            clearable
            size="sm"
            radius={0}
            checkIconPosition="right"
            variant="filled"
            styles={{
              input: {
                background: 'rgba(99,102,241,0.12)',
                borderColor: 'transparent',
                color: baseTextColor,
                borderRadius: 0
              }
            }}
          />
              </SimpleGrid>
            </motion.div>
          )}
        </AnimatePresence>

      </Stack>

      <Group justify="space-between" align="center" wrap="wrap">
        <Group gap={6}>
          {loading && <Loader size="sm" color={theme.primaryColor} />}
          <Text size="sm" c="dimmed">
            {loading ? 'Loading results...' : total ? `${total} results` : 'No results'}
          </Text>
        </Group>
        <Pagination
          value={page}
          onChange={setPage}
          total={totalPages}
          color={theme.primaryColor}
          radius="md"
          size="sm"
        />
      </Group>

      {items.length === 0 && !loading ? (
        <Paper
          withBorder
          radius="lg"
          p="xl"
          style={{
            backdropFilter: 'blur(6px)',
            borderColor: surfaces.border
          }}
        >
          <Stack align="center" gap="sm">
            <IconBarbell size={28} color="var(--mantine-color-primary-4)" />
            <Text fw={500}>No matches yet</Text>
            <Text size="sm" c="dimmed" ta="center">
              Try adjusting your filters or search for a different keyword.
            </Text>
          </Stack>
        </Paper>
      ) : embedded || isMobile ? (
        <ScrollArea.Autosize
          type="hover"
          scrollbarSize={0}
          mah="100dvh"
          style={{ flex: 1, minHeight: 0 }}
          offsetScrollbars
        >
          <div role="list" style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 12 }}>
            {cards}
            </div>
        </ScrollArea.Autosize>
      ) : (
        <ScrollArea type="hover" scrollbarSize={0} styles={{ viewport: { maskImage: 'linear-gradient(to bottom, transparent, #000 12px, #000 calc(100% - 12px), transparent)' } }}>
          <div role="list" style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 12 }}>
            {cards}
          </div>
        </ScrollArea>
      )}
    </Stack>
  )
}

