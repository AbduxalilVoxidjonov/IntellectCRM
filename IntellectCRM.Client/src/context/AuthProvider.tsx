import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { User } from '@/types'
import { AuthContext } from './auth-context'
import { login as loginRequest, otpLogin, fetchMe } from '@/api/services/auth'
import { USE_MOCK } from '@/api/client'
import { setFcmToken, getFcmToken, registerDevice, unregisterDevice, pushBase } from '@/api/services/push'
import { initWebPush, isWebPushSupported } from '@/api/services/webpush'

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

  // Login/OTP ikkalasi ham bir xil "token + user" natija shakli qaytaradi — sessiyani o'rnatish umumiy.
  const applySession = useCallback((token: string, u: User) => {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(u))
    setUser(u)
    // Push: Flutter token mavjud bo'lsa — qurilmani shu foydalanuvchiga bog'laymiz.
    const fcm = getFcmToken()
    if (fcm) registerDevice(u.role, fcm).catch(() => {})
    return u
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      const { token, user: u } = await loginRequest(email, password)
      return applySession(token, u)
    },
    [applySession],
  )

  const loginWithCode = useCallback(
    async (code: string) => {
      const { token, user: u } = await otpLogin(code)
      return applySession(token, u)
    },
    [applySession],
  )

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

  // Web/PWA push: NATIVE token bo'lmasa (oddiy brauzer/PWA), student/teacher kirganda Firebase JS
  // SDK orqali FCM token olib, joriy foydalanuvchiga bog'laymiz. Native ilovada window.__FCM_TOKEN__
  // bo'lgani uchun bu blok o'tkazib yuboriladi. initWebPush idempotent (tokenni keshlaydi).
  useEffect(() => {
    if (!user) return
    if (getFcmToken()) return // native token mavjud — web push shart emas
    if (!pushBase(user.role)) return // faqat student/teacher'da register endpointi bor
    if (!isWebPushSupported()) return
    const role = user.role
    initWebPush()
      .then((token) => {
        if (!token) return
        setFcmToken(token)
        registerDevice(role, token, 'web').catch(() => {})
      })
      .catch(() => {})
  }, [user])

  // Flutter native FCM tokenini eshitamiz: window.postMessage({type:'fcm-token', token})
  // yoki window.__FCM_TOKEN__. Token kelganda — agar kirilgan bo'lsa darhol register qilamiz
  // (token yangilanganda ham qayta bog'lanadi).
  useEffect(() => {
    const tryRegister = (token: string) => {
      setFcmToken(token)
      const u = readStoredUser()
      if (u && localStorage.getItem(TOKEN_KEY)) registerDevice(u.role, token).catch(() => {})
    }
    // Flutter to'g'ridan-to'g'ri chaqirishi uchun global funksiya (eng ishonchli yo'l).
    window.registerFcmToken = (token: string) => {
      if (typeof token === 'string' && token) tryRegister(token)
    }
    // Flutter ilova ochilishida window.__FCM_TOKEN__ ni oldindan qo'ygan bo'lishi mumkin.
    const initial = getFcmToken()
    if (initial) tryRegister(initial)

    const onMsg = (e: MessageEvent) => {
      const d = e.data as { type?: string; token?: string } | null
      if (d && d.type === 'fcm-token' && typeof d.token === 'string' && d.token) tryRegister(d.token)
    }
    window.addEventListener('message', onMsg)
    return () => {
      window.removeEventListener('message', onMsg)
      delete window.registerFcmToken
    }
  }, [])

  const value = useMemo(
    () => ({ user, isAuthenticated: !!user, login, loginWithCode, logout, updateUser }),
    [user, login, loginWithCode, logout, updateUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
