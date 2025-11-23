import { useState, useEffect, useCallback } from 'react'
import { notifications } from '@mantine/notifications'
import { IconLogin } from '@tabler/icons-react'
import { api } from '@/api/client'
import { useWorkoutStore } from '@/store/useWorkoutStore'

export function useAuth() {
  const [authed, setAuthed] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const { init, cleanup } = useWorkoutStore()

  useEffect(() => {
    api
      .me()
      .then((res) => {
        setAuthed(true)
        setUserId(res.userId)
        init(res.userId)
      })
      .catch(() => {
        setAuthed(false)
      })
      .finally(() => setCheckingSession(false))

    return () => {
      cleanup()
    }
  }, [init, cleanup])

  const login = useCallback(
    async (email, password) => {
      try {
        const res = await api.login(email, password)
        setAuthed(true)
        setUserId(res.userId)
        init(res.userId)
        notifications.show({
          title: 'Welcome back to Lift Logger',
          message: 'Your dashboard is ready to go.',
          color: 'teal',
          icon: <IconLogin size={18} />,
        })
      } catch {
        notifications.show({
          title: 'Login failed',
          message: 'Double-check your email and password and try again.',
          color: 'red',
        })
        throw new Error('Login failed')
      }
    },
    [init]
  )

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } catch {
      // ignore
    }
    setAuthed(false)
    setUserId(null)
    cleanup()
  }, [cleanup])

  return {
    authed,
    checkingSession,
    userId,
    login,
    logout,
  }
}
