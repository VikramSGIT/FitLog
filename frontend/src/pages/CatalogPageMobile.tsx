import React, { useMemo } from 'react'
import { ActionIcon, Box, Tooltip, useMantineTheme } from '@mantine/core'
import { useNavigate } from 'react-router-dom'
import CatalogBrowser from '@/components/CatalogBrowser'
import { DEFAULT_SURFACES, ThemeSurfaces, useThemePreset } from '@/theme'
import { IconPlus } from '@tabler/icons-react'

export default function CatalogPageMobile() {
  const theme = useMantineTheme()
  const { preset } = useThemePreset();
  const navigate = useNavigate()
  const surfaces = useMemo<ThemeSurfaces>(
    () => (theme.other?.surfaces as ThemeSurfaces) ?? DEFAULT_SURFACES,
    [theme]
  )
  const baseTextColor = (theme.other?.textColor as string) ?? (preset.colorScheme === 'light' ? '#0f172a' : '#f8fafc')
  const neutralButtonBackground =
    preset.colorScheme === 'light' ? surfaces.panel ?? '#ffffff' : surfaces.card ?? '#0b1020'
  const neutralBorderColor = surfaces.border ?? 'rgba(148, 163, 184, 0.35)'

  return (
    <Box
      style={{
        minHeight: '100vh',
        height: '100vh',
        background: surfaces.panel,
        color: baseTextColor,
        paddingBottom: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
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
    </Box>
  )
}
