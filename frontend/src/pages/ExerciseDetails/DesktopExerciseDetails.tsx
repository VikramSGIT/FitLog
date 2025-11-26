import React from 'react'
import {
  Button,
  Container,
  Group,
  Paper,
  Stack,
  useMantineTheme
} from '@mantine/core'
import { IconArrowLeft } from '@tabler/icons-react'
import { CatalogRecord, ExerciseHistoryItem } from '@/api/client'
import { ExerciseInfo } from '@/components/ExerciseDetails/ExerciseInfo'
import { ExerciseHistory } from '@/components/ExerciseDetails/ExerciseHistory'
import { ThemeSurfaces, useThemePreset } from '@/theme'

import { NavigateFunction } from 'react-router-dom'

interface DesktopExerciseDetailsProps {
  exercise: CatalogRecord
  mergedHistory: ExerciseHistoryItem[]
  highestWeight: number
  hasMore: boolean
  loadingMore: boolean
  loadMoreHistory: (offset: number) => void
  handleHistoryItemClick: (date: string) => void
  navigate: NavigateFunction
}

export const DesktopExerciseDetails: React.FC<DesktopExerciseDetailsProps> = ({
  exercise,
  mergedHistory,
  highestWeight,
  hasMore,
  loadingMore,
  loadMoreHistory,
  handleHistoryItemClick,
  navigate
}) => {
  const theme = useMantineTheme()
  const { preset } = useThemePreset()
  const surfaces = theme.other?.surfaces as ThemeSurfaces || {}
  const baseTextColor = (theme.other?.textColor as string) ?? (preset.colorScheme === 'light' ? '#0f172a' : '#f8fafc')

  return (
    <Container size="lg" py="xl">
      <Paper
        radius="lg"
        withBorder
        p="xl"
        style={{
          background: surfaces.panel,
          borderColor: surfaces.border,
          color: baseTextColor
        }}
      >
        <Stack gap="lg">
          <Group justify="space-between" align="center">
            <Button
              variant="subtle"
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => navigate(-1)}
              style={{ alignSelf: 'flex-start' }}
            >
              Back
            </Button>
          </Group>

          <ExerciseInfo exercise={exercise} isMobile={false} />
          <ExerciseHistory
            history={mergedHistory}
            highestWeight={highestWeight}
            hasMore={hasMore}
            loadingMore={loadingMore}
            onLoadMore={loadMoreHistory}
            onItemClick={handleHistoryItemClick}
            isMobile={false}
          />
        </Stack>
      </Paper>
    </Container>
  )
}
