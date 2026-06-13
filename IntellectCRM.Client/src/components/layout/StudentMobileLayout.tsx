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
  { to: '/student', label: 'Boshqaruv', icon: 'home', end: true },
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
    <div className="student-app" data-theme={theme} style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <div
        style={{
          maxWidth: 480,
          margin: '0 auto',
          minHeight: '100dvh',
          background: 'var(--bg)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div className="scroll">
          <Outlet />
        </div>

        <nav className="tabbar">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) => 'tab' + (isActive ? ' on' : '')}
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
        </nav>
      </div>
    </div>
  )
}
