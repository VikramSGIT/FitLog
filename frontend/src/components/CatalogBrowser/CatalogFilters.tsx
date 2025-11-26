import React from 'react'
import { Badge, Group, SimpleGrid, Select, ActionIcon } from '@mantine/core'
import { IconX } from '@tabler/icons-react'
import { motion, AnimatePresence } from 'framer-motion'
import { ThemeSurfaces } from '@/theme'

const toSelectOptions = (values: string[]) => values.map((value) => ({ value, label: value }))

type CatalogFiltersProps = {
  q: string
  setQ: (val: string) => void
  type: string
  setType: (val: string) => void
  bodyPart: string
  setBodyPart: (val: string) => void
  equipment: string
  setEquipment: (val: string) => void
  level: string
  setLevel: (val: string) => void
  muscle: string
  setMuscle: (val: string) => void
  setPage: (val: number) => void
  facets: {
    types: string[]
    bodyParts: string[]
    equipment: string[]
    levels: string[]
    muscles: string[]
  }
  showFilters: boolean
  baseTextColor: string
  embedded: boolean
}

export function CatalogFilters({
  q, setQ,
  type, setType,
  bodyPart, setBodyPart,
  equipment, setEquipment,
  level, setLevel,
  muscle, setMuscle,
  setPage,
  facets,
  showFilters,
  baseTextColor,
  embedded
}: CatalogFiltersProps) {
  return (
    <>
      {(q || type || bodyPart || equipment || level || muscle) && (
        <Group gap={8} wrap="wrap" style={{ marginTop: 8 }}>
          {q && (
            <Badge
              variant="light"
              radius={0}
              rightSection={
                <IconX
                  size={12}
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setQ('')
                    setPage(1)
                  }}
                />
              }
              styles={{
                root: {
                  background: 'rgba(99,102,241,0.12)',
                  border: '1px solid transparent',
                  color: baseTextColor
                }
              }}
            >
              Search: {q}
            </Badge>
          )}
          {type && (
            <Badge
              variant="light"
              radius={0}
              rightSection={
                <IconX
                  size={12}
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setType('')
                    setPage(1)
                  }}
                />
              }
              styles={{ root: { background: 'rgba(99,102,241,0.12)', color: baseTextColor } }}
            >
              Type: {type}
            </Badge>
          )}
          {bodyPart && (
            <Badge
              variant="light"
              radius={0}
              rightSection={
                <IconX
                  size={12}
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setBodyPart('')
                    setPage(1)
                  }}
                />
              }
              styles={{ root: { background: 'rgba(59,130,246,0.12)', color: baseTextColor } }}
            >
              Body: {bodyPart}
            </Badge>
          )}
          {equipment && (
            <Badge
              variant="light"
              radius={0}
              rightSection={
                <IconX
                  size={12}
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setEquipment('')
                    setPage(1)
                  }}
                />
              }
              styles={{ root: { background: 'rgba(147,51,234,0.12)', color: baseTextColor } }}
            >
              Equipment: {equipment}
            </Badge>
          )}
          {level && (
            <Badge
              variant="light"
              radius={0}
              rightSection={
                <IconX
                  size={12}
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setLevel('')
                    setPage(1)
                  }}
                />
              }
              styles={{ root: { background: 'rgba(8,145,178,0.12)', color: baseTextColor } }}
            >
              Level: {level}
            </Badge>
          )}
          {muscle && (
            <Badge
              variant="light"
              radius={0}
              rightSection={
                <IconX
                  size={12}
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setMuscle('')
                    setPage(1)
                  }}
                />
              }
              styles={{ root: { background: 'rgba(99,102,241,0.12)', color: baseTextColor } }}
            >
              Muscle: {muscle}
            </Badge>
          )}
        </Group>
      )}

      <AnimatePresence initial={false}>
        {showFilters && (
          <motion.div
            key="filters"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 240, damping: 24, mass: 0.6 }}
          >
            <SimpleGrid cols={{ base: 2, sm: 3, lg: embedded ? 3 : 5 }} spacing="sm">
              <Select
                data={toSelectOptions(facets.types)}
                placeholder="Type"
                value={type}
                onChange={(value) => {
                  setType(value || '')
                  setPage(1)
                }}
                clearable
                size="sm"
                radius={0}
                checkIconPosition="right"
                variant="filled"
                styles={{
                  input: {
                    background: 'rgba(99,102,241,0.12)',
                    borderColor: 'transparent',
                    color: baseTextColor,
                    borderRadius: 0
                  }
                }}
              />
              <Select
                data={toSelectOptions(facets.bodyParts)}
                placeholder="Body part"
                value={bodyPart}
                onChange={(value) => {
                  setBodyPart(value || '')
                  setPage(1)
                }}
                clearable
                size="sm"
                radius={0}
                checkIconPosition="right"
                variant="filled"
                styles={{
                  input: {
                    background: 'rgba(59,130,246,0.12)',
                    borderColor: 'transparent',
                    color: baseTextColor,
                    borderRadius: 0
                  }
                }}
              />
              <Select
                data={toSelectOptions(facets.equipment)}
                placeholder="Equipment"
                value={equipment}
                onChange={(value) => {
                  setEquipment(value || '')
                  setPage(1)
                }}
                clearable
                size="sm"
                radius={0}
                checkIconPosition="right"
                variant="filled"
                styles={{
                  input: {
                    background: 'rgba(147,51,234,0.12)',
                    borderColor: 'transparent',
                    color: baseTextColor,
                    borderRadius: 0
                  }
                }}
              />
              <Select
                data={toSelectOptions(facets.levels)}
                placeholder="Level"
                value={level}
                onChange={(value) => {
                  setLevel(value || '')
                  setPage(1)
                }}
                clearable
                size="sm"
                radius={0}
                checkIconPosition="right"
                variant="filled"
                styles={{
                  input: {
                    background: 'rgba(8,145,178,0.12)',
                    borderColor: 'transparent',
                    color: baseTextColor,
                    borderRadius: 0
                  }
                }}
              />
              <Select
                data={toSelectOptions(facets.muscles)}
                placeholder="Muscle"
                value={muscle}
                onChange={(value) => {
                  setMuscle(value || '')
                  setPage(1)
                }}
                clearable
                size="sm"
                radius={0}
                checkIconPosition="right"
                variant="filled"
                styles={{
                  input: {
                    background: 'rgba(99,102,241,0.12)',
                    borderColor: 'transparent',
                    color: baseTextColor,
                    borderRadius: 0
                  }
                }}
              />
            </SimpleGrid>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
