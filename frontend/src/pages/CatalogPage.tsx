import React, { useMemo } from 'react'
import { ActionIcon, Box, Button, Container, Paper, Stack, Tooltip, useMantineTheme } from '@mantine/core'
import { useNavigate } from 'react-router-dom'
import CatalogBrowser from '@/components/CatalogBrowser'
import { DEFAULT_SURFACES, ThemeSurfaces } from '@/theme'
import HeaderBar from '@/components/HeaderBar'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import { api } from '@/api/client'
import { IconArrowLeft, IconCirclePlus, IconPlus } from '@tabler/icons-react'
import { useMediaQuery } from '@mantine/hooks'

export default function CatalogPage() {
  const theme = useMantineTheme()
  const navigate = useNavigate()
  const surfaces = useMemo<ThemeSurfaces>(
    () => (theme.other?.surfaces as ThemeSurfaces) ?? DEFAULT_SURFACES,
    [theme]
  )
  const isMobile = useMediaQuery('(max-width: 640px)')
  const baseTextColor = (theme.other?.textColor as string) ?? (theme.colorScheme === 'light' ? '#0f172a' : '#f8fafc')
  const neutralButtonBackground =
    theme.colorScheme === 'light' ? surfaces.panel ?? '#ffffff' : surfaces.card ?? '#0b1020'
  const neutralBorderColor = surfaces.border ?? 'rgba(148, 163, 184, 0.35)'
  const accentGradient = (theme.other?.accentGradient as string) ?? 'linear-gradient(135deg, #8f5afc 0%, #5197ff 100%)'
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
                  isMobile ? (
                    <Tooltip label="Add catalog exercise" position="left" withArrow>
                      <ActionIcon
                        size="lg"
                        radius="md"
                        onClick={() => navigate('/catalog/new')}
                        style={{
                          background: neutralButtonBackground,
                          border: `1px solid ${neutralBorderColor}`,
                          color: baseTextColor,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <IconPlus size={20} />
                      </ActionIcon>
                    </Tooltip>
                  ) : (
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
                  )
                }
              />
            </Stack>
          </Paper>
        </Stack>
      </Container>
    </Box>
  )
}


