import { useCallback, useEffect, useRef } from 'react'
import { useWorkoutStore } from '@/store/useWorkoutStore'

// onSave should return true if it actually persisted changes, false if there was nothing to save
export function useAutoSave<T>(value: T, onSave: (value: T) => Promise<boolean>, delay = 60000) {
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
        const didSave = await onSave(latestValue.current)
        if (manageStatus) {
          if (didSave) {
          setSaving('saved', mode)
          } else {
            // nothing changed; return to idle without success toast
            setSaving('idle', mode)
          }
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
      const didSave = await onSave(latestValue.current)
      return didSave
    }
    const unregister = registerAutoSave(flush)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
      unregister()
    }
  }, [registerAutoSave, triggerSave])
}
