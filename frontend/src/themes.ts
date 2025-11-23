import { ThemePreset } from './theme'

export const THEME_STORAGE_KEY = 'liftLogger.themePreset'

export const themePresets: ThemePreset[] = [
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
