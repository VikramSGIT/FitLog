import React, { useEffect, useMemo, useState } from 'react'
import { api } from '@/api'
import { Exercise } from '@/db/schema'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import { Stack } from '@mantine/core'
import SetRow from './SetRow'

export default function SetList({ exercise }: { exercise: Exercise }) {
  const allSets = useWorkoutStore((s) => s.sets)
  const sets = useMemo(() => {
    return allSets.filter(s => s.exerciseId === exercise.tempId).sort((a,b) => a.position - b.position)
  }, [allSets, exercise.tempId])

  const [catalogScaling, setCatalogScaling] = useState<{ multiplier: number; baseWeightKg: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    if (exercise.catalogId) {
      api
        .getCatalogEntry(exercise.catalogId)
        .then((record) => {
          if (cancelled) return
          const multiplier = record.multiplier ?? 1
          const baseWeightKg = record.baseWeightKg ?? 0
          setCatalogScaling({ multiplier, baseWeightKg })
        })
        .catch(() => {
          if (!cancelled) {
            setCatalogScaling(null)
          }
        })
    } else {
      setCatalogScaling(null)
    }
    return () => {
      cancelled = true
    }
  }, [exercise.catalogId])

  const effectiveMultiplier = catalogScaling?.multiplier
  const effectiveBaseWeight = catalogScaling?.baseWeightKg

  return (
    <Stack gap="xs" mt="xs">
      {sets.map((set) => (
        <SetRow
          key={set.tempId}
          set={set}
          multiplier={effectiveMultiplier}
          baseWeightKg={effectiveBaseWeight}
        />
      ))}
    </Stack>
  )
}
