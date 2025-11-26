import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { notifications } from '@mantine/notifications'
import { api, CatalogRecord, ExerciseHistoryItem } from '@/api/client'
import { useWorkoutStore } from '@/store/useWorkoutStore'

export function useExerciseData(id: string | undefined) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [exercise, setExercise] = useState<CatalogRecord | null>(null)
  const [highestWeight, setHighestWeight] = useState(0)
  const [history, setHistory] = useState<ExerciseHistoryItem[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const day = useWorkoutStore((s) => s.day)
  const allSets = useWorkoutStore((s) => s.sets)
  
  // Get the current day's date string
  const currentDayDateStr = useMemo(() => {
    if (!day || !day.workoutDate) return null
    return day.workoutDate.includes('T')
      ? day.workoutDate.split('T')[0]
      : day.workoutDate
  }, [day])

  // Merge current day's exercises with history
  const mergedHistory = useMemo(() => {
    // If we don't have a current day or catalog ID, just return history
    if (!day || !id || !currentDayDateStr) return history

    // Find exercises matching this catalog ID in the current day
    const matchingExercises = (day.exercises || []).filter(
      (ex) => ex.catalogId === id
    )

    if (matchingExercises.length === 0) return history

    // Convert current day's sets to history format
    const currentDaySets: Array<{ reps: number; weightKg: number; isWarmup: boolean }> = []
    matchingExercises.forEach((ex) => {
      const exerciseSets = allSets
        .filter((s) => s.exerciseId === ex.id)
        .sort((a, b) => a.position - b.position)

      exerciseSets.forEach((set) => {
        currentDaySets.push({
          reps: set.reps,
          weightKg: set.weightKg,
          isWarmup: set.isWarmup || false
        })
      })
    })

    if (currentDaySets.length === 0) return history

    const currentDayItem: ExerciseHistoryItem = {
      workoutDate: currentDayDateStr,
      sets: currentDaySets
    }

    // Check if current day is already in history - replace or prepend
    const existingIndex = history.findIndex(
      (item) => item.workoutDate === currentDayDateStr
    )

    if (existingIndex >= 0) {
      // Replace existing entry with current day's data
      const newHistory = [...history]
      newHistory[existingIndex] = currentDayItem
      return newHistory
    } else {
      // Prepend current day to history
      return [currentDayItem, ...history]
    }
  }, [day, id, history, currentDayDateStr, allSets])

  const loadMoreHistory = useCallback(async (offset: number) => {
    if (!id || loadingMore) return
    setLoadingMore(true)
    try {
      const statsData = await api.getExerciseStats(id, 5, offset)
      if (statsData) {
        setHistory((prev) => [...prev, ...statsData.history])
        setHasMore(statsData.hasMore || false)
      }
    } catch (error: unknown) {
      console.error(error)
    } finally {
      setLoadingMore(false)
    }
  }, [id, loadingMore])

  useEffect(() => {
    if (!id) {
      navigate('/catalog')
      return
    }

    const loadData = async () => {
      setLoading(true)
      try {
        const [exerciseData, statsData] = await Promise.all([
          api.getCatalogEntry(id),
          api.getExerciseStats(id, 5, 0).catch(() => null)
        ])
        setExercise(exerciseData)
        if (statsData) {
          setHighestWeight(statsData.highestWeightKg)
          setHistory(statsData.history || [])
          setHasMore(statsData.hasMore || false)
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to load exercise details'
        notifications.show({
          title: 'Error',
          message,
          color: 'red'
        })
        navigate('/catalog')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [id, navigate])

  return {
    loading,
    exercise,
    highestWeight,
    mergedHistory,
    hasMore,
    loadingMore,
    loadMoreHistory
  }
}
