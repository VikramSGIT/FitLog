import React, { useState } from 'react'
import { Box, Button, Group, Menu, Stack, Text, Title, useMantineTheme, ActionIcon, Drawer, Divider } from '@mantine/core'
import { DateInput } from '@mantine/dates'
import {
  IconArrowLeft,
  IconBook2,
  IconCheck,
  IconDeviceFloppy,
  IconLogout,
  IconPalette,
  IconSparkles,
  IconMenu2,
  IconCalendar,
  IconSunHigh,
  IconMoonStars
} from '@tabler/icons-react'
import { useThemePreset } from '@/theme'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import dayjs from 'dayjs'
import { format } from 'date-fns'
import type { SaveMode } from '@/store/useWorkoutStore'
import RevealAction from '@/components/RevealAction'
import { formatDistanceToNow } from 'date-fns'
import { LayoutGroup, motion } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'

export type SavingState = 'idle' | 'saving' | 'saved' | 'error'

type HeaderBarProps = {
  showBack?: boolean
  onBack?: () => void
  onBrowseCatalog: () => void
  onSave: () => void
  saving?: SavingState
  saveMode?: SaveMode | null
  lastSavedAt?: number | null
}

export default function HeaderBarDesktop({
  showBack,
  onBack,
  onBrowseCatalog,
  onSave,
  saving = 'idle',
  saveMode,
  lastSavedAt,
}: HeaderBarProps) {
  const theme = useMantineTheme()
  const { preset, presets, selectPreset } = useThemePreset()
  const { logout, userId } = useAuth()
  const surfaces = theme.other?.surfaces as any
  const baseTextColor = (theme.other?.textColor as string) ?? (preset.colorScheme === 'light' ? '#0f172a' : '#f8fafc')
  const mutedTextColor =
    (theme.other?.mutedText as string) ?? (preset.colorScheme === 'light' ? 'rgba(15, 23, 42, 0.65)' : 'rgba(226, 232, 240, 0.72)')
  const neutralButtonBackground =
    preset.colorScheme === 'light' ? surfaces?.panel ?? '#ffffff' : surfaces?.card ?? '#0b1020'
  const neutralBorderColor = surfaces?.border ?? 'rgba(148, 163, 184, 0.35)'
  const accentBorderColor =
    theme.colors?.[theme.primaryColor]?.[5] ?? (preset.colorScheme === 'light' ? 'rgba(99, 102, 241, 0.6)' : 'rgba(96, 165, 250, 0.65)')
  const errorBorderColor = preset.colorScheme === 'light' ? 'rgba(248, 113, 113, 0.55)' : 'rgba(248, 113, 113, 0.45)'
  const errorTextColor = preset.colorScheme === 'light' ? '#b91c1c' : '#fecaca'

  const [label, setLabel] = useState<string>('Save')
  const [persistVariant, setPersistVariant] = useState<boolean>(false)
  const {
    activeDay: day,
    isLoading: dayLoading,
    exercises,
    sets,
    deletedDocumentsCount,
    loadDay,
  } = useWorkoutStore()
  const hasPendingChanges =
    day?.isUnsynced ||
    exercises.some(e => e.isUnsynced === true) ||
    sets.some(s => s.isUnsynced === true) ||
    deletedDocumentsCount > 0

  const [restUpdating, setRestUpdating] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = day?.workoutDate
    if (!d) return format(new Date(), 'yyyy-MM-dd')
    return d
  })

  const lastSavedDistance = lastSavedAt ? formatDistanceToNow(lastSavedAt, { addSuffix: true }) : null
  const saveSingleLine =
    saving === 'error'
      ? 'Save failed - tap to retry'
      : saving === 'saving'
      ? label
      : lastSavedDistance
      ? `${saveMode === 'auto' ? 'Auto-saved' : 'Saved'} ${lastSavedDistance}`
      : 'Save'
  const saveHoverLabel = <Text size="sm">{saveSingleLine}</Text>

  const catalogHoverLabel = <Text size="sm">Browse Catalog</Text>
  const themeHoverLabel = <Text size="sm">{preset.label}</Text>
  const logoutHoverLabel = (
    <Group gap={6} align="center">
      <Text size="sm" fw={600}>
        Logout
      </Text>
      {userId && (
        <Text size="sm" c={mutedTextColor}>
          {userId}
        </Text>
      )}
    </Group>
  )

  const onChangePicker = async (value: Date | null) => {
    if (!value) return
    const formatted = format(value, 'yyyy-MM-dd')
    setSelectedDate(formatted)
    await loadDay(formatted)
  }

  const toggleRestDay = async () => {
    if (dayLoading) return
    let currentDay = day
    if (!currentDay) {
      await loadDay(selectedDate)
      currentDay = useWorkoutStore.getState().activeDay
      if (!currentDay) return
    }
    if (!currentDay.isRestDay) {
      const hasExercises = Array.isArray(exercises) && exercises.length > 0
      if (hasExercises) {
        return
      }
    }
    setRestUpdating(true)
    const next = !currentDay.isRestDay
    useWorkoutStore.getState().updateDay(currentDay.tempId, { isRestDay: next })
    setRestUpdating(false)
  }

  return (
    <Box
      style={{
        background: surfaces?.header ?? (preset.colorScheme === 'light' ? '#fff' : '#0b1020'),
        borderBottom: `1px solid ${surfaces?.border ?? 'rgba(148, 163, 184, 0.18)'}`,
        color: baseTextColor,
        position: 'sticky',
        top: 0,
        zIndex: 20
      }}
    >
      <Group justify="space-between" h={60} px={'lg'} align="center" wrap="nowrap">
        <Group gap="sm" wrap="nowrap">
          {showBack && (
            <Button
              variant="outline"
              color={theme.primaryColor}
              radius="md"
              leftSection={<IconArrowLeft size={18} />}
              onClick={onBack}
              styles={{
                root: {
                  background: neutralButtonBackground,
                  border: `1px solid ${accentBorderColor}`,
                  color: baseTextColor,
                  '&:hover': {
                    background: neutralButtonBackground,
                    borderColor: accentBorderColor,
                    color: baseTextColor
                  }
                }
              }}
            >
              Back
            </Button>
          )}
          <Group gap="xs" wrap="nowrap">
            <IconSparkles size={20} color="var(--mantine-color-primary-4)" />
            <Title order={3}>Lift Logger</Title>
          </Group>
        </Group>

        <LayoutGroup>
          <motion.div layout transition={{ type: 'spring', stiffness: 240, damping: 24, mass: 0.6 }}>
            <Group gap="sm" wrap="nowrap">
              <DateInput
                value={selectedDate ? dayjs(selectedDate, 'YYYY-MM-DD').toDate() : null}
                onChange={onChangePicker}
                leftSection={<IconCalendar size={16} />}
                valueFormat="MMM DD, YYYY"
                size="sm"
                radius="md"
                variant="filled"
                disabled={dayLoading}
                styles={{
                  input: {
                    background: neutralButtonBackground,
                    border: `1px solid ${neutralBorderColor}`,
                    color: baseTextColor
                  }
                }}
                style={{ minWidth: 200 }}
              />
              <RevealAction
                icon={day?.isRestDay ? <IconSunHigh size={16} /> : <IconMoonStars size={16} />}
                label={<Text size="sm">{day?.isRestDay ? 'Training Day' : 'Rest Day'}</Text>}
                ariaLabel={day?.isRestDay ? 'Training Day' : 'Rest Day'}
                onClick={toggleRestDay}
                disabled={restUpdating || dayLoading}
                textColor={baseTextColor}
                style={{
                  background: neutralButtonBackground,
                  border: `1px solid ${accentBorderColor}`,
                  color: baseTextColor
                }}
              />
              <RevealAction
                icon={<IconDeviceFloppy size={18} />}
                label={saveHoverLabel}
                ariaLabel={label}
                onClick={onSave}
                loading={saving === 'saving'}
                disabled={saving === 'saving'}
                textColor={
                  saving === 'error'
                    ? errorTextColor
                    : hasPendingChanges && saving !== 'saving'
                    ? errorTextColor
                    : baseTextColor
                }
                style={{
                  background: neutralButtonBackground,
                  border: `1px solid ${
                    saving === 'error'
                      ? errorBorderColor
                      : hasPendingChanges && saving !== 'saving'
                      ? errorBorderColor
                      : persistVariant
                      ? neutralBorderColor
                      : accentBorderColor
                  }`,
                  color:
                    saving === 'error'
                      ? errorTextColor
                      : hasPendingChanges && saving !== 'saving'
                      ? errorTextColor
                      : baseTextColor,
                  boxShadow:
                    hasPendingChanges && saving !== 'saving'
                      ? '0 0 0 3px rgba(248,113,113,0.18), 0 0 12px rgba(248,113,113,0.35)'
                      : 'none'
                }}
              />

              <RevealAction
                icon={<IconBook2 size={18} />}
                label={catalogHoverLabel}
                ariaLabel="Browse catalog"
                onClick={onBrowseCatalog}
                textColor={baseTextColor}
                style={{
                  background: neutralButtonBackground,
                  border: `1px solid ${accentBorderColor}`,
                  color: baseTextColor
                }}
              />
              <Menu withinPortal width={220}>
                <Menu.Target>
                  <RevealAction
                    icon={<IconPalette size={16} />}
                    label={themeHoverLabel}
                    ariaLabel="Theme selector"
                    textColor={baseTextColor}
                    style={{
                      background: neutralButtonBackground,
                      border: `1px solid ${neutralBorderColor}`,
                      color: baseTextColor
                    }}
                  />
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>Theme presets</Menu.Label>
                  {presets.map((item) => {
                    const active = item.id === preset.id
                    return (
                      <Menu.Item key={item.id} onClick={() => selectPreset(item.id)} rightSection={active ? <IconCheck size={14} /> : null}>
                        <Group gap="sm">
                          <Box
                            w={20}
                            h={20}
                            style={{
                              borderRadius: 6,
                              background: item.surfaces.card,
                              border: `1px solid ${item.surfaces.border}`
                            }}
                          />
                          <Text size="sm">{item.label}</Text>
                        </Group>
                      </Menu.Item>
                    )
                  })}
                </Menu.Dropdown>
              </Menu>
              <RevealAction
                icon={<IconLogout size={18} />}
                label={logoutHoverLabel}
                ariaLabel="Logout"
                onClick={logout}
                textColor={preset.colorScheme === 'light' ? '#991b1b' : '#fecaca'}
                style={
                  preset.colorScheme === 'light'
                    ? {
                        background: 'rgba(254, 226, 226, 0.85)',
                        border: '1px solid rgba(248, 113, 113, 0.45)',
                        color: '#881337'
                      }
                    : {
                        background: 'rgba(127, 29, 29, 0.55)',
                        border: '1px solid rgba(248, 113, 113, 0.4)',
                        color: '#fecaca'
                      }
                }
              />
            </Group>
          </motion.div>
        </LayoutGroup>
      </Group>
    </Box>
  )
}
