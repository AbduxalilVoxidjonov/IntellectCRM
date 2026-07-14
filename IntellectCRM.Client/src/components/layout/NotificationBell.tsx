import { useEffect, useRef, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import {
  getNotifications,
  markNotificationsRead,
  type NotificationsResponse,
} from '@/api/services/notifications'
import { formatDateTime } from '@/lib/utils'

/**
 * Topbar bildirishnoma qo'ng'irog'i — bosilganda joriy foydalanuvchining bildirishnomalari (DB'dan)
 * ochiladi; o'qilmaganlar bo'lsa qizil nuqta ko'rinadi; bo'sh bo'lsa "Hozirda bildirishnoma mavjud emas".
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<NotificationsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const load = () => {
    setLoading(true)
    getNotifications()
      .then(setData)
      .catch(() => setData({ unread: 0, items: [] }))
      .finally(() => setLoading(false))
  }

  // Boshlanishida + har 60 soniyada o'qilmaganlar sonini yangilaymiz (qizil nuqta uchun).
  useEffect(() => {
    load()
    const t = setInterval(load, 60000)
    return () => clearInterval(t)
  }, [])

  // Tashqariga bosilganda / Escape'da yopamiz.
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next) {
      load()
      // Ochilganda o'qilgan deb belgilaymiz (qizil nuqta yo'qoladi).
      if ((data?.unread ?? 0) > 0) {
        markNotificationsRead()
          .then(() => setData((d) => (d ? { ...d, unread: 0 } : d)))
          .catch(() => {})
      }
    }
  }

  const unread = data?.unread ?? 0
  const items = data?.items ?? []

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        title="Bildirishnomalar"
        aria-haspopup="menu"
        aria-expanded={open}
        className="relative flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 h-[7px] w-[7px] rounded-full border-2 border-white bg-red-500" />
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-700">Bildirishnomalar</p>
            {unread > 0 && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">
                {unread} yangi
              </span>
            )}
          </div>

          <div className="max-h-[360px] overflow-y-auto">
            {loading && !data ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">Yuklanmoqda...</div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <BellOff className="h-7 w-7 text-slate-300" />
                <p className="text-sm text-slate-400">Hozirda bildirishnoma mavjud emas</p>
              </div>
            ) : (
              items.map((n) => (
                <div
                  key={n.id}
                  className={
                    'border-b border-slate-50 px-4 py-3 last:border-0 ' +
                    (n.read ? '' : 'bg-brand-50/40')
                  }
                >
                  <div className="flex items-start gap-2">
                    {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">{n.title || 'Bildirishnoma'}</p>
                      {n.body && <p className="mt-0.5 text-xs leading-snug text-slate-500">{n.body}</p>}
                      <p className="mt-1 text-[11px] text-slate-400">{formatDateTime(n.createdAt)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
