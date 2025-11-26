import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ActionIcon,
  Button,
  Group,
  Loader,
  Pagination,
  Paper,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Title,
  useMantineTheme
} from '@mantine/core'
import {
  IconSearch,
  IconBarbell,
  IconAdjustments,
  IconArrowLeft,
} from '@tabler/icons-react'
import { useMediaQuery } from '@mantine/hooks'
import { DEFAULT_SURFACES, ThemeSurfaces } from '@/theme'
import { useCatalogData } from '@/hooks/useCatalogData'
import { CatalogFilters } from '@/components/CatalogBrowser/CatalogFilters'
import { CatalogList } from '@/components/CatalogBrowser/CatalogList'

type CatalogBrowserProps = {
  embedded?: boolean
  onClose?: () => void
  headerAddon?: React.ReactNode
}

export default function CatalogBrowser({ embedded = false, onClose, headerAddon }: CatalogBrowserProps) {
  const navigate = useNavigate()
  const theme = useMantineTheme()
  const isMobile = useMediaQuery('(max-width: 640px)')
  const surfaces = (theme.other?.surfaces as ThemeSurfaces) ?? DEFAULT_SURFACES
  const accentGradient = (theme.other?.accentGradient as string) ?? 'linear-gradient(135deg, #8f5afc 0%, #5197ff 100%)'
  const buttonTextColor = '#0f172a'
  const baseTextColor =
    (theme.other?.textColor as string) ?? (theme.colorScheme === 'light' ? '#0f172a' : '#f8fafc')

  const {
    facets,
    q, setQ,
    type, setType,
    bodyPart, setBodyPart,
    equipment, setEquipment,
    level, setLevel,
    muscle, setMuscle,
    page, setPage,
    loading,
    items,
    total,
    showFilters, setShowFilters,
    imageErrors, setImageErrors,
    canAddToDay,
    totalPages,
    addToDay,
    isRestDay,
    dayLoading
  } = useCatalogData(embedded, onClose)

  function handleEdit(itemId: string) {
    if (embedded) {
      onClose?.()
    }
    navigate(`/catalog/${itemId}/edit`)
  }

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

        <CatalogFilters
          q={q} setQ={setQ}
          type={type} setType={setType}
          bodyPart={bodyPart} setBodyPart={setBodyPart}
          equipment={equipment} setEquipment={setEquipment}
          level={level} setLevel={setLevel}
          muscle={muscle} setMuscle={setMuscle}
          setPage={setPage}
          facets={facets}
          showFilters={showFilters}
          baseTextColor={baseTextColor}
          embedded={embedded}
        />
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
            <CatalogList
              items={items}
              isMobile={isMobile || false}
              embedded={embedded}
              navigate={navigate}
              handleEdit={handleEdit}
              addToDay={addToDay}
              canAddToDay={canAddToDay}
              isRestDay={isRestDay}
              dayLoading={dayLoading}
              surfaces={surfaces}
              baseTextColor={baseTextColor}
              accentGradient={accentGradient}
              imageErrors={imageErrors}
              setImageErrors={setImageErrors}
              onClose={onClose}
            />
          </div>
        </ScrollArea.Autosize>
      ) : (
        <ScrollArea type="hover" scrollbarSize={0} styles={{ viewport: { maskImage: 'linear-gradient(to bottom, transparent, #000 12px, #000 calc(100% - 12px), transparent)' } }}>
          <div role="list" style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 12 }}>
            <CatalogList
              items={items}
              isMobile={isMobile || false}
              embedded={embedded}
              navigate={navigate}
              handleEdit={handleEdit}
              addToDay={addToDay}
              canAddToDay={canAddToDay}
              isRestDay={isRestDay}
              dayLoading={dayLoading}
              surfaces={surfaces}
              baseTextColor={baseTextColor}
              accentGradient={accentGradient}
              imageErrors={imageErrors}
              setImageErrors={setImageErrors}
              onClose={onClose}
            />
          </div>
        </ScrollArea>
      )}
    </Stack>
  )
}