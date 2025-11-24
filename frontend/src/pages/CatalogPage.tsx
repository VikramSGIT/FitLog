import React from 'react'
import { useMediaQuery } from '@mantine/hooks'
import CatalogPageDesktop from './CatalogPageDesktop'
import CatalogPageMobile from './CatalogPageMobile'

export default function CatalogPage() {
  const isMobile = useMediaQuery('(max-width: 640px)')

  return isMobile ? <CatalogPageMobile /> : <CatalogPageDesktop />
}


