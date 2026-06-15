import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Home, BookOpen, ClipboardList, MessageCircle, User } from 'lucide-react'
import { UnreadProvider, useUnread } from '@/context/unread-context'
import { useAuth } from '@/context/auth-context'
import { cn } from '@/lib/utils'

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

/** Joriy o'qituvchi temasi ('light' | 'dark') — localStorage'dan. */
export function getTeacherTheme(): 'light' | 'dark' {
  return localStorage.getItem('teacher_theme') === 'dark' ? 'dark' : 'light'
}
/** Temani saqlash + boshqa komponentlarni xabardor qilish (custom event). */
export function setTeacherTheme(t: 'light' | 'dark') {
  localStorage.setItem('teacher_theme', t)
  window.dispatchEvent(new Event('teacher-theme'))
}

interface Tab {
  to: string
  label: string
  icon: typeof Home
  end?: boolean
  /** Xabarlar tabida o'qilmagan nuqtasi ko'rsatiladimi */
  badge?: boolean
}

const TABS: Tab[] = [
  { to: '/teacher', label: 'Bosh', icon: Home, end: true },
  { to: '/teacher/journal', label: 'Jurnal', icon: BookOpen },
  { to: '/teacher/assignments', label: 'Vazifa', icon: ClipboardList },
  { to: '/teacher/messages', label: 'Suhbat', icon: MessageCircle, badge: true },
  { to: '/teacher/profile', label: 'Profil', icon: User },
]

/**
 * O'qituvchi portali — MOBIL ilova qobig'i (telefon, Flutter WebView orqali).
 * Dizayn: teacher.html (teal UI-kit). Har bir ekran o'z sarlavhasini beradi;
 * qobiq faqat skroll qiladigan kontent + pastki 5-tab teal navigatsiyani beradi.
 */
export function TeacherMobileLayout() {
  return (
    <UnreadProvider>
      <Shell />
    </UnreadProvider>
  )
}

function Shell() {
  const { unreadChannels } = useUnread()
  const hasUnread = unreadChannels.size > 0
  const { user } = useAuth()
  const [theme, setTheme] = useState<'light' | 'dark'>(getTeacherTheme)
  useEffect(() => {
    const onChange = () => setTheme(getTeacherTheme())
    window.addEventListener('teacher-theme', onChange)
    return () => window.removeEventListener('teacher-theme', onChange)
  }, [])

  return (
    <div className={cn('teacher-app flex h-[100dvh] bg-neutral-200 text-ink lg:bg-paper2', theme === 'dark' && 'dark')}>
      {/* ── DESKTOP yon menyu (faqat lg+; telefon/WebView'da YO'Q) ── */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-white lg:flex">
        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 text-[15px] font-bold text-white">
            {initials(user?.fullName || 'O')}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-bold text-ink">{user?.fullName || "O'qituvchi"}</p>
            <p className="text-[12px] text-mute">O'qituvchi</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {TABS.map((tab) => {
            const Icon = tab.icon
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  cn(
                    'relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-semibold transition-colors',
                    isActive ? 'bg-tealsoft text-teal-700' : 'text-mute hover:bg-paper2',
                  )
                }
              >
                <span className="relative">
                  <Icon className="h-5 w-5" />
                  {tab.badge && hasUnread && (
                    <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
                  )}
                </span>
                {tab.label}
              </NavLink>
            )
          })}
        </nav>
      </aside>

      {/* ── Kontent maydoni: telefonda markazlashgan tor ustun, desktopda kengroq ── */}
      <div className="flex h-full flex-1 justify-center overflow-hidden">
        <div className="flex h-full w-full max-w-md flex-col overflow-hidden bg-paper shadow-2xl lg:max-w-4xl lg:shadow-none">
          {/* Kontent — har bir ekran o'z sarlavha/paddingini beradi */}
          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>

          {/* PASTKI NAVIGATSIYA — 5 tab (faqat telefon/WebView; desktopda yon menyu) */}
          <nav className="shrink-0 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
            <div className="flex h-[60px]">
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
                        <span
                          className={cn(
                            'flex h-7 w-14 items-center justify-center rounded-xl transition-colors',
                            isActive ? 'bg-tealsoft' : 'bg-transparent',
                          )}
                        >
                          <span className="relative">
                            <Icon
                              className={cn('h-[22px] w-[22px]', isActive ? 'text-teal-600' : 'text-faint')}
                              strokeWidth={isActive ? 2.4 : 2}
                            />
                            {tab.badge && hasUnread && (
                              <span className="absolute -right-1.5 -top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
                            )}
                          </span>
                        </span>
                        <span
                          className={cn(
                            'text-[10.5px] tracking-tight',
                            isActive ? 'font-bold text-teal-600' : 'font-medium text-faint',
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
    </div>
  )
}
