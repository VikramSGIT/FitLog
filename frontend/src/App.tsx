import React, { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Center, Loader } from '@mantine/core'
import AuthGate from './components/AuthGate'

const CatalogPage = lazy(() => import('./pages/CatalogPage'))
const CatalogCreatePage = lazy(() => import('./pages/CatalogCreatePage'))
const ExerciseDetailsPage = lazy(() => import('./pages/ExerciseDetailsPage'))

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Suspense
        fallback={
          <Center mih="100vh">
            <Loader />
          </Center>
        }
      >
        <Routes>
          <Route path="/" element={<AuthGate />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/catalog/new" element={<CatalogCreatePage />} />
          <Route path="/catalog/:catalogId/edit" element={<CatalogCreatePage />} />
          <Route path="/catalog/:id/details" element={<ExerciseDetailsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
