import React, { useEffect, useMemo, useState } from 'react'
import { Global } from '@emotion/react'
import { MantineProvider, createTheme } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { THEME_STORAGE_KEY, themePresets } from '../themes'
import { ThemePresetContext } from '../theme'
import App from '../App'

export function ThemeProvider() {
  const [presetId, setPresetId] = useState<string>(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(THEME_STORAGE_KEY) : null
    return stored && themePresets.some((preset) => preset.id === stored) ? stored : themePresets[0].id
  })

  const preset = useMemo(
    () => themePresets.find((item) => item.id === presetId) ?? themePresets[0],
    [presetId]
  )

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, preset.id)
  }, [preset.id])

  const baseTextColor = preset.colorScheme === 'light' ? '#0f172a' : '#f8fafc'
  const mutedTextColor = preset.colorScheme === 'light' ? 'rgba(15, 23, 42, 0.65)' : 'rgba(226, 232, 240, 0.72)'

  const theme = useMemo(
    () =>
      createTheme({
        fontFamily: '"Open Sans", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        headings: {
          fontFamily: '"Open Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
        },
        defaultRadius: 'md',
        primaryColor: preset.primaryColor,
        other: {
          accentGradient: preset.accentGradient,
          surfaces: preset.surfaces,
          textColor: baseTextColor,
          mutedText: mutedTextColor
        }
      }),
    [preset, baseTextColor, mutedTextColor]
  )

  const selectPreset = (id: string) => {
    if (id === preset.id) return
    const exists = themePresets.some((item) => item.id === id)
    setPresetId(exists ? id : themePresets[0].id)
  }

  return (
    <ThemePresetContext.Provider value={{ preset, selectPreset, presets: themePresets }}>
      <MantineProvider
        theme={theme}
        defaultColorScheme={preset.colorScheme}
        forceColorScheme={preset.colorScheme}
      >
        <Global
          styles={{
            '*': {
              fontFamily: 'inherit'
            },
            // Prevent press-down shift on all buttons/icons across the app
            '.mantine-Button-root:active, .mantine-ActionIcon-root:active, .mantine-Button-root[data-active], .mantine-ActionIcon-root[data-active]': {
              transform: 'none !important'
            },
            // Keep outline/border changes from affecting layout
            '.mantine-Button-root, .mantine-ActionIcon-root': {
              outlineOffset: 2,
              borderWidth: 1
            },
            body: {
              fontFamily: '"Open Sans", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
              background: preset.surfaces.app,
              color: baseTextColor,
              minHeight: '100vh',
              margin: 0,
              WebkitFontSmoothing: 'antialiased',
              MozOsxFontSmoothing: 'grayscale'
            },
            '#root': {
              minHeight: '100vh'
            }
          }}
        />
        <Notifications position="top-right" />
        <App />
      </MantineProvider>
    </ThemePresetContext.Provider>
  )
}
