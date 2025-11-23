import React, { Suspense, lazy, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell, Center, Container, Loader, Modal, Paper, Stack, useMantineTheme } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { motion } from 'framer-motion'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import { DEFAULT_SURFACES, ThemeSurfaces, useThemePreset } from '@/theme'
import HeaderBar from '@/components/HeaderBar'
import { useAuth } from '@/hooks/useAuth'

const ExerciseList = lazy(() => import('@/components/ExerciseList'))
const CatalogBrowser = lazy(() => import('@/components/CatalogBrowser'))

const MotionPaper = motion.create(Paper)

export default function MainApp() {
  const [catalogOpen, setCatalogOpen] = useState(false)
  const isMobile = useMediaQuery('(max-width: 48em)')
  const nav = useNavigate()
  const theme = useMantineTheme()
  const { preset, selectPreset, presets } = useThemePreset()
  const { sync, saveStatus, saveMode } = useWorkoutStore()
  const { logout, userId } = useAuth()

  const surfaces = useMemo<ThemeSurfaces>(
    () => (theme.other?.surfaces as ThemeSurfaces) ?? DEFAULT_SURFACES,
    [theme]
  )
  const baseTextColor =
    (theme.other?.textColor as string) ?? (preset.colorScheme === 'light' ? '#0f172a' : '#f8fafc')

  return (
    <>
      <AppShell
        padding={isMobile ? 'sm' : 'lg'}
        header={{ height: isMobile ? 60 : 72 }}
        style={{
          minHeight: '100vh',
          background: surfaces.app,
          color: baseTextColor
        }}
      >
        <AppShell.Header
          style={{
            background: 'transparent',
            borderBottom: 'none',
            padding: 0
          }}
        >
          <HeaderBar
            onBrowseCatalog={() => nav('/catalog')}
            onSave={sync}
            saving={saveStatus}
            saveMode={saveMode}
            onLogout={logout}
            userLabel={userId || 'Account'}
          />
        </AppShell.Header>
        <AppShell.Main
          style={{
            minHeight: `calc(100dvh - ${isMobile ? 60 : 72}px)`,
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <Container
            size={isMobile ? '100%' : 'xl'}
            py={isMobile ? 0 : 'xl'}
            px={isMobile ? 0 : undefined}
            style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
          >
            <Stack gap={isMobile ? 0 : 'xl'} style={{ flex: 1 }}>
              <MotionPaper
                p={isMobile ? 0 : 'lg'}
                radius={isMobile ? 0 : 'lg'}
                withBorder={!isMobile}
                style={{
                  background: isMobile ? 'transparent' : surfaces.card,
                  borderColor: surfaces.border,
                  backdropFilter: 'none',
                  color: baseTextColor,
                  minHeight: '100%',
                  display: 'flex',
                  flexDirection: 'column'
                }}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <Suspense
                  fallback={
                    <Center py="xl">
                      <Loader />
                    </Center>
                  }
              >
                <ExerciseList onAddFromCatalog={() => setCatalogOpen(true)} />
                </Suspense>
              </MotionPaper>
            </Stack>
          </Container>
        </AppShell.Main>
      </AppShell>

      <Modal
        opened={catalogOpen}
        onClose={() => setCatalogOpen(false)}
        radius={0}
        padding={0}
        fullScreen
        transitionProps={{ transition: 'slide-up', duration: 260, timingFunction: 'ease' }}
        overlayProps={{
          color: preset.colorScheme === 'dark' ? '#02030a' : '#0f172a',
          opacity: 0.55,
          blur: 0
        }}
        styles={{
          header: { display: 'none' },
          body: {
            padding: 0,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0
          },
          content: {
            background: surfaces.panel,
            color: baseTextColor,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            overflow: 'hidden',
            padding: 0,
            height: '100vh',
            width: '100vw'
          }
        }}
      >
        <Suspense
          fallback={
            <Center py="lg">
              <Loader size="sm" />
            </Center>
          }
      >
        <CatalogBrowser embedded onClose={() => setCatalogOpen(false)} />
        </Suspense>
      </Modal>
    </>
  )
}
