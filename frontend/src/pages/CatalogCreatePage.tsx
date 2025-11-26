import React from 'react'
import {
  Box,
  Button,
  Group,
  Modal,
  Stack,
  Text,
  useMantineTheme
} from '@mantine/core'
import { IconTrash } from '@tabler/icons-react'
import { useNavigate } from 'react-router-dom'
import HeaderBar from '@/components/HeaderBar'
import { DEFAULT_SURFACES, ThemeSurfaces, useThemePreset } from '@/theme'
import { api } from '@/api/client'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import { useMediaQuery } from '@mantine/hooks'
import { useCatalogCreateData } from '@/hooks/useCatalogCreateData'
import { MobileCatalogCreate } from '@/pages/CatalogCreate/MobileCatalogCreate'
import { DesktopCatalogCreate } from '@/pages/CatalogCreate/DesktopCatalogCreate'

export default function CatalogCreatePage() {
  const theme = useMantineTheme()
  const navigate = useNavigate()
  const { preset } = useThemePreset()
  const isMobile = useMediaQuery('(max-width: 640px)')
  const surfaces = (theme.other?.surfaces as ThemeSurfaces) ?? DEFAULT_SURFACES
  const baseTextColor = (theme.other?.textColor as string) ?? (preset.colorScheme === 'light' ? '#0f172a' : '#f8fafc')

  const sync = useWorkoutStore((s) => s.sync)
  const saveStatus = useWorkoutStore((s) => s.saveStatus)
  const saveMode = useWorkoutStore((s) => s.saveMode)
  const lastSavedAt = null

  const {
    form,
    setForm,
    facets,
    hasImage,
    imageUrl,
    loadingFacets,
    submitting,
    fieldErrors,
    loadingEntry,
    imageHovered,
    setImageHovered,
    deleteModalOpen,
    setDeleteModalOpen,
    deleting,
    fileInputRef,
    updateField,
    handleSubmit,
    handleDelete,
    isEditMode,
  } = useCatalogCreateData()

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
        onSave={() => sync()}
        saving={saveStatus === 'saving' ? 'saving' : (saveStatus === 'saved' ? 'saved' : 'idle')}
        saveMode={saveMode}
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
        <MobileCatalogCreate 
          form={form}
          setForm={setForm}
          facets={facets}
          hasImage={hasImage}
          imageUrl={imageUrl}
          loadingFacets={loadingFacets}
          submitting={submitting}
          fieldErrors={fieldErrors}
          loadingEntry={loadingEntry}
          imageHovered={imageHovered}
          setImageHovered={setImageHovered}
          setDeleteModalOpen={setDeleteModalOpen}
          deleting={deleting}
          fileInputRef={fileInputRef}
          updateField={updateField}
          handleSubmit={handleSubmit}
          isEditMode={isEditMode}
          navigate={navigate}
        />
      ) : (
        <DesktopCatalogCreate 
          form={form}
          setForm={setForm}
          facets={facets}
          hasImage={hasImage}
          imageUrl={imageUrl}
          loadingFacets={loadingFacets}
          submitting={submitting}
          fieldErrors={fieldErrors}
          loadingEntry={loadingEntry}
          imageHovered={imageHovered}
          setImageHovered={setImageHovered}
          setDeleteModalOpen={setDeleteModalOpen}
          deleting={deleting}
          fileInputRef={fileInputRef}
          updateField={updateField}
          handleSubmit={handleSubmit}
          isEditMode={isEditMode}
          navigate={navigate}
        />
      )}

      <Modal
        opened={deleteModalOpen}
        onClose={() => !deleting && setDeleteModalOpen(false)}
        title="Delete catalog exercise"
        radius="md"
        centered
      >
        <Stack gap="md">
          <Text>
            Are you sure you want to delete <strong>{form.name}</strong> from the catalog? This action cannot be undone.
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button
              variant="subtle"
              onClick={() => setDeleteModalOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              color="red"
              onClick={handleDelete}
              loading={deleting}
              leftSection={<IconTrash size={16} />}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  )
}