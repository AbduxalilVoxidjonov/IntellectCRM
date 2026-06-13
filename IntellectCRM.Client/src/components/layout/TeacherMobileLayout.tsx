import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard,
  NotebookText,
  ClipboardCheck,
  MessageSquare,
  User,
} from 'lucide-react'
import { UnreadProvider, useUnread } from '@/context/unread-context'
import { useAuth } from '@/context/auth-context'
import { getSchoolName } from '@/api/services/settings'
import { cn } from '@/lib/utils'

interface Tab {
  to: string
  label: string
  icon: typeof LayoutDashboard
  end?: boolean
  /** Xabarlar tabida o'qilmagan nuqtasi ko'rsatiladimi */
  badge?: boolean
}

const TABS: Tab[] = [
  { to: '/teacher', label: 'Bosh sahifa', icon: LayoutDashboard, end: true },
  { to: '/teacher/journal', label: 'Jurnal', icon: NotebookText },
  { to: '/teacher/assignments', label: 'Topshiriqlar', icon: ClipboardCheck },
  { to: '/teacher/messages', label: 'Xabarlar', icon: MessageSquare, badge: true },
  { to: '/teacher/profile', label: 'Profil', icon: User },
]

/**
 * O'qituvchi portali uchun MOBIL ilova qobig'i (telefon, Flutter WebView orqali ochiladi).
 * Admin Sidebar/Topbar O'RNIGA: yengil yuqori panel + pastki tab navigatsiya (5 tab).
 * Namuna: src/pages/teacher/ui-web (binafsha brend, app-kartalar, pastki tab bar).
 */
export function TeacherMobileLayout() {
  return (
    <UnreadProvider>
      <Shell />
    </UnreadProvider>
  )
}

function Shell() {
  const { user } = useAuth()
  const { unreadChannels } = useUnread()
  const hasUnread = unreadChannels.size > 0
  const [schoolName, setSchoolName] = useState('')

  useEffect(() => {
    const load = () => {
      getSchoolName()
        .then(setSchoolName)
        .catch(() => {})
    }
    load()
    window.addEventListener('school:updated', load)
    return () => window.removeEventListener('school:updated', load)
  }, [])

  return (
    <div className="flex h-[100dvh] justify-center bg-slate-100">
      {/* Telefon kengligida markazlashtirilgan ustun — keng ekranda ham mobil ko'rinish */}
      <div className="flex h-full w-full max-w-md flex-col overflow-hidden bg-slate-50 shadow-xl">
        {/* Yuqori panel — yengil, brend belgisi + markaz/o'qituvchi nomi */}
        <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-extrabold text-white shadow-sm">
            {(schoolName || 'IC').slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-bold tracking-tight text-slate-800">
              {schoolName || 'IntellectCRM'}
            </p>
            <p className="truncate text-xs text-slate-400">
              {user?.fullName || "O'qituvchi paneli"}
            </p>
          </div>
        </header>

        {/* Kontent — skroll qiladi, pastki nav ostida yashirinmasligi uchun pastki bo'shliq */}
        <main className="flex-1 overflow-y-auto px-4 pb-24 pt-4">
          <Outlet />
        </main>

        {/* PASTKI NAVIGATSIYA — 5 tab (mobil ilova kabi) */}
        <nav className="shrink-0 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
          <div className="flex h-14">
            {TABS.map((tab) => {
              const Icon = tab.icon
              return (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  end={tab.end}
                  className="relative flex flex-1 flex-col items-center justify-center gap-0.5"
                >
                  {({ isActive }) => (
                    <>
                      <span className="relative">
                        <Icon
                          className={cn(
                            'h-6 w-6 transition-colors',
                            isActive ? 'text-brand-600' : 'text-slate-400',
                          )}
                          strokeWidth={isActive ? 2.4 : 2}
                        />
                        {tab.badge && hasUnread && (
                          <span className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
                        )}
                      </span>
                      <span
                        className={cn(
                          'text-[10px] tracking-tight',
                          isActive ? 'font-bold text-brand-600' : 'font-medium text-slate-400',
                        )}
                      >
                        {tab.label}
                      </span>
                    </>
                  )}
                </NavLink>
              )
            })}
          </div>
        </nav>
      </div>
    </div>
  )
}
