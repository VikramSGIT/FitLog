import React, { useMemo } from 'react'
import { ActionIcon, Box, Button, Container, Paper, Stack, Tooltip, useMantineTheme } from '@mantine/core'
import { useNavigate } from 'react-router-dom'
import CatalogBrowser from '@/components/CatalogBrowser'
import { DEFAULT_SURFACES, ThemeSurfaces } from '@/theme'
import HeaderBar from '@/components/HeaderBar'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import { api } from '@/api/client'
import { IconArrowLeft, IconCirclePlus, IconPlus } from '@/icons/tabler'
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
  const flush = useWorkoutStore((s) => s.flush)
  const saving = useWorkoutStore((s) => s.saving)
  const lastSavedAt = useWorkoutStore((s) => s.lastSavedAt)

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
        onSave={() => flush()}
        saving={saving as any}
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
        <CatalogBrowser
          headerAddon={
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
          }
        />
      ) : (
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
      )}
    </Box>
  )
}


