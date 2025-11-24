import React, { useState } from 'react'
import { Box, Button, Group, Text, useMantineTheme, ActionIcon, Drawer, Divider, Stack } from '@mantine/core'
import { DateInput } from '@mantine/dates'
import {
  IconArrowLeft,
  IconBook2,
  IconDeviceFloppy,
  IconLogout,
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

export default function HeaderBarMobile({
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
  const errorTextColor = preset.colorScheme === 'light' ? '#b91c1c' : '#fecaca'

  const [label, setLabel] = useState<string>('Save')
  const [drawerOpened, setDrawerOpened] = useState(false)
  const {
    activeDay: day,
    isLoading: dayLoading,
    exercises,
    loadDay,
  } = useWorkoutStore()

  const [restUpdating, setRestUpdating] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = day?.workoutDate
    if (!d) return format(new Date(), 'yyyy-MM-dd')
    return d
  })

  const lastSavedDistance = lastSavedAt ? formatDistanceToNow(lastSavedAt, { addSuffix: true }) : null
  const saveHoverLabel = <Text size="sm">{lastSavedDistance}</Text>

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
    <>
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
        <Group justify="space-between" h={60} px={'sm'} align="center" wrap="nowrap">
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
                  style={{ minWidth: 160 }}
                />
                <RevealAction
                  icon={day?.isRestDay ? <IconSunHigh size={16} /> : <IconMoonStars size={16} />}
                  label={<Text size="sm">{day?.isRestDay ? 'Training Day' : 'Rest Day'}</Text>}
                  ariaLabel={day?.isRestDay ? 'Training Day' : 'Rest Day'}
                  onClick={toggleRestDay}
                  disabled={restUpdating || dayLoading}
                  disableReveal
                  textColor={baseTextColor}
                  style={{
                    background: neutralButtonBackground,
                    border: `1px solid ${neutralBorderColor}`,
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
                  disableReveal
                  textColor={
                    saving === 'error'
                      ? errorTextColor
                      : baseTextColor
                  }
                  style={{
                    background: neutralButtonBackground,
                    border: `1px solid ${neutralBorderColor}`,
                    color:
                      saving === 'error'
                        ? errorTextColor
                        : baseTextColor,
                  }}
                />

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
              </Group>
            </motion.div>
          </LayoutGroup>
        </Group>
      </Box>

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
              logout()
            }}
          >
            <Group gap={6} align="center">
              <Text fw={600}>Logout</Text>
              {userId && <Text c={mutedTextColor}>{userId}</Text>}
            </Group>
          </Button>
        </Stack>
      </Drawer>
    </>
  )
}
