import { createContext, useContext } from 'react'
import type { MantineColorScheme } from '@mantine/core'

export type ThemeSurfaces = {
  app: string
  header: string
  panel: string
  card: string
  border: string
}

export type ThemePreset = {
  id: string
  label: string
  colorScheme: MantineColorScheme
  primaryColor: string
  accentGradient: string
  surfaces: ThemeSurfaces
}

export const DEFAULT_SURFACES: ThemeSurfaces = {
  app: 'linear-gradient(160deg, rgba(20, 18, 35, 1) 0%, rgba(14, 16, 32, 1) 40%, rgba(35, 23, 59, 1) 100%)',
  header: 'rgba(10, 12, 28, 0.9)',
  panel: 'rgba(20, 22, 39, 0.85)',
  card: 'rgba(26, 28, 45, 0.85)',
  border: 'rgba(135, 96, 255, 0.2)'
}

export type ThemePresetContextValue = {
  preset: ThemePreset
  selectPreset: (id: string) => void
  presets: ThemePreset[]
}

export const ThemePresetContext = createContext<ThemePresetContextValue | undefined>(undefined)

export function useThemePreset() {
  const ctx = useContext(ThemePresetContext)
  if (!ctx) {
    throw new Error('useThemePreset must be used inside a ThemePresetContext provider')
  }
  return ctx
}


