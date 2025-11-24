import { request } from './'

export const register = (email: string, password: string) =>
  request<{ userId: string; email: string }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  })

export const login = (email: string, password: string) =>
  request<{ userId: string; email: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  })

export const logout = () => request<void>('/api/auth/logout', { method: 'POST' })

export const me = () => request<{ userId: string; email: string }>('/api/auth/me')
