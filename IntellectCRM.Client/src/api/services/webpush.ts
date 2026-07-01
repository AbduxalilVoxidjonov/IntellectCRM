import { getPublicPushConfig } from './settings'

/* ============================================================
   Web / PWA push (Firebase Cloud Messaging, brauzer).
   Native (Flutter WebView) ilova FCM tokenni o'zi beradi (push.ts) —
   bu modul esa ODDIY BRAUZER / PWA uchun tokenni Firebase JS SDK orqali oladi:
     1) /api/public/push-config'dan web app config + VAPID kalitini oladi,
     2) firebase-messaging-sw.js service worker'ni ro'yxatdan o'tkazadi,
     3) bildirishnoma ruxsatini so'raydi,
     4) getToken(...) bilan FCM qurilma tokenini oladi.
   Token keyin push.ts'dagi registerDevice(role, token, 'web') orqali serverga bog'lanadi.
   Firebase SDK gstatic CDN'dan DINAMIK yuklanadi (npm bog'liqlik / bundle shishishi yo'q).
   ============================================================ */

const FIREBASE_SDK_VERSION = '10.14.1'

/** Brauzer web push'ni qo'llab-quvvatlaydimi (service worker + Notification + Push API). */
export function isWebPushSupported(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'Notification' in window &&
      'PushManager' in window &&
      // localhost yoki HTTPS'da ishlaydi (service worker talabi).
      (window.isSecureContext === true || location.hostname === 'localhost')
    )
  } catch {
    return false
  }
}

/** gstatic CDN'dan Firebase modular ESM modulini yuklaydi (TS uchun `any`). */
async function loadFirebaseModule(name: 'firebase-app' | 'firebase-messaging'): Promise<Record<string, unknown>> {
  // Spetsifikatorni o'zgaruvchida saqlaymiz — shunda TS uni modul sifatida hal qilmaydi (any bo'ladi),
  // Vite esa tashqi URL importini o'zgartirmaydi (@vite-ignore).
  const url = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/${name}.js`
  return import(/* @vite-ignore */ url)
}

let cachedToken: string | null = null

/**
 * Web/PWA push'ni ishga tushiradi va FCM qurilma tokenini qaytaradi (yoki null — qo'llab-quvvatlanmasa,
 * sozlanmagan, ruxsat berilmagan yoki xato bo'lsa). Idempotent: bir marta token olinsa keshdan qaytadi.
 */
export async function initWebPush(): Promise<string | null> {
  if (cachedToken) return cachedToken
  if (!isWebPushSupported()) return null

  let cfg: { webConfigJson: string; vapidKey: string; configured: boolean }
  try {
    cfg = await getPublicPushConfig()
  } catch {
    return null
  }
  if (!cfg.configured || !cfg.vapidKey || !cfg.webConfigJson) return null

  let webConfig: Record<string, unknown>
  try {
    webConfig = JSON.parse(cfg.webConfigJson)
  } catch {
    return null // web config JSON noto'g'ri — admin qayta kiritishi kerak.
  }

  try {
    // 1) Bildirishnoma ruxsati (foydalanuvchi rad etsa — token yo'q).
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return null

    // 2) Service worker'ni web config bilan ro'yxatdan o'tkazamiz (config query'da — SW static fayl).
    const swUrl = `/firebase-messaging-sw.js?config=${encodeURIComponent(cfg.webConfigJson)}`
    const registration = await navigator.serviceWorker.register(swUrl, { scope: '/' })

    // 3) Firebase SDK'ni yuklab, messaging token olamiz.
    const appMod = await loadFirebaseModule('firebase-app')
    const msgMod = await loadFirebaseModule('firebase-messaging')
    const initializeApp = appMod.initializeApp as (c: unknown) => unknown
    const getMessaging = msgMod.getMessaging as (app: unknown) => unknown
    const getToken = msgMod.getToken as (
      m: unknown,
      opts: { vapidKey: string; serviceWorkerRegistration: ServiceWorkerRegistration },
    ) => Promise<string>

    const app = initializeApp(webConfig)
    const messaging = getMessaging(app)
    const token = await getToken(messaging, {
      vapidKey: cfg.vapidKey,
      serviceWorkerRegistration: registration,
    })
    if (!token) return null
    cachedToken = token
    return token
  } catch {
    // Ruxsat rad etilishi, VAPID mos kelmasligi, tarmoq va h.k. — jimgina o'tkazamiz (native ta'sirlanmaydi).
    return null
  }
}
