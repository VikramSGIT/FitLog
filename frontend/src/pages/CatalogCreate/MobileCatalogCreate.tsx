import React from 'react'
import {
  ActionIcon,
  Autocomplete,
  Button,
  Group,
  NumberInput,
  Paper,
  Stack,
  TagsInput,
  Text,
  Textarea,
  TextInput,
  Title,
  useMantineTheme
} from '@mantine/core'
import { IconArrowLeft, IconDeviceFloppy, IconPhoto, IconTrash, IconX } from '@tabler/icons-react'
import { ThemeSurfaces, useThemePreset } from '@/theme'
import { useCatalogCreateData, FormState, FacetsState, FieldErrorMap } from '@/hooks/useCatalogCreateData'

import { NavigateFunction } from 'react-router-dom'

interface MobileCatalogCreateProps {
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  facets: FacetsState
  hasImage: boolean
  imageUrl: string | null
  loadingFacets: boolean
  submitting: boolean
  fieldErrors: FieldErrorMap
  loadingEntry: boolean
  imageHovered: boolean
  setImageHovered: (hovered: boolean) => void
  setDeleteModalOpen: (open: boolean) => void
  deleting: boolean
  fileInputRef: React.RefObject<HTMLInputElement>
  updateField: <K extends keyof FormState>(field: K, value: FormState[K]) => void
  handleSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>
  isEditMode: boolean
  navigate: NavigateFunction
}

