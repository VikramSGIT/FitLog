import React from 'react'
import {
  ActionIcon,
  Group,
  ScrollArea,
  Stack,
  Title,
  useMantineTheme
} from '@mantine/core'
import { IconArrowLeft } from '@tabler/icons-react'
import { CatalogRecord, ExerciseHistoryItem } from '@/api/client'
import { ExerciseInfo } from '@/components/ExerciseDetails/ExerciseInfo'
import { ExerciseHistory } from '@/components/ExerciseDetails/ExerciseHistory'

import { NavigateFunction } from 'react-router-dom'

interface MobileExerciseDetailsProps {
  exercise: CatalogRecord
  mergedHistory: ExerciseHistoryItem[]
  highestWeight: number
  hasMore: boolean
  loadingMore: boolean
  loadMoreHistory: (offset: number) => void
  handleHistoryItemClick: (date: string) => void
  navigate: NavigateFunction
}

export const MobileExerciseDetails: React.FC<MobileExerciseDetailsProps> = ({
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

  return (
    <Stack gap="md" style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '16px' }}>
      <Group justify="space-between" align="center">
        <ActionIcon
          variant="outline"
          color={theme.primaryColor}
          radius="md"
          size="lg"
          onClick={() => navigate(-1)}
          aria-label="Back"
        >
          <IconArrowLeft size={18} />
        </ActionIcon>
        <Title order={3} style={{ margin: 0, flex: 1, textAlign: 'center' }}>
          {exercise.name}
        </Title>
        <div style={{ width: 40 }} />
      </Group>
      <ScrollArea style={{ flex: 1, minHeight: 0 }}>
        <ExerciseInfo exercise={exercise} isMobile={true} />
        <ExerciseHistory
          history={mergedHistory}
          highestWeight={highestWeight}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onLoadMore={loadMoreHistory}
          onItemClick={handleHistoryItemClick}
          isMobile={true}
        />
      </ScrollArea>
    </Stack>
  )
}
