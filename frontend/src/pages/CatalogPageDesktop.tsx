import React, { useMemo } from 'react'
import { Box, Button, Container, Paper, Stack, useMantineTheme } from '@mantine/core'
import { useNavigate } from 'react-router-dom'
import CatalogBrowser from '@/components/CatalogBrowser'
import { DEFAULT_SURFACES, ThemeSurfaces, useThemePreset } from '@/theme'
import HeaderBar from '@/components/HeaderBar'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import { IconArrowLeft, IconPlus } from '@tabler/icons-react'
import { useAuth } from '@/hooks/useAuth'

export default function CatalogPageDesktop() {
  const theme = useMantineTheme()
  const { preset } = useThemePreset()
  const navigate = useNavigate()
  const surfaces = useMemo<ThemeSurfaces>(
    () => (theme.other?.surfaces as ThemeSurfaces) ?? DEFAULT_SURFACES,
    [theme]
  )
  const baseTextColor = (theme.other?.textColor as string) ?? (preset.colorScheme === 'light' ? '#0f172a' : '#f8fafc')
  const neutralButtonBackground =
    preset.colorScheme === 'light' ? surfaces.panel ?? '#ffffff' : surfaces.card ?? '#0b1020'
  const neutralBorderColor = surfaces.border ?? 'rgba(148, 163, 184, 0.35)'
  const flush = useWorkoutStore((s) => s.flush)
  const saving = useWorkoutStore((s) => s.saving)
  const lastSaveMode = useWorkoutStore((s) => s.lastSaveMode)
  const lastSavedAt = useWorkoutStore((s) => s.lastSavedAt)

  return (
    <Box
      style={{
        minHeight: '100vh',
        background: surfaces.app,
        color: baseTextColor,
        paddingBottom: '4rem',
      }}
    >
      <HeaderBar
        onBrowseCatalog={() => navigate('/catalog')}
        onSave={() => flush('manual')}
        saving={saving as any}
        saveMode={lastSaveMode}
        lastSavedAt={lastSavedAt}
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
              borderColor: surfaces.border
            }}
          >
            <Stack gap="lg">
              <Button
                variant="subtle"
                leftSection={<IconArrowLeft size={16} />}
                onClick={() => navigate('/')}
                style={{ alignSelf: 'flex-start' }}
              >
                Back to workouts
              </Button>
              <CatalogBrowser
                headerAddon={
                    <Button
                      size="md"
                      radius="md"
                      leftSection={<IconPlus size={20} />}
                      onClick={() => navigate('/catalog/new')}
                      styles={{
                        root: {
                          background: neutralButtonBackground,
                          border: `1px solid ${neutralBorderColor}`,
                          color: baseTextColor,
                          '&:hover': {
                            background: neutralButtonBackground,
                            border: `1px solid ${neutralBorderColor}`
                          }
                        }
                      }}
                    >
                      Add catalog exercise
                    </Button>
                }
              />
            </Stack>
          </Paper>
        </Stack>
      </Container>
    </Box>
  )
}
