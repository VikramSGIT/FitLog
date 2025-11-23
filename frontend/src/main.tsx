import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import '@mantine/dates/styles.css'
import React, { useEffect, useMemo, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { Global } from '@emotion/react'
import { MantineProvider, createTheme } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import App from './App'
import { ThemePreset, ThemePresetContext } from './theme'

const THEME_STORAGE_KEY = 'liftLogger.themePreset'

const themePresets: ThemePreset[] = [
  {
    id: 'void',
    label: 'Void',
    colorScheme: 'dark',
    primaryColor: 'cyan',
    accentGradient: 'linear-gradient(135deg, #22d3ee 0%, #6366f1 100%)',
    surfaces: {
      app: 'linear-gradient(160deg, #020617 0%, #0f172a 60%, #1e293b 100%)',
      header: 'rgba(2, 6, 23, 0.9)',
      panel: 'rgba(15, 23, 42, 0.85)',
      card: 'rgba(30, 41, 59, 0.88)',
      border: 'rgba(34, 211, 238, 0.25)'
    }
  },
  {
    id: 'nebula',
    label: 'Nebula',
    colorScheme: 'dark',
    primaryColor: 'grape',
    accentGradient: 'linear-gradient(135deg, #c084fc 0%, #60a5fa 100%)',
    surfaces: {
      app: 'linear-gradient(160deg, #0b0b1f 0%, #1a103d 52%, #312e81 100%)',
      header: 'rgba(18, 12, 48, 0.9)',
      panel: 'rgba(27, 19, 63, 0.82)',
      card: 'rgba(35, 25, 75, 0.84)',
      border: 'rgba(129, 140, 248, 0.35)'
    }
  },
  {
    id: 'twilight',
    label: 'Twilight',
    colorScheme: 'dark',
    primaryColor: 'indigo',
    accentGradient: 'linear-gradient(135deg, #818cf8 0%, #f472b6 100%)',
    surfaces: {
      app: 'linear-gradient(160deg, #0f172a 0%, #1e293b 45%, #475569 100%)',
      header: 'rgba(17, 24, 39, 0.88)',
      panel: 'rgba(23, 31, 51, 0.82)',
      card: 'rgba(38, 51, 74, 0.84)',
      border: 'rgba(148, 163, 184, 0.35)'
    }
  },
  {
    id: 'aurora',
    label: 'Aurora',
    colorScheme: 'light',
    primaryColor: 'teal',
    accentGradient: 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)',
    surfaces: {
      app: 'linear-gradient(150deg, #f0fdfa 0%, #ecfeff 45%, #e0f2fe 100%)',
      header: 'rgba(224, 242, 254, 0.92)',
      panel: 'rgba(236, 253, 245, 0.9)',
      card: 'rgba(224, 242, 254, 0.92)',
      border: 'rgba(45, 212, 191, 0.35)'
    }
  },
  {
    id: 'daybreak',
    label: 'Daybreak',
    colorScheme: 'light',
    primaryColor: 'orange',
    accentGradient: 'linear-gradient(135deg, #f97316 0%, #facc15 100%)',
    surfaces: {
      app: 'linear-gradient(150deg, #fff7ed 0%, #fde68a 55%, #fcd34d 100%)',
      header: 'rgba(255, 251, 235, 0.9)',
      panel: 'rgba(254, 240, 199, 0.9)',
      card: 'rgba(253, 226, 138, 0.92)',
      border: 'rgba(234, 88, 12, 0.3)'
    }
  }
]

function Root() {
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

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <Root />
    </React.StrictMode>
  )
}

