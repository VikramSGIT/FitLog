import React, { useState } from 'react'
import { Box, Button, Container, Group, Paper, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core'
import { IconLogin, IconMail, IconLock, IconSparkles } from '@tabler/icons-react'
import { motion } from 'framer-motion'
import { useThemePreset, DEFAULT_SURFACES } from '@/theme'
import { useAuth } from '@/hooks/useAuth'

const MotionPaper = motion.create(Paper)
const MotionBox = motion.create(Box)

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { login } = useAuth()
  const { preset } = useThemePreset()

  const surfaces = preset.surfaces ?? DEFAULT_SURFACES
  const accentGradient = preset.accentGradient
  const baseTextColor = preset.colorScheme === 'light' ? '#0f172a' : '#f8fafc'
  const mutedTextColor = preset.colorScheme === 'light' ? 'rgba(15, 23, 42, 0.65)' : 'rgba(226, 232, 240, 0.72)'
  const ctaTextColor = preset.colorScheme === 'light' ? '#0f172a' : '#f8fafc'

  async function onLogin(e: React.FormEvent) {
    e.preventDefault()
    try {
      await login(email, password)
    } catch {
      // handled in useAuth hook
    }
  }

  return (
    <Box
      component={MotionBox}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      style={{
        minHeight: '100vh',
        background: surfaces.app,
        color: baseTextColor,
      }}
    >
      <Container size="xs" px="md" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
        <MotionPaper
          radius="lg"
          p="xl"
          withBorder
          style={{
            width: '100%',
            background: surfaces.panel,
            borderColor: surfaces.border,
            backdropFilter: 'blur(12px)',
            color: baseTextColor,
          }}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
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
                    border: 'none',
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
        </MotionPaper>
      </Container>
    </Box>
  )
}
