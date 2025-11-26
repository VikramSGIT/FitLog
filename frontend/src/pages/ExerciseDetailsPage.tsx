import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box,
  Loader,
  useMantineTheme
} from '@mantine/core'
import HeaderBar from '@/components/HeaderBar'
import { DEFAULT_SURFACES, ThemeSurfaces, useThemePreset } from '@/theme'
import { api } from '@/api/client'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import { useMediaQuery } from '@mantine/hooks'
import { useExerciseData } from '@/hooks/useExerciseData'
import { MobileExerciseDetails } from '@/pages/ExerciseDetails/MobileExerciseDetails'
import { DesktopExerciseDetails } from '@/pages/ExerciseDetails/DesktopExerciseDetails'

export default function ExerciseDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const theme = useMantineTheme()
  const { preset } = useThemePreset()
  const isMobile = useMediaQuery('(max-width: 640px)')
  
  const sync = useWorkoutStore((s) => s.sync)
  const saveStatus = useWorkoutStore((s) => s.saveStatus)
  const saveMode = useWorkoutStore((s) => s.saveMode)
  const lastSavedAt = null 

  const {
    loading,
    exercise,
    highestWeight,
    mergedHistory,
    hasMore,
    loadingMore,
    loadMoreHistory
  } = useExerciseData(id)

  const surfaces = (theme.other?.surfaces as ThemeSurfaces) ?? DEFAULT_SURFACES
  const baseTextColor =
    (theme.other?.textColor as string) ?? (preset.colorScheme === 'light' ? '#0f172a' : '#f8fafc')

  const handleHistoryItemClick = async (date: string) => {
    try {
       const userId = useWorkoutStore.getState().userId
       if (userId) {
          await useWorkoutStore.getState().loadDay(date, userId)
       }
       navigate('/')
    } catch (err) {
       console.error(err)
    }
  }

  if (loading) {
    return (
      <Box
        style={{
          minHeight: '100vh',
          background: surfaces.app,
          color: baseTextColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Loader size="lg" />
      </Box>
    )
  }

  if (!exercise) {
    return null
  }

  return (
    <Box
      style={{
        minHeight: '100vh',
        height: isMobile ? '100vh' : undefined,
        background: isMobile ? surfaces.panel : surfaces.app,
        color: baseTextColor,
        paddingBottom: isMobile ? 0 : '4rem',
        display: isMobile ? 'flex' : undefined,
        flexDirection: isMobile ? 'column' : undefined,
        overflow: isMobile ? 'hidden' : undefined
      }}
    >
      {!isMobile && (
        <HeaderBar
          onBrowseCatalog={() => navigate('/catalog')}
          onSave={() => sync()}
          saving={saveStatus === 'saving' ? 'saving' : (saveStatus === 'saved' ? 'saved' : 'idle')}
          saveMode={saveMode}
          lastSavedAt={lastSavedAt} 
          onLogout={async () => {
            try {
              await api.logout()
            } catch {}
            navigate('/')
          }}
          userLabel="Account"
        />
      )}
      {isMobile ? (
        <MobileExerciseDetails 
          exercise={exercise}
          mergedHistory={mergedHistory}
          highestWeight={highestWeight}
          hasMore={hasMore}
          loadingMore={loadingMore}
          loadMoreHistory={loadMoreHistory}
          handleHistoryItemClick={handleHistoryItemClick}
          navigate={navigate}
        />
      ) : (
        <DesktopExerciseDetails
          exercise={exercise}
          mergedHistory={mergedHistory}
          highestWeight={highestWeight}
          hasMore={hasMore}
          loadingMore={loadingMore}
          loadMoreHistory={loadMoreHistory}
          handleHistoryItemClick={handleHistoryItemClick}
          navigate={navigate}
        />
      )}
    </Box>
  )
}
