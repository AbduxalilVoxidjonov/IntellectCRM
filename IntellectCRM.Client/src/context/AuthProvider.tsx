import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { User } from '@/types'
import { AuthContext } from './auth-context'
import { login as loginRequest, fetchMe } from '@/api/services/auth'
import { USE_MOCK } from '@/api/client'
import { setFcmToken, getFcmToken, registerDevice, unregisterDevice } from '@/api/services/push'

const TOKEN_KEY = 'token'
const USER_KEY = 'user'

function readStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Sahifa yangilanganda sessiyani localStorage'dan tiklaymiz (token bo'lsa).
  const [user, setUser] = useState<User | null>(() =>
    localStorage.getItem(TOKEN_KEY) ? readStoredUser() : null,
  )

  const logout = useCallback(() => {
    // Push: qurilma tokenini o'chirib qo'yamiz (JWT hali tozalanmagan — explicit header bilan).
    const jwt = localStorage.getItem(TOKEN_KEY)
    const role = readStoredUser()?.role
    const fcm = getFcmToken()
    if (jwt && role && fcm) unregisterDevice(role, fcm, jwt).catch(() => {})

    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setUser(null)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { token, user: u } = await loginRequest(email, password)
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(u))
    setUser(u)
    // Push: Flutter token mavjud bo'lsa — qurilmani shu foydalanuvchiga bog'laymiz.
    const fcm = getFcmToken()
    if (fcm) registerDevice(u.role, fcm).catch(() => {})
    return u
  }, [])

  const updateUser = useCallback((u: User) => {
    localStorage.setItem(USER_KEY, JSON.stringify(u))
    setUser(u)
  }, [])

  // Real rejimda tokenni /me orqali tekshiramiz: amal qilmasa — chiqaramiz.
  useEffect(() => {
    if (USE_MOCK || !localStorage.getItem(TOKEN_KEY)) return
    fetchMe()
      .then((u) => {
        localStorage.setItem(USER_KEY, JSON.stringify(u))
        setUser(u)
      })
      .catch(() => logout())
  }, [logout])

  // Flutter native FCM tokenini eshitamiz: window.postMessage({type:'fcm-token', token})
  // yoki window.__FCM_TOKEN__. Token kelganda — agar kirilgan bo'lsa darhol register qilamiz
  // (token yangilanganda ham qayta bog'lanadi).
  useEffect(() => {
    const tryRegister = (token: string) => {
      setFcmToken(token)
      const u = readStoredUser()
      if (u && localStorage.getItem(TOKEN_KEY)) registerDevice(u.role, token).catch(() => {})
    }
    // Flutter ilova ochilishida window.__FCM_TOKEN__ ni oldindan qo'ygan bo'lishi mumkin.
    const initial = getFcmToken()
    if (initial) tryRegister(initial)

    const onMsg = (e: MessageEvent) => {
      const d = e.data as { type?: string; token?: string } | null
      if (d && d.type === 'fcm-token' && typeof d.token === 'string' && d.token) tryRegister(d.token)
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  const value = useMemo(
    () => ({ user, isAuthenticated: !!user, login, logout, updateUser }),
    [user, login, logout, updateUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
