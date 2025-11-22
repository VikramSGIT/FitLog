import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, CatalogItem } from '@/api/client'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import {
  ActionIcon,
  Badge,
  Button,
  Card,
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
  IconPlus,
  IconArrowUpRight,
  IconBarbell,
  IconX,
  IconAdjustments,
  IconArrowLeft,
  IconPencil
} from '@tabler/icons-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useMediaQuery } from '@mantine/hooks'
import { DEFAULT_SURFACES, ThemeSurfaces } from '@/theme'

type CatalogBrowserProps = {
  embedded?: boolean
  onClose?: () => void
  headerAddon?: React.ReactNode
}

const toSelectOptions = (values: string[]) => values.map((value) => ({ value, label: value }))

export default function CatalogBrowser({ embedded = false, onClose, headerAddon }: CatalogBrowserProps) {
  const day = useWorkoutStore((s) => s.day)
  const queueCreateExercise = useWorkoutStore((s) => s.queueCreateExercise)
  const dayLoading = useWorkoutStore((s) => s.dayLoading)
  const isRestDay = day?.isRestDay ?? false
  const navigate = useNavigate()
  const theme = useMantineTheme()
  const isMobile = useMediaQuery('(max-width: 640px)')
  const surfaces = (theme.other?.surfaces as ThemeSurfaces) ?? DEFAULT_SURFACES
  const accentGradient = (theme.other?.accentGradient as string) ?? 'linear-gradient(135deg, #8f5afc 0%, #5197ff 100%)'
  const buttonTextColor = '#0f172a'
  const baseTextColor =
    (theme.other?.textColor as string) ?? (theme.colorScheme === 'light' ? '#0f172a' : '#f8fafc')
  const [facets, setFacets] = useState<{ types: string[]; bodyParts: string[]; equipment: string[]; levels: string[]; muscles: string[] }>({
    types: [],
    bodyParts: [],
    equipment: [],
    levels: [],
    muscles: []
  })
  const [searchParams, setSearchParams] = useSearchParams()
  const getInitial = (key: string, fallback = '') =>
    embedded ? fallback : (searchParams.get(key) || fallback)
  const getInitialNumber = (key: string, fallback: number) => {
    if (embedded) return fallback
    const str = searchParams.get(key)
    const num = str ? Number(str) : NaN
    return Number.isNaN(num) || num <= 0 ? fallback : num
  }
  const [q, setQ] = useState(getInitial('q'))
  const [type, setType] = useState(getInitial('type'))
  const [bodyPart, setBodyPart] = useState(getInitial('bodyPart'))
  const [equipment, setEquipment] = useState(getInitial('equipment'))
  const [level, setLevel] = useState(getInitial('level'))
  const [muscle, setMuscle] = useState(getInitial('muscle'))
  const [page, setPage] = useState(getInitialNumber('page', 1))
  const [pageSize] = useState(getInitialNumber('pageSize', embedded ? 10 : 20))
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<CatalogItem[]>([])
  const [total, setTotal] = useState(0)
  const [showFilters, setShowFilters] = useState(false)
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set())

  useEffect(() => {
    api.getCatalogFacets()
      .then((res) => {
        setFacets({
          types: Array.isArray((res as any).types) ? (res as any).types : [],
          bodyParts: Array.isArray((res as any).bodyParts) ? (res as any).bodyParts : [],
          equipment: Array.isArray((res as any).equipment) ? (res as any).equipment : [],
          levels: Array.isArray((res as any).levels) ? (res as any).levels : [],
          muscles: Array.isArray((res as any).muscles) ? (res as any).muscles : []
        })
      })
      .catch(() => setFacets({ types: [], bodyParts: [], equipment: [], levels: [], muscles: [] }))
  }, [])

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true)
      const next = new URLSearchParams()
      if (q) next.set('q', q)
      if (type) next.set('type', type)
      if (bodyPart) next.set('bodyPart', bodyPart)
      if (equipment) next.set('equipment', equipment)
      if (level) next.set('level', level)
      if (muscle) next.set('muscle', muscle)
      next.set('page', String(page))
      next.set('pageSize', String(pageSize))
      if (!embedded) {
        setSearchParams(next)
      }
      api
        .searchCatalog({ q, type, bodyPart, equipment, level, muscle, page, pageSize, sort: 'name_asc' })
        .then((res) => {
          const safeItems = Array.isArray((res as any).items) ? (res as any).items : []
          setItems(safeItems as CatalogItem[])
          setTotal(typeof (res as any).total === 'number' ? (res as any).total : 0)
        })
        .catch(() => {
          setItems([])
          setTotal(0)
        })
        .finally(() => setLoading(false))
    }, 400)
    return () => clearTimeout(t)
  }, [q, type, bodyPart, equipment, level, muscle, page, pageSize, setSearchParams])

  const canAddToDay = !!day && !dayLoading && !isRestDay
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  async function addToDay(item: CatalogItem) {
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

  function handleEdit(itemId: string) {
    if (embedded) {
      onClose?.()
    }
    navigate(`/catalog/${itemId}/edit`)
  }

  const cards = (
    <AnimatePresence initial={false}>
      {(Array.isArray(items) ? items : []).map((it) => (
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
            style={{
              backdropFilter: 'none',
              background: surfaces.card,
              borderColor: surfaces.border
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {it.hasImage && !imageErrors.has(it.id) && (
                  <div style={{ width: 56, height: 56, borderRadius: 12, overflow: 'hidden', border: `1px solid ${surfaces.border}`, flexShrink: 0, background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img
                      src={`${import.meta.env.VITE_API_BASE_URL || ''}/api/catalog/entries/${it.id}/image`}
                      alt={it.name}
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                      onError={() => {
                        setImageErrors((prev) => new Set(prev).add(it.id))
                      }}
                    />
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 2 : 4, minWidth: 0 }}>
                  <Text fw={600} style={{ whiteSpace: 'normal', overflow: 'visible', textOverflow: 'clip', lineHeight: 1.2 }}>
                    {it.name}
                  </Text>
                  <Group gap={6} wrap="wrap" style={{ minWidth: 0, overflow: 'hidden' }}>
                    {it.type && (
                      <Badge size={isMobile ? 'xs' : 'sm'} color={theme.primaryColor} variant="light">
                        {it.type}
                      </Badge>
                    )}
                    {it.bodyPart && (
                      <Badge size={isMobile ? 'xs' : 'sm'} color="blue" variant="light">
                        {it.bodyPart}
                      </Badge>
                    )}
                    {it.equipment && (
                      <Badge size={isMobile ? 'xs' : 'sm'} color="grape" variant="light">
                        {it.equipment}
                      </Badge>
                    )}
                    {it.level && (
                      <Badge size={isMobile ? 'xs' : 'sm'} color="cyan" variant="light">
                        {it.level}
                      </Badge>
                    )}
                  </Group>
                </div>
              </div>
                  <Group gap={isMobile ? 8 : 'sm'} justify="flex-end">
                    {isMobile ? (
                      <>
                        <ActionIcon
                          size="lg"
                          radius="md"
                          aria-label="Edit catalog exercise"
                          onClick={() => handleEdit(it.id)}
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
                          onClick={() => addToDay(it)}
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
                          onClick={() => handleEdit(it.id)}
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
                          onClick={() => addToDay(it)}
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
                background: theme.colorScheme === 'light' ? '#ffffff' : surfaces.card,
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
              background: (q || type || bodyPart || equipment || level || muscle) ? undefined : (theme.colorScheme === 'light' ? '#ffffff' : surfaces.card),
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

