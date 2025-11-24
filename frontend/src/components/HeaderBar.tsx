import React from 'react'
import { useMediaQuery } from '@mantine/hooks'
import HeaderBarDesktop from './HeaderBarDesktop'
import HeaderBarMobile from './HeaderBarMobile'
import type { SaveMode } from '@/store/useWorkoutStore'

export type SavingState = 'idle' | 'saving' | 'saved' | 'error'

type HeaderBarProps = {
  showBack?: boolean
  onBack?: () => void
  onBrowseCatalog: () => void
  onSave: () => void
  saving?: SavingState
  saveMode?: SaveMode | null
  lastSavedAt?: number | null
}

export default function HeaderBar(props: HeaderBarProps) {
  const isMobile = useMediaQuery('(max-width: 640px)')

  return isMobile ? <HeaderBarMobile {...props} /> : <HeaderBarDesktop {...props} />
}


