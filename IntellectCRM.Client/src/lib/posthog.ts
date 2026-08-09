import posthog from 'posthog-js'

const projectToken = import.meta.env.VITE_POSTHOG_KEY
const host = import.meta.env.VITE_POSTHOG_HOST

if (projectToken && host) {
  posthog.init(projectToken, {
    api_host: host,
    defaults: '2026-05-30',

    // ── Avtomatik kuzatuv ──────────────────────────────────────────
    // Barcha kliklar, forma o'zgarishlari va sahifa almashinuvi
    // hech qanday qo'shimcha kod yozmasdan yoziladi.
    autocapture: true,

    // ── Sahifa ko'rishlar ──────────────────────────────────────────
    // Qaysi sahifa qancha marta ochilgan — avtomatik.
    capture_pageview: true,

    // ── Sessiya yozuvi ─────────────────────────────────────────────
    // Har bir foydalanuvchi sessiyasini PostHog dashboardida
    // "video" kabi ko'rish mumkin: qayerga bosdi, nima qildi.
    session_recording: {
      maskAllInputs: false,       // parol maydonlari avtomatik berkitiladi
      maskInputOptions: {
        password: true,           // parollar HECH QACHON yozilmaydi
        email: false,
      },
    },

    // ── Xato kuzatuvi ─────────────────────────────────────────────
    // So'ralmagan JS xatolari va Promise rejection'lari avtomatik.
    capture_exceptions: {
      capture_unhandled_errors: true,
      capture_unhandled_rejections: true,
      capture_console_errors: false,
    },
  })
} else if (import.meta.env.DEV) {
  const missingVariable = projectToken ? 'VITE_POSTHOG_HOST' : 'VITE_POSTHOG_KEY'

  throw new Error(
    `${missingVariable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missingVariable} is configured`,
  )
}

export default posthog
