import { useState, useEffect, useCallback } from 'react'
import { notifications } from '@mantine/notifications'
import { IconLogin } from '@tabler/icons-react'
import { me, login, logout } from '@/api'
import { useWorkoutStore } from '@/store/useWorkoutStore'

export function useAuth() {
  const [authed, setAuthed] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const { init, cleanup } = useWorkoutStore()

  useEffect(() => {
    me()
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

  const loginFn = useCallback(
    async (email, password) => {
      try {
        const res = await login(email, password)
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

  const logoutFn = useCallback(async () => {
    try {
      await logout()
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
    login: loginFn,
    logout: logoutFn,
  }
}
