import { useCallback, useEffect, useRef } from 'react'
import { useWorkoutStore } from '@/store/useWorkoutStore'

export function useAutoSave<T>(value: T, onSave: (value: T) => Promise<void>, delay = 60000) {
  const setSaving = useWorkoutStore((state) => state.setSaving)
  const registerAutoSave = useWorkoutStore((state) => state.registerAutoSave)
  const timer = useRef<number | null>(null)
  const latestValue = useRef(value)
  latestValue.current = value

  const triggerSave = useCallback(
    async (mode: 'auto' | 'manual', manageStatus: boolean) => {
      if (manageStatus) {
        setSaving('saving', mode)
      }
      try {
        await onSave(latestValue.current)
        if (manageStatus) {
          setSaving('saved', mode)
        }
      } catch (err) {
        if (manageStatus) {
          setSaving('error', mode)
        } else {
          throw err
        }
      }
    },
    [onSave, setSaving]
  )

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      timer.current = null
      triggerSave('auto', true).catch(() => {
        // errors handled inside triggerSave via setSaving
      })
    }, delay)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [value, delay, triggerSave])

  useEffect(() => {
    const flush = async () => {
      if (timer.current) {
        window.clearTimeout(timer.current)
        timer.current = null
      }
      await triggerSave('manual', false)
    }
    const unregister = registerAutoSave(flush)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
      unregister()
    }
  }, [registerAutoSave, triggerSave])
}
