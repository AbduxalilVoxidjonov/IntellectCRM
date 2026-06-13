import { NavLink, Outlet } from 'react-router-dom'
import { Home, BookOpen, ClipboardList, MessageCircle, User } from 'lucide-react'
import { UnreadProvider, useUnread } from '@/context/unread-context'
import { cn } from '@/lib/utils'

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

  return (
    <div className="teacher-app flex h-[100dvh] justify-center bg-neutral-200 text-ink">
      {/* Telefon kengligida markazlashtirilgan ustun (keng ekranda ham mobil ko'rinish) */}
      <div className="flex h-full w-full max-w-md flex-col overflow-hidden bg-paper shadow-2xl">
        {/* Kontent — har bir ekran o'z sarlavha/paddingini beradi */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>

        {/* PASTKI NAVIGATSIYA — 5 tab (teal soft-pill) */}
        <nav className="shrink-0 border-t border-line bg-white pb-[env(safe-area-inset-bottom)]">
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
  )
}
