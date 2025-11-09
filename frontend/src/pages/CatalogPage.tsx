import React, { useMemo } from 'react'
import { Box, Container, Paper, Stack, useMantineTheme } from '@mantine/core'
import { useNavigate } from 'react-router-dom'
import CatalogBrowser from '@/components/CatalogBrowser'
import { DEFAULT_SURFACES, ThemeSurfaces } from '@/theme'
import HeaderBar from '@/components/HeaderBar'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import { api } from '@/api/client'

export default function CatalogPage() {
  const theme = useMantineTheme()
  const navigate = useNavigate()
  const surfaces = useMemo<ThemeSurfaces>(
    () => (theme.other?.surfaces as ThemeSurfaces) ?? DEFAULT_SURFACES,
    [theme]
  )
  const baseTextColor = (theme.other?.textColor as string) ?? (theme.colorScheme === 'light' ? '#0f172a' : '#f8fafc')
  const flushAutoSaves = useWorkoutStore((s) => s.flushAutoSaves)
  const saving = useWorkoutStore((s) => s.saving)
  const lastSaveMode = useWorkoutStore((s) => s.lastSaveMode)
  const lastSavedAt = useWorkoutStore((s) => s.lastSavedAt)

  return (
    <Box
      style={{
        minHeight: '100vh',
        background: surfaces.app,
        color: baseTextColor,
        paddingBottom: '4rem'
      }}
    >
      <HeaderBar
        showBack
        onBack={() => navigate('/')}
        onBrowseCatalog={() => navigate('/catalog')}
        onSave={() => flushAutoSaves('manual')}
        saving={saving as any}
        saveMode={lastSaveMode}
        lastSavedAt={lastSavedAt}
        onLogout={async () => {
          try {
            await api.logout()
          } catch {}
          navigate('/')
        }}
        userLabel="Account"
      />
      <Container size="lg" py="xl">
        <Stack gap="xl">
          <Paper
            withBorder
            radius="lg"
            p="xl"
            style={{
              backdropFilter: 'none',
              background: surfaces.panel,
              borderColor: surfaces.border,
            }}
          >
            <CatalogBrowser />
          </Paper>
        </Stack>
      </Container>
    </Box>
  )
}