export const MobileCatalogCreate: React.FC<MobileCatalogCreateProps> = ({
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
  setDeleteModalOpen,
  deleting,
  fileInputRef,
  updateField,
  handleSubmit,
  isEditMode,
  navigate
}) => {
  const theme = useMantineTheme()
  const { preset } = useThemePreset()
  const surfaces = theme.other?.surfaces as ThemeSurfaces || {}
  const baseTextColor = (theme.other?.textColor as string) ?? (preset.colorScheme === 'light' ? '#0f172a' : '#f8fafc')
  const accentGradient = (theme.other?.accentGradient as string) ?? 'linear-gradient(135deg, #8f5afc 0%, #5197ff 100%)'

  const disableControls = loadingEntry || submitting || deleting
  const pageTitle = isEditMode ? 'Edit catalog exercise' : 'Add catalog exercise'
  const submitLabel = isEditMode ? 'Update exercise' : 'Save exercise'

  return (
    <Paper
      component="form"
      onSubmit={handleSubmit}
      radius={0}
      withBorder={false}
      p="md"
      style={{
        background: surfaces.panel,
        borderColor: surfaces.border,
        color: baseTextColor,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      <Stack gap="md" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <Group justify="space-between" align="center" wrap="nowrap">
          <ActionIcon
            variant="outline"
            color={theme.primaryColor}
            radius="md"
            size="lg"
            onClick={() => navigate('/catalog')}
            aria-label="Back"
          >
            <IconArrowLeft size={18} />
          </ActionIcon>
          <Title order={3} style={{ margin: 0, flex: 1, textAlign: 'center' }}>
            {pageTitle}
          </Title>
          {isEditMode ? (
            <ActionIcon
              variant="outline"
              color="red"
              radius="md"
              size="lg"
              onClick={() => setDeleteModalOpen(true)}
              disabled={disableControls}
              aria-label="Delete exercise"
            >
              <IconTrash size={18} />
            </ActionIcon>
          ) : (
            <div style={{ width: 40 }} />
          )}
        </Group>
        <Stack gap="md" style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <Group align="flex-start" gap="md" wrap='wrap'>
            <Stack gap={8} style={{ flexShrink: 0 }}>
              <div
                style={{
                  width: 160,
                  height: 160,
                  borderRadius: 12,
                  overflow: 'hidden',
                  border: `1px solid ${surfaces.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: hasImage ? '#ffffff' : surfaces.panel,
                  position: 'relative'
                }}
              >
                {form.imageFile ? (
                  <img
                    src={URL.createObjectURL(form.imageFile)}
                    alt="Preview"
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  />
                ) : form.hasImage && imageUrl ? (
                  <img
                    src={imageUrl}
                    alt="Existing exercise image"
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <Text size="sm" c="dimmed">
                    No image
                  </Text>
                )}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0, 0, 0, 0.5)',
                    borderRadius: 12,
                    gap: 8
                  }}
                >
                  {hasImage ? (
                    <ActionIcon
                      size="lg"
                      radius="md"
                      variant="filled"
                      color="red"
                      onClick={() => {
                        if (form.imageFile) {
                          setForm((prev) => ({ ...prev, imageFile: null }))
                        } else if (form.hasImage) {
                          setForm((prev) => ({ ...prev, hasImage: false }))
                        }
                      }}
                      disabled={disableControls}
                      style={{ zIndex: 1 }}
                    >
                      <IconX size={20} />
                    </ActionIcon>
                  ) : (
                    <ActionIcon
                      size="lg"
                      radius="md"
                      variant="filled"
                      color={theme.primaryColor}
                      onClick={() => fileInputRef.current?.click()}
                      disabled={disableControls}
                      style={{ zIndex: 1 }}
                    >
                      <IconPhoto size={20} />
                    </ActionIcon>
                  )}
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/apng"
                disabled={disableControls || hasImage}
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0] || null
                  setForm((prev) => ({ ...prev, imageFile: file }))
                }}
                style={{ display: 'none' }}
              />
            </Stack>
            <Stack gap="md" style={{ flex: 1, justifyContent: 'flex-start' }}>
              <TextInput
                label="Exercise name"
                placeholder="e.g., Barbell Romanian Deadlift"
                required
                radius="md"
                size="md"
                value={form.name}
                disabled={disableControls}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.currentTarget.value }))}
              />
              <Textarea
                label="Description"
                placeholder="Short instructions, cues, or variations"
                minRows={1}
                maxRows={3}
                autosize
                radius="md"
                size="md"
                value={form.description}
                disabled={disableControls}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.currentTarget.value }))}
                styles={{
                  input: {
                    overflow: 'auto'
                  }
                }}
              />
            </Stack>
          </Group>

          <Group grow align="start">
            <Autocomplete
              label="Exercise type"
              placeholder="e.g., Strength"
              data={facets.types}
              radius="md"
              size="md"
              value={form.type}
              onChange={(value) => updateField('type', value)}
              disabled={disableControls || (loadingFacets && facets.types.length === 0)}
              required
              error={fieldErrors.type}
            />
            <Autocomplete
              label="Body part"
              placeholder="e.g., Posterior chain"
              data={facets.bodyParts}
              radius="md"
              size="md"
              value={form.bodyPart}
              onChange={(value) => updateField('bodyPart', value)}
              disabled={disableControls || (loadingFacets && facets.bodyParts.length === 0)}
              required
              error={fieldErrors.bodyPart}
            />
          </Group>

          <Group grow align="start">
            <Autocomplete
              label="Equipment"
              placeholder="e.g., Barbell"
              data={facets.equipment}
              radius="md"
              size="md"
              value={form.equipment}
              onChange={(value) => updateField('equipment', value)}
              disabled={disableControls || (loadingFacets && facets.equipment.length === 0)}
              required
              error={fieldErrors.equipment}
            />
            <Autocomplete
              label="Level"
              placeholder="e.g., Intermediate"
              data={facets.levels}
              radius="md"
              size="md"
              value={form.level}
              onChange={(value) => updateField('level', value)}
              disabled={disableControls || (loadingFacets && facets.levels.length === 0)}
              required
              error={fieldErrors.level}
            />
          </Group>

          <TagsInput
            label="Primary muscles"
            placeholder="Type a muscle and press Enter"
            description="Choose one or more primary muscles"
            radius="md"
            size="md"
            value={form.primaryMuscles}
            data={facets.muscles}
            disabled={disableControls}
            required
            error={fieldErrors.primaryMuscles}
            onChange={(value) => updateField('primaryMuscles', value)}
          />

          <TagsInput
            label="Secondary muscles"
            placeholder="Type a muscle and press Enter"
            radius="md"
            size="md"
            value={form.secondaryMuscles}
            data={facets.muscles}
            disabled={disableControls}
            onChange={(value) => setForm((prev) => ({ ...prev, secondaryMuscles: value }))}
          />

          <TagsInput
            label="Reference links"
            placeholder="https://example.com/demo"
            radius="md"
            size="md"
            value={form.links}
            disabled={disableControls}
            onChange={(value) => setForm((prev) => ({ ...prev, links: value }))}
          />

          <Group grow align="start">
            <NumberInput
              label="Multiplier"
              placeholder="Defaults to 1.0"
              radius="md"
              size="md"
              min={0}
              step={0.05}
              value={form.multiplier}
              disabled={disableControls}
              onChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  multiplier: value === null ? '' : typeof value === 'number' ? value.toString() : value
                }))
              }
            />
            <NumberInput
              label="Base weight (kg)"
              placeholder="Defaults to 0"
              radius="md"
              size="md"
              min={0}
              step={0.5}
              value={form.baseWeightKg}
              disabled={disableControls}
              onChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  baseWeightKg: value === null ? '' : typeof value === 'number' ? value.toString() : value
                }))
              }
            />
          </Group>

          <Group justify="space-between" mt="md" style={{ flexShrink: 0 }}>
            <Button
              type="submit"
              radius="md"
              leftSection={<IconDeviceFloppy size={16} />}
              loading={submitting}
              disabled={disableControls}
              style={{ marginLeft: 'auto' }}
              styles={{
                root: {
                  backgroundImage: accentGradient,
                  border: 'none',
                  color: theme.colorScheme === 'light' ? '#0f172a' : '#f8fafc'
                }
              }}
            >
              {submitLabel}
            </Button>
          </Group>
        </Stack>
      </Stack>
    </Paper>
  )
}
