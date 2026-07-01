/* Firebase Cloud Messaging — web/PWA push service worker.
 * Web app config query string orqali keladi (webpush.ts uni ro'yxatdan o'tkazganda qo'yadi):
 *   /firebase-messaging-sw.js?config=<encodeURIComponent(JSON)>
 * Konfig OMMAVIY (apiKey/messagingSenderId ochiq kalitlar) — maxfiy emas.
 * `notification` payload'li xabarlar brauzer tomonidan avtomatik ko'rsatiladi; bu yerda faqat
 * data-only xabarlar uchun zaxira handler va bosilganda ilovani ochish qo'shilgan.
 */
/* global importScripts, firebase, self, clients */

const SDK_VERSION = '10.14.1'
importScripts(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app-compat.js`)
importScripts(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-messaging-compat.js`)

try {
  const params = new URLSearchParams(self.location.search)
  const raw = params.get('config')
  const config = raw ? JSON.parse(decodeURIComponent(raw)) : null

  if (config && config.apiKey) {
    firebase.initializeApp(config)
    const messaging = firebase.messaging()

    // Data-only xabarlar uchun zaxira (notification payload'li xabarlar o'zi ko'rinadi).
    messaging.onBackgroundMessage((payload) => {
      const n = payload.notification || {}
      const data = payload.data || {}
      const title = n.title || data.title || 'Yangi bildirishnoma'
      self.registration.showNotification(title, {
        body: n.body || data.body || '',
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        data,
      })
    })
  }
} catch (e) {
  // Konfig noto'g'ri yoki SDK yuklanmadi — SW baribir o'rnatiladi, shunchaki push kelmaydi.
}

// Bildirishnoma bosilganda — ochiq ilova oynasini fokuslash yoki yangisini ochish.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow('/')
    }),
  )
})
