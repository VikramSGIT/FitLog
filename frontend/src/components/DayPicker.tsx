import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { api } from '@/api/client'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import { format } from 'date-fns'
import { Button, Group, Loader, Stack, Text, Title, Tooltip, useMantineTheme } from '@mantine/core'
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
  const day = useWorkoutStore((s) => s.day)
  const setDay = useWorkoutStore((s) => s.setDay)
  const setDayLoading = useWorkoutStore((s) => s.setDayLoading)
  const flush = useWorkoutStore((s) => s.flush)
  const saving = useWorkoutStore((s) => s.saving)
  const lastSaveMode = useWorkoutStore((s) => s.lastSaveMode)
  const lastSavedAt = useWorkoutStore((s) => s.lastSavedAt)
  const dayLoading = useWorkoutStore((s) => s.dayLoading)
  const [selectedDate, setSelectedDate] = useState<string>(() => toInputDate(day?.workoutDate))
  const loadingRef = useRef<string | null>(null)
  const [restUpdating, setRestUpdating] = useState(false)
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

  const ensureDay = useCallback(
    async (date: string) => {
      if (!date) return
      if (loadingRef.current === date) return
      loadingRef.current = date
      setDayLoading(true)
      try {
        const res = await api.getDayByDate(date, true)
        if (loadingRef.current !== date) {
          return
        }
        if ('day' in (res as any) && (res as any).day === null) {
          const created = await api.createDay(date)
          if (loadingRef.current === date) {
            setDay(created)
          }
        } else {
          setDay(res as any)
        }
      } catch (err) {
        console.error('Failed to load workout day', err)
      } finally {
        if (loadingRef.current === date) {
          loadingRef.current = null
          setDayLoading(false)
        }
      }
    },
    [setDay, setDayLoading]
  )

  const onChangePicker = useCallback(
    async (value: Date | null) => {
      if (!value) return
      const formatted = format(value, 'yyyy-MM-dd')
      setSelectedDate(formatted)
      await ensureDay(formatted)
    },
    [ensureDay]
  )

  const toggleRestDay = useCallback(async () => {
    if (!day || dayLoading) return
    if (!day.isRestDay) {
      const hasExercises = Array.isArray(day.exercises) && day.exercises.length > 0
      if (hasExercises) {
        alert('Remove all exercises from this day before marking it as a rest day.')
        return
      }
    }
    setRestUpdating(true)
    setDayLoading(true)
    try {
      const updated = await api.updateDay(day.id, { isRestDay: !day.isRestDay })
      setDay(updated)
    } catch (err) {
      console.error('Failed to toggle rest day', err)
    } finally {
      setDayLoading(false)
      setRestUpdating(false)
    }
  }, [day, dayLoading, setDay, setDayLoading])

  // Save status messaging moved to the HeaderBar button; no local message here.

  const onManualSave = useCallback(() => {
    if (saving === 'saving') return
    flush('manual').catch(() => {
      // flushAutoSaves sets saving state on error
    })
  }, [flush, saving])

  useEffect(() => {
    const currentDate = day?.workoutDate ? toInputDate(day.workoutDate) : null
    if (!selectedDate) return
    if (currentDate === selectedDate) return
    if (loadingRef.current === selectedDate) return
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
                onClick={toggleRestDay}
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
    </Stack>
  )
}
