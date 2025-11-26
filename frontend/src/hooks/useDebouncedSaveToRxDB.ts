import { useCallback, useEffect, useRef } from 'react'
import { useWorkoutStore } from '@/store/useWorkoutStore'

// onSave should return true if it actually persisted changes, false if there was nothing to save
export function useDebouncedSaveToRxDB<T>(value: T, onSave: (value: T) => Promise<boolean>, delay = 2000, manageStatus = true) {
  const setSaving = useWorkoutStore((state) => state.setSaving)
  const registerAutoSave = useWorkoutStore((state) => state.registerAutoSave)
  const timer = useRef<number | null>(null)
  const latestValue = useRef(value)
  const onSaveRef = useRef(onSave)
  const saving = useRef(false)
  latestValue.current = value
  onSaveRef.current = onSave

  const triggerSave = useCallback(
    async (mode: 'auto' | 'manual', status: boolean) => {
      if (saving.current) return
      saving.current = true

      if (status) {
        setSaving('saving', mode)
      }
      try {
        const didSave = await onSaveRef.current(latestValue.current)
        if (status) {
          if (didSave) {
          setSaving('saved', mode)
          } else {
            // nothing changed; return to idle without success toast
            setSaving('idle', mode)
          }
        }
      } catch (err) {
        if (status) {
          setSaving('error', mode)
        } else {
          throw err
        }
      } finally {
        saving.current = false
      }
    },
    [setSaving]
  )

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      timer.current = null
      triggerSave('auto', manageStatus).catch(() => {
        // errors handled inside triggerSave via setSaving
      })
    }, delay)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [value, delay, manageStatus, triggerSave])

  useEffect(() => {
    const flush = async () => {
      if (timer.current) {
        window.clearTimeout(timer.current)
        timer.current = null
      }
      if (saving.current) return false
      saving.current = true
      try {
        const didSave = await onSaveRef.current(latestValue.current)
        return didSave
      } catch (err) {
        return false
      } finally {
        saving.current = false
      }
    }
    const unregister = registerAutoSave(flush)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
      unregister()
    }
  }, [registerAutoSave, triggerSave])
}
