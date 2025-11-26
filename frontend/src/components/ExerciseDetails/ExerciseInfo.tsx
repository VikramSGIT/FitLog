import React from 'react'
import {
  Badge,
  Group,
  Paper,
  Stack,
  Text,
  Title,
  MantineTheme,
  useMantineTheme
} from '@mantine/core'
import { CatalogRecord } from '@/api/client'
import { ThemeSurfaces, useThemePreset } from '@/theme'

interface ExerciseInfoProps {
  exercise: CatalogRecord
  isMobile: boolean
}

export const ExerciseInfo: React.FC<ExerciseInfoProps> = ({ exercise, isMobile }) => {
  const theme = useMantineTheme()
  const { preset } = useThemePreset()
  const surfaces = theme.other?.surfaces as ThemeSurfaces || {}
  
  const baseTextColor = (theme.other?.textColor as string) ?? (preset.colorScheme === 'light' ? '#0f172a' : '#f8fafc')
  const mutedTextColor = (theme.other?.mutedText as string) ?? (preset.colorScheme === 'light' ? 'rgba(15, 23, 42, 0.65)' : 'rgba(226, 232, 240, 0.72)')

  return (
    <Stack gap="md" align="stretch">
      <Stack gap="md" align="center">
        {exercise.hasImage && (
          <div
            style={{
              width: isMobile ? 200 : 240,
              height: isMobile ? 200 : 240,
              borderRadius: 12,
              overflow: 'hidden',
              border: `1px solid ${surfaces.border}`,
              flexShrink: 0,
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <img
              src={`${import.meta.env.VITE_API_BASE_URL || ''}/api/catalog/entries/${exercise.id}/image`}
              alt={exercise.name}
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            />
          </div>
        )}
        {!isMobile && (
          <Title order={2} style={{ textAlign: 'center' }}>{exercise.name}</Title>
        )}
        <Group gap="sm" wrap="wrap" justify="center">
          {exercise.type && (
            <Badge color={theme.primaryColor} variant="light">
              {exercise.type}
            </Badge>
          )}
          {exercise.bodyPart && (
            <Badge color="blue" variant="light">
              {exercise.bodyPart}
            </Badge>
          )}
          {exercise.equipment && (
            <Badge color="grape" variant="light">
              {exercise.equipment}
            </Badge>
          )}
          {exercise.level && (
            <Badge color="cyan" variant="light">
              {exercise.level}
            </Badge>
          )}
        </Group>
      </Stack>

      {exercise.description && (
        <Paper
          p="md"
          radius="md"
          withBorder
          style={{
            background: surfaces.card,
            borderColor: surfaces.border
          }}
        >
          <Stack gap={4}>
            <Text size="sm" fw={600} style={{ color: mutedTextColor }}>
              Description
            </Text>
            <Text size="sm" style={{ color: baseTextColor }}>
              {exercise.description}
            </Text>
          </Stack>
        </Paper>
      )}

      {(exercise.primaryMuscles?.length > 0 || exercise.secondaryMuscles?.length > 0) && (
        <Stack gap="md">
          {exercise.primaryMuscles && exercise.primaryMuscles.length > 0 && (
            <Paper
              p="md"
              radius="md"
              withBorder
              style={{
                background: surfaces.card,
                borderColor: surfaces.border
              }}
            >
              <Stack gap="xs">
                <Text size="sm" fw={600} style={{ color: mutedTextColor }}>
                  Primary Muscles
                </Text>
                <Group gap="xs" wrap="wrap">
                  {exercise.primaryMuscles.map((muscle, idx) => (
                    <Badge key={idx} color="orange" variant="light">
                      {muscle}
                    </Badge>
                  ))}
                </Group>
              </Stack>
            </Paper>
          )}
          {exercise.secondaryMuscles && exercise.secondaryMuscles.length > 0 && (
            <Paper
              p="md"
              radius="md"
              withBorder
              style={{
                background: surfaces.card,
                borderColor: surfaces.border
              }}
            >
              <Stack gap="xs">
                <Text size="sm" fw={600} style={{ color: mutedTextColor }}>
                  Secondary Muscles
                </Text>
                <Group gap="xs" wrap="wrap">
                  {exercise.secondaryMuscles.map((muscle, idx) => (
                    <Badge key={idx} color="gray" variant="light">
                      {muscle}
                    </Badge>
                  ))}
                </Group>
              </Stack>
            </Paper>
          )}
        </Stack>
      )}
    </Stack>
  )
}
