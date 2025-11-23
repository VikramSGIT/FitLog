import React from 'react'
import { Center, Loader, Stack, Text } from '@mantine/core'
import { useAuth } from '@/hooks/useAuth'
import LoginPage from '@/pages/LoginPage'
import MainApp from '@/pages/MainApp'
import { useThemePreset } from '@/theme'

export default function AuthGate() {
  const { authed, checkingSession } = useAuth()
  const { preset } = useThemePreset()

  if (checkingSession) {
    return (
      <Center mih="100vh" style={{ background: preset.surfaces.app }}>
        <Stack align="center" gap="md">
          <Loader size="lg" color={preset.primaryColor ?? 'violet'} />
          <Text c="dimmed">Preparing your training dashboard...</Text>
        </Stack>
      </Center>
    )
  }

  if (!authed) {
    return <LoginPage />
  }

  return <MainApp />
}
