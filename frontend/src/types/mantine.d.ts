import '@mantine/core'

declare module '@mantine/core' {
  interface MantineTheme {
    colorScheme?: 'light' | 'dark'
  }
}

