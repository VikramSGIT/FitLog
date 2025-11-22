import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Box, Button, Group, Menu, Stack, Text, Title, useMantineTheme, ActionIcon, Drawer, Divider, Modal } from '@mantine/core'
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
import { useMediaQuery } from '@mantine/hooks'
import { useThemePreset } from '@/theme'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import { api } from '@/api/client'
import dayjs from 'dayjs'
import { format } from 'date-fns'
import { notifications } from '@mantine/notifications'
import type { SaveMode } from '@/store/useWorkoutStore'
import RevealAction from '@/components/RevealAction'
import { formatDistanceToNow } from 'date-fns'
import { LayoutGroup, motion } from 'framer-motion'

export type SavingState = 'idle' | 'saving' | 'saved' | 'error'

type HeaderBarProps = {
  showBack?: boolean
  onBack?: () => void
  onBrowseCatalog: () => void
  onSave: () => void
  saving?: SavingState
  saveMode?: SaveMode | null
  lastSavedAt?: number | null
  onLogout: () => void
  userLabel?: string
}

export default function HeaderBar({
  showBack,
  onBack,
  onBrowseCatalog,
  onSave,
  saving = 'idle',
  saveMode,
  lastSavedAt,
  onLogout,
  userLabel
}: HeaderBarProps) {
  const theme = useMantineTheme()
  const { preset, presets, selectPreset } = useThemePreset()
  const surfaces = theme.other?.surfaces as any
  const baseTextColor = (theme.other?.textColor as string) ?? (theme.colorScheme === 'light' ? '#0f172a' : '#f8fafc')
  const mutedTextColor =
    (theme.other?.mutedText as string) ?? (theme.colorScheme === 'light' ? 'rgba(15, 23, 42, 0.65)' : 'rgba(226, 232, 240, 0.72)')
  const neutralButtonBackground =
    theme.colorScheme === 'light' ? surfaces?.panel ?? '#ffffff' : surfaces?.card ?? '#0b1020'
  const neutralBorderColor = surfaces?.border ?? 'rgba(148, 163, 184, 0.35)'
  const accentBorderColor =
    theme.colors?.[theme.primaryColor]?.[5] ?? (theme.colorScheme === 'light' ? 'rgba(99, 102, 241, 0.6)' : 'rgba(96, 165, 250, 0.65)')
  const errorBorderColor = theme.colorScheme === 'light' ? 'rgba(248, 113, 113, 0.55)' : 'rgba(248, 113, 113, 0.45)'
  const errorTextColor = theme.colorScheme === 'light' ? '#b91c1c' : '#fecaca'

  const [label, setLabel] = useState<string>('Save')
  const [persistVariant, setPersistVariant] = useState<boolean>(false)
  const resetTimer = useRef<number | null>(null)
  const isMobile = useMediaQuery('(max-width: 640px)')
  const [drawerOpened, setDrawerOpened] = useState(false)
  const [restDayModalOpen, setRestDayModalOpen] = useState(false)
  const day = useWorkoutStore((s) => s.day)
  const dayLoading = useWorkoutStore((s) => s.dayLoading)
  const hasPendingChanges = useWorkoutStore((s) => s.opLog.length > 0)
  const setDay = useWorkoutStore((s) => s.setDay)
  const setDayLoading = useWorkoutStore((s) => s.setDayLoading)
  const [restUpdating, setRestUpdating] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = day?.workoutDate
    if (!d) return format(new Date(), 'yyyy-MM-dd')
    return d
  })
  const prevSavingRef = useRef<SavingState | undefined>('idle')
  const saveNotifIdRef = useRef<string | null>(null)
  const prevLastSavedAtRef = useRef<number | null>(null)
  const firstNotifRunRef = useRef<boolean>(true)

  useEffect(() => {
    if (resetTimer.current) {
      window.clearTimeout(resetTimer.current)
      resetTimer.current = null
    }
    if (saving === 'saving') {
      setLabel(saveMode === 'auto' ? 'Auto-saving...' : 'Saving...')
      setPersistVariant(false)
      return
    }
    if (saving === 'saved') {
      setLabel(saveMode === 'auto' ? 'Auto-saved' : 'Saved')
      setPersistVariant(true)
    } else if (saving === 'error') {
      setLabel('Save failed')
      setPersistVariant(true)
    } else {
      setLabel('Save')
      setPersistVariant(false)
    }
    if (saving === 'saved' || saving === 'error') {
      resetTimer.current = window.setTimeout(() => {
        setLabel('Save')
        setPersistVariant(false)
        resetTimer.current = null
      }, 10000)
    }
    return () => {
      if (resetTimer.current) {
        window.clearTimeout(resetTimer.current)
        resetTimer.current = null
      }
    }
  }, [saving, saveMode, lastSavedAt])

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
      {userLabel && (
        <Text size="sm" c={mutedTextColor}>
          {userLabel}
        </Text>
      )}
    </Group>
  )
  async function ensureDay(date: string) {
    if (!date) return
    setDayLoading(true)
    try {
      const res = await api.getDayByDate(date, true)
      if ('day' in (res as any) && (res as any).day === null) {
        const created = await api.createDay(date)
        setDay(created)
      } else {
        setDay(res as any)
      }
    } catch {
      // ignore
    } finally {
      setDayLoading(false)
    }
  }

  useEffect(() => {
    setSelectedDate(day?.workoutDate ?? format(new Date(), 'yyyy-MM-dd'))
  }, [day?.workoutDate])

  // Auto-load/create the day on mount or when date changes and no day is present
  useEffect(() => {
    if (!day && selectedDate && !dayLoading) {
      void ensureDay(selectedDate)
    }
  }, [day, selectedDate, dayLoading])

  // Show notifications on save result transitions (supports stores that go saving -> saved or saving -> idle with lastSavedAt update)
  useEffect(() => {
    // Skip showing any notifications on first mount to avoid spurious "Saved" when navigating
    if (firstNotifRunRef.current) {
      firstNotifRunRef.current = false
      prevSavingRef.current = saving
      prevLastSavedAtRef.current = lastSavedAt ?? null
      return
    }
    const isMobile = window.matchMedia('(max-width: 640px)').matches
    const baseNotificationProps = isMobile
      ? {
          withCloseButton: true,
          className: 'slide-dismiss'
        }
      : {}

    // When save starts
    if (saving === 'saving') {
      if (!saveNotifIdRef.current) {
        const id = notifications.show({
          title: 'Saving…',
          message: 'Saving your changes.',
          loading: true,
          autoClose: false,
          withCloseButton: !isMobile,
          ...baseNotificationProps
        })
        saveNotifIdRef.current = String(id)
      } else {
        notifications.update({
          id: saveNotifIdRef.current,
          title: 'Saving…',
          message: 'Saving your changes.',
          loading: true,
          autoClose: false,
          withCloseButton: !isMobile,
          ...baseNotificationProps
        })
      }
      prevSavingRef.current = saving
      return
    }

    // If error
    if (saving === 'error') {
      if (saveNotifIdRef.current) {
        notifications.update({
          id: saveNotifIdRef.current,
          title: 'Save failed',
          message: 'We could not save your changes. Please try again.',
          color: 'red',
          loading: false,
          autoClose: 3500,
          withCloseButton: true
        })
        saveNotifIdRef.current = null
      } else {
        notifications.show({
          title: 'Save failed',
          message: 'We could not save your changes. Please try again.',
          color: 'red'
        })
      }
      prevSavingRef.current = saving
      return
    }

    // Success path: only show notification if we transitioned from 'saving' to 'saved'
    // or if there's an active notification to update (meaning a save was in progress)
    const savedByFlag = saving === 'saved'
    const wasSaving = prevSavingRef.current === 'saving'
    const savedByTimestamp = !!lastSavedAt && lastSavedAt !== prevLastSavedAtRef.current && saving !== 'saving' && wasSaving
    if (savedByFlag || (savedByTimestamp && saveNotifIdRef.current)) {
      const title = saveMode === 'auto' ? 'Auto-saved' : 'Saved'
      const message =
        saveMode === 'auto' ? 'Your changes were saved automatically.' : 'Your changes were saved successfully.'
      if (saveNotifIdRef.current) {
        notifications.update({
          id: saveNotifIdRef.current,
          title,
          message,
          color: 'teal',
          icon: <IconDeviceFloppy size={16} />,
          loading: false,
          autoClose: 2000,
          withCloseButton: !isMobile,
          ...baseNotificationProps
        })
        saveNotifIdRef.current = null
      } else if (savedByFlag && wasSaving) {
        // Only show new notification if we transitioned from saving to saved
        notifications.show({
          title,
          message,
          color: 'teal',
          icon: <IconDeviceFloppy size={16} />,
          withCloseButton: !isMobile,
          ...baseNotificationProps
        })
      }
      prevLastSavedAtRef.current = lastSavedAt ?? prevLastSavedAtRef.current
    } else if (lastSavedAt !== prevLastSavedAtRef.current) {
      // Update the ref even if we don't show a notification to prevent false positives
      prevLastSavedAtRef.current = lastSavedAt ?? prevLastSavedAtRef.current
    }

    // If we reached idle without a save (no-op flush), ensure any loading toast is closed
    if (saving === 'idle' && saveNotifIdRef.current) {
      notifications.hide(saveNotifIdRef.current)
      saveNotifIdRef.current = null
    }

    prevSavingRef.current = saving
  }, [saving, saveMode, lastSavedAt])

  const onChangePicker = async (value: Date | null) => {
    if (!value) return
    const formatted = format(value, 'yyyy-MM-dd')
    setSelectedDate(formatted)
    await ensureDay(formatted)
  }

  const toggleRestDay = async () => {
    if (dayLoading) return
    let currentDay = day
    if (!currentDay) {
      await ensureDay(selectedDate)
      currentDay = (useWorkoutStore as any).getState().day
      if (!currentDay) return
    }
    if (!currentDay.isRestDay) {
      const hasExercises = Array.isArray(currentDay.exercises) && currentDay.exercises.length > 0
      if (hasExercises) {
        setRestDayModalOpen(true)
        return
      }
    }
    setRestUpdating(true)
    const next = !currentDay.isRestDay
    useWorkoutStore.getState().queueUpdateDay(currentDay.id, next)
    notifications.show({
      title: next ? 'Marked rest day' : 'Switched to training day',
      message: next ? 'This day is now a rest day.' : 'This day is now a training day.',
      color: next ? 'yellow' : 'teal'
    })
    setRestUpdating(false)
  }

  const confirmRestDay = async () => {
    if (dayLoading) return
    let currentDay = day
    if (!currentDay) {
      await ensureDay(selectedDate)
      currentDay = (useWorkoutStore as any).getState().day
      if (!currentDay) {
        setRestDayModalOpen(false)
        return
      }
    }
    setRestDayModalOpen(false)
    setRestUpdating(true)
    const next = !currentDay.isRestDay
    useWorkoutStore.getState().queueUpdateDay(currentDay.id, next)
    notifications.show({
      title: next ? 'Marked rest day' : 'Switched to training day',
      message: next ? 'This day is now a rest day.' : 'This day is now a training day.',
      color: next ? 'yellow' : 'teal'
    })
    setRestUpdating(false)
  }
  return (
    <>
      <Box
        style={{
          background: surfaces?.header ?? (theme.colorScheme === 'light' ? '#fff' : '#0b1020'),
          borderBottom: `1px solid ${surfaces?.border ?? 'rgba(148, 163, 184, 0.18)'}`,
          color: baseTextColor,
          position: 'sticky',
          top: 0,
          zIndex: 20
        }}
      >
        <Group justify="space-between" h={60} px={isMobile ? 'sm' : 'lg'} align="center" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            {!isMobile && showBack && (
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
            {!isMobile && (
              <Group gap="xs" wrap="nowrap">
                <IconSparkles size={20} color="var(--mantine-color-primary-4)" />
                <Title order={3}>Lift Logger</Title>
              </Group>
            )}
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
                  style={{ minWidth: isMobile ? 160 : 200 }}
                />
                <RevealAction
                  icon={day?.isRestDay ? <IconSunHigh size={16} /> : <IconMoonStars size={16} />}
                  label={<Text size="sm">{day?.isRestDay ? 'Training Day' : 'Rest Day'}</Text>}
                  ariaLabel={day?.isRestDay ? 'Training Day' : 'Rest Day'}
                  onClick={toggleRestDay}
                  disabled={restUpdating || dayLoading}
                  disableReveal={isMobile}
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
                  onClick={() => {
                    // show a quick feedback immediately
                    if (!saveNotifIdRef.current) {
                      const id = notifications.show({
                        title: 'Saving…',
                        message: 'Saving your changes.',
                        loading: true,
                        autoClose: false,
                        withCloseButton: false
                      })
                      saveNotifIdRef.current = String(id)
                    }
                    onSave()
                  }}
                  loading={saving === 'saving'}
                  disabled={saving === 'saving'}
                  disableReveal={isMobile}
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

                {isMobile ? (
                  <ActionIcon
                    size="lg"
                    radius="md"
                    aria-label="Open menu"
                    onClick={() => setDrawerOpened(true)}
                    style={{
                      background: neutralButtonBackground,
                      border: `1px solid ${neutralBorderColor}`,
                      color: baseTextColor
                    }}
                  >
                    <IconMenu2 size={18} />
                  </ActionIcon>
                ) : (
                  <>
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
                      onClick={onLogout}
                      textColor={theme.colorScheme === 'light' ? '#991b1b' : '#fecaca'}
                      style={
                        theme.colorScheme === 'light'
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
                  </>
                )}
              </Group>
            </motion.div>
          </LayoutGroup>
        </Group>
      </Box>

      {isMobile && (
        <Drawer opened={drawerOpened} onClose={() => setDrawerOpened(false)} title="Menu" padding="md">
          <Stack gap="sm">
            {showBack && (
              <Button
                leftSection={<IconArrowLeft size={16} />}
                variant="outline"
                onClick={() => {
                  setDrawerOpened(false)
                  onBack?.()
                }}
              >
                Back
              </Button>
            )}
            <Button
              leftSection={<IconBook2 size={16} />}
              variant="outline"
              onClick={() => {
                setDrawerOpened(false)
                onBrowseCatalog()
              }}
            >
              Browse catalog
            </Button>
            <Divider />
            <Text size="sm" c={mutedTextColor}>
              Theme
            </Text>
            <Stack gap={6}>
              {presets.map((item) => {
                const active = item.id === preset.id
                return (
                  <Button
                    key={item.id}
                    variant={active ? 'filled' : 'outline'}
                    onClick={() => {
                      selectPreset(item.id)
                      setDrawerOpened(false)
                    }}
                  >
                    {item.label}
                  </Button>
                )
              })}
            </Stack>
            <Divider />
            <Button
              leftSection={<IconLogout size={16} />}
              color="red"
              variant="outline"
              onClick={() => {
                setDrawerOpened(false)
                onLogout()
              }}
            >
              <Group gap={6} align="center">
                <Text fw={600}>Logout</Text>
                {userLabel && <Text c={mutedTextColor}>{userLabel}</Text>}
              </Group>
            </Button>
          </Stack>
        </Drawer>
      )}

      <Modal
        opened={restDayModalOpen}
        onClose={() => setRestDayModalOpen(false)}
        title="Switch to rest day"
        radius="md"
        centered
      >
        <Stack gap="md">
          <Text>
            Please remove all exercises from this day before marking it as a rest day.
          </Text>
          <Group justify="flex-end">
            <Button
              onClick={() => setRestDayModalOpen(false)}
              disabled={restUpdating}
            >
              OK
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  )
}


