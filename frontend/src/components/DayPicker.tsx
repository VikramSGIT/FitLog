import { useCallback, useEffect, useState } from 'react'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import { format } from 'date-fns'
import { Button, Group, Loader, Modal, Stack, Text, Title, Tooltip, useMantineTheme } from '@mantine/core'
import { DateInput } from '@mantine/dates'
import dayjs from 'dayjs'
import { IconCalendar, IconMoonStars, IconSunHigh } from '@tabler/icons-react'
import { DEFAULT_SURFACES, ThemeSurfaces, useThemePreset } from '@/theme'

function toInputDate(value?: string): string {
  if (!value) {
    return format(new Date(), 'yyyy-MM-dd')
  }
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) {
    return format(new Date(), 'yyyy-MM-dd')
  }
  return format(d, 'yyyy-MM-dd')
}

export default function DayPicker() {
  const { day, dayLoading, ensureDay, updateDay } = useWorkoutStore()
  const [selectedDate, setSelectedDate] = useState<string>(() => toInputDate(day?.workoutDate))
  const [restUpdating, setRestUpdating] = useState(false)
  const [restDayModalOpen, setRestDayModalOpen] = useState(false)
  const theme = useMantineTheme()
  const { preset } = useThemePreset()
  const isLight = preset?.colorScheme === 'light'
  const surfaces = (theme.other?.surfaces as ThemeSurfaces) ?? DEFAULT_SURFACES
  const baseTextColor = (theme.other?.textColor as string) ?? (isLight ? '#0f172a' : '#f8fafc')
  const accentGradient = (theme.other?.accentGradient as string) ?? 'linear-gradient(135deg, #8f5afc 0%, #5197ff 100%)'
  const actionTextColor = isLight ? '#0f172a' : '#f8fafc'
  const neutralButtonBackground = surfaces.card ?? (isLight ? '#ffffff' : '#0f172a')

  const restToggleStyles = day?.isRestDay
    ? {
        background: neutralButtonBackground,
        border: `1px solid ${surfaces.border}`,
        color: baseTextColor,
      }
    : {
        backgroundImage: accentGradient,
        border: `1px solid ${surfaces.border}`,
        color: actionTextColor,
      }

  useEffect(() => {
    setSelectedDate(toInputDate(day?.workoutDate))
  }, [day?.workoutDate])

  const onChangePicker = useCallback(
    async (value: Date | null) => {
      if (!value) return
      const formatted = format(value, 'yyyy-MM-dd')
      setSelectedDate(formatted)
      await ensureDay(formatted)
    },
    [ensureDay]
  )

  const toggleRestDay = useCallback(async (confirm = false) => {
    if (!day || dayLoading) return
    if (!day.isRestDay && !confirm) {
      const hasExercises = Array.isArray(day.exercises) && day.exercises.length > 0
      if (hasExercises) {
        setRestDayModalOpen(true)
        return
      }
    }
    setRestDayModalOpen(false)
    setRestUpdating(true)
    try {
      await updateDay(day.tempId!, { isRestDay: !day.isRestDay })
    } catch (err) {
      console.error('Failed to toggle rest day', err)
    } finally {
      setRestUpdating(false)
    }
  }, [day, dayLoading, updateDay])

  useEffect(() => {
    const currentDate = day?.workoutDate ? toInputDate(day.workoutDate) : null
    if (!selectedDate) return
    if (currentDate === selectedDate) return
    ensureDay(selectedDate)
  }, [day?.workoutDate, ensureDay, selectedDate])

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
        <Stack gap={4}>
          <Title order={3}>Workout Day</Title>
          <Text size="sm" c="dimmed">
            Choose your workout date and mark the day as a rest or training day.
          </Text>
        </Stack>
      {day && (
          <Group gap="sm" wrap="wrap" justify="flex-end">
            <Tooltip label={day.isRestDay ? 'Switch back to log training data' : 'Mark this day as rest'}>
              <Button
                radius="md"
                leftSection={day.isRestDay ? <IconSunHigh size={18} /> : <IconMoonStars size={18} />}
                onClick={() => toggleRestDay()}
                disabled={restUpdating || dayLoading}
                style={restToggleStyles}
              >
                {day.isRestDay ? 'Training Day' : 'Rest Day'}
              </Button>
            </Tooltip>
          </Group>
        )}
      </Group>

      <Stack gap={6} style={{ flex: 1, minWidth: 220 }}>
        <DateInput
          value={selectedDate ? dayjs(selectedDate, 'YYYY-MM-DD').toDate() : null}
          onChange={onChangePicker}
          leftSection={<IconCalendar size={18} />}
          valueFormat="MMM DD, YYYY"
          radius="md"
          size="md"
          variant="filled"
          withAsterisk
          disabled={dayLoading}
          popoverProps={{
            withinPortal: true,
            zIndex: 350,
            radius: 'md',
            transitionProps: { transition: 'pop', duration: 180 },
            styles: {
              dropdown: {
                background: isLight ? '#ffffff' : '#0b1020',
                border: `1px solid ${surfaces.border}`,
                color: baseTextColor,
                backdropFilter: 'none'
              }
            }
          }}
          styles={{
            input: {
              background: isLight ? '#ffffff' : surfaces.card,
              borderColor: surfaces.border,
              color: baseTextColor,
              '&:hover': {
                borderColor: surfaces.border,
                background: isLight ? '#ffffff' : surfaces.card
              }
            },
            label: { color: baseTextColor },
            dropdown: {
              background: isLight ? '#ffffff' : '#0b1020',
              border: `1px solid ${surfaces.border}`,
              color: baseTextColor,
              '&:hover': {
                borderColor: surfaces.border,
                background: isLight ? '#ffffff' : '#0b1020'
              }
            },
            calendarHeader: {
              background: isLight ? '#ffffff' : '#0b1020',
              borderBottom: `1px solid ${surfaces.border}`,
              color: baseTextColor
            },
            calendarHeaderControl: {
              borderColor: surfaces.border,
              background: isLight ? '#ffffff' : surfaces.card,
              color: baseTextColor,
              transition: 'box-shadow 150ms ease, background 150ms ease, border-color 150ms ease',
              '&:hover': {
                borderColor: surfaces.border,
                background: isLight ? '#ffffff' : surfaces.card
              }
            },
            calendarHeaderLevel: {
              color: baseTextColor
            },
            month: {
              background: isLight ? '#ffffff' : '#0b1020',
              color: baseTextColor
            },
            weekday: {
              color: baseTextColor
            }
          }}
        />
        {dayLoading && (
          <Group gap={6}>
            <Loader size="sm" color={theme.primaryColor} />
            <Text size="xs" c="dimmed">
              Loading day details...
            </Text>
          </Group>
      )}
      </Stack>

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
              disabled={restUpdating || dayLoading}
            >
              OK
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
