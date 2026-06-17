import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Icon } from '@/pages/student/lib'

interface Tab {
  to: string
  label: string
  icon: string
  end?: boolean
}

const TABS: Tab[] = [
  { to: '/student', label: 'Dashboard', icon: 'home', end: true },
  { to: '/student/progress', label: 'Progress', icon: 'chart' },
  { to: '/student/assignments', label: 'Topshiriq', icon: 'clipboard' },
  { to: '/student/chat', label: 'Chat', icon: 'chat' },
  { to: '/student/profile', label: 'Profil', icon: 'user' },
]

/** Joriy tema ('light' | 'dark') — localStorage'dan. */
export function getStudentTheme(): 'light' | 'dark' {
  return localStorage.getItem('student_theme') === 'dark' ? 'dark' : 'light'
}
export function setStudentTheme(t: 'light' | 'dark') {
  localStorage.setItem('student_theme', t)
  window.dispatchEvent(new Event('student:theme'))
}

/**
 * O'quvchi portali — MOBIL ilova qobig'i (telefon/web). Dizayn: student.html (blue UI-kit).
 * 480px markazlashtirilgan ustun, pastki 5-tab navigatsiya, light/dark tema.
 */
export function StudentMobileLayout() {
  const [theme, setTheme] = useState<'light' | 'dark'>(getStudentTheme)

  useEffect(() => {
    const onChange = () => setTheme(getStudentTheme())
    window.addEventListener('student:theme', onChange)
    return () => window.removeEventListener('student:theme', onChange)
  }, [])

  return (
    <div
      className="student-app flex h-[100dvh] flex-col overflow-hidden"
      data-theme={theme}
    >
      <div className="scroll flex-1 overflow-y-auto">
        <Outlet />
      </div>

      <nav className="tabbar shrink-0 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
        <div className="flex">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) => 'tab flex-1' + (isActive ? ' on' : '')}
              style={{ textDecoration: 'none' }}
            >
              {({ isActive }) => (
                <>
                  <Icon name={tab.icon} size={24} fill={isActive} />
                  <span>{tab.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
