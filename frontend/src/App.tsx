import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { ActionIcon, AppShell, Button, Center, Container, Group, Loader, Menu, Modal, Paper, PasswordInput, Stack, Text, TextInput, Title, Tooltip, useMantineTheme } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import {
  IconLogout,
  IconLogin,
  IconBook2,
  IconMail,
  IconLock,
  IconSparkles,
  IconPalette,
  IconCheck
} from '@/icons/tabler'
import { motion } from 'framer-motion'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import { api, DayWithDetails } from '@/api/client'
import { format } from 'date-fns'
import { DEFAULT_SURFACES, ThemeSurfaces, useThemePreset } from './theme'
import HeaderBar from '@/components/HeaderBar'

const ExerciseList = lazy(() => import('@/components/ExerciseList'))
const CatalogBrowser = lazy(() => import('@/components/CatalogBrowser'))
const CatalogPage = lazy(() => import('./pages/CatalogPage'))
const CatalogCreatePage = lazy(() => import('./pages/CatalogCreatePage'))
const ExerciseDetailsPage = lazy(() => import('./pages/ExerciseDetailsPage'))

const FALLBACK_ACCENT = 'linear-gradient(135deg, #8f5afc 0%, #5197ff 100%)'

function Home() {
  const [authed, setAuthed] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [catalogOpen, setCatalogOpen] = useState(false)
  const isMobile = useMediaQuery('(max-width: 48em)')
  const nav = useNavigate()
  const theme = useMantineTheme()
  const { preset, selectPreset, presets } = useThemePreset()
  const { init, cleanup, sync, saveStatus } = useWorkoutStore()

  const surfaces = useMemo<ThemeSurfaces>(
    () => (theme.other?.surfaces as ThemeSurfaces) ?? DEFAULT_SURFACES,
    [theme]
  )
  const accentGradient = (theme.other?.accentGradient as string) ?? FALLBACK_ACCENT
  const baseTextColor =
    (theme.other?.textColor as string) ?? (preset.colorScheme === 'light' ? '#0f172a' : '#f8fafc')
  const mutedTextColor =
    (theme.other?.mutedText as string) ??
    (preset.colorScheme === 'light' ? 'rgba(15, 23, 42, 0.65)' : 'rgba(226, 232, 240, 0.72)')
  const ctaTextColor = preset.colorScheme === 'light' ? '#0f172a' : '#f8fafc'

  useEffect(() => {
    api
      .me()
      .then((res) => {
        setAuthed(true)
        setUserId(res.userId)
        init(res.userId)
      })
      .catch((err) => {
        setAuthed(false)
      })
      .finally(() => setCheckingSession(false))
    
    return () => {
        cleanup()
    }
  }, [init, cleanup])

  async function onLogin(e: React.FormEvent) {
    e.preventDefault()
    try {
      const res = await api.login(email, password)
      setAuthed(true)
      setUserId(res.userId)
      init(res.userId)
      notifications.show({
        title: 'Welcome back to Lift Logger',
        message: 'Your dashboard is ready to go.',
        color: 'teal',
        icon: <IconLogin size={18} />
      })
    } catch {
      notifications.show({
        title: 'Login failed',
        message: 'Double-check your email and password and try again.',
        color: 'red'
      })
    }
  }

  async function onLogout() {
    try {
      await api.logout()
    } catch {
      // ignore
    }
    setAuthed(false)
    setUserId(null)
    cleanup()
  }

  if (checkingSession) {
    return (
      <Center mih="100vh" style={{ background: surfaces.app }}>
        <Stack align="center" gap="md">
          <Loader size="lg" color={preset.primaryColor ?? 'violet'} />
          <Text c="dimmed">Preparing your training dashboard...</Text>
        </Stack>
      </Center>
    )
  }

  if (!authed) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        style={{
          minHeight: '100vh',
          background: surfaces.app,
          color: baseTextColor
        }}
      >
        <Container size="xs" px="md" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} style={{ width: '100%' }}>
            <Paper
              radius="lg"
              p="xl"
              withBorder
              style={{
                width: '100%',
                background: surfaces.panel,
                borderColor: surfaces.border,
                backdropFilter: 'blur(12px)',
                color: baseTextColor
              }}
            >
              <Stack gap="lg">
                <Stack gap={4}>
                  <Group gap="xs">
                    <IconSparkles size={20} color="var(--mantine-color-primary-4)" />
                    <Text fw={600}>{preset.label} · Lift Logger</Text>
                  </Group>
                  <Title order={2} fw={700}>
                    Welcome back
                  </Title>
                  <Text style={{ color: mutedTextColor }} size="sm">
                    Log in to track workouts, plan rest days, and discover new exercises curated for you.
                  </Text>
                </Stack>
                <form onSubmit={onLogin}>
                  <Stack gap="md">
                    <TextInput
                      label="Email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.currentTarget.value)}
                      required
                      leftSection={<IconMail size={18} />}
                      size="md"
                      radius="md"
                    />
                    <PasswordInput
                      label="Password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.currentTarget.value)}
                      required
                      leftSection={<IconLock size={18} />}
                      size="md"
                      radius="md"
                    />
                    <Button
                      type="submit"
                      size="md"
                      radius="md"
                      leftSection={<IconLogin size={18} />}
                      style={{
                        backgroundImage: accentGradient,
                        color: ctaTextColor,
                        border: 'none'
                      }}
                    >
                      Sign in
                    </Button>
                  </Stack>
                </form>
                <Text size="sm" style={{ color: mutedTextColor }}>
                  New here? Register via API: <Text component="span" fw={500}>POST /api/auth/register</Text>
                </Text>
              </Stack>
            </Paper>
          </motion.div>
        </Container>
      </motion.div>
    )
  }

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
            onLogout={onLogout}
            userLabel={email || 'Account'}
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
              <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
                <Paper
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
                </Paper>
              </motion.div>
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

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Suspense
        fallback={
          <Center mih="100vh">
            <Loader />
          </Center>
        }
      >
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/catalog" element={<CatalogPage />} />
        <Route path="/catalog/new" element={<CatalogCreatePage />} />
        <Route path="/catalog/:catalogId/edit" element={<CatalogCreatePage />} />
        <Route path="/catalog/:id/details" element={<ExerciseDetailsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

