import { useEffect, useRef, useState } from 'react'
import { Bell, ChevronDown, LogOut, Menu, Search, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/auth-context'
import { roleLabels } from '@/config/navigation'
import { TopbarStudentSearch } from './TopbarStudentSearch'

interface TopbarProps {
  onMenuClick: () => void
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Tashqariga bosilganda yoki Escape bosilganda profil menyusini yopamiz
  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  if (!user) return null

  const handleLogout = () => {
    setMenuOpen(false)
    logout()
    navigate('/login', { replace: true })
  }

  const openAccount = () => {
    setMenuOpen(false)
    navigate('/admin/account')
  }

  const initials = user.fullName
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-[oklch(0.99_0.004_80_/_0.85)] px-4 backdrop-blur-md sm:gap-4 sm:px-6">
      <div className="flex shrink-0 items-center gap-3">
        <button
          onClick={onMenuClick}
          className="flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 lg:hidden"
          title="Menyu"
        >
          <Menu className="h-[18px] w-[18px]" />
        </button>
        <div className="hidden leading-tight lg:block">
          <p className="text-xs text-slate-400">Xush kelibsiz 👋</p>
          <p className="text-sm font-bold tracking-tight text-slate-800">{user.fullName}</p>
        </div>
      </div>

      {/* Global o'quvchi qidiruvi — barcha sahifalarda, desktopda inline (keng) */}
      <div className="hidden flex-1 justify-center sm:flex">
        <TopbarStudentSearch />
      </div>

      <div className="flex shrink-0 items-center gap-2.5">
        {/* Mobil ekranda buyruq paneli (Ctrl+K) ikonasi */}
        <button
          onClick={() => window.dispatchEvent(new Event('cmdk:open'))}
          className="flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 sm:hidden"
          title="Qidirish"
        >
          <Search className="h-[18px] w-[18px]" />
        </button>

        <button className="relative flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50">
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute right-1.5 top-1.5 h-[7px] w-[7px] rounded-full border-2 border-white bg-red-500" />
        </button>

        {/* Profil — bosilganda akkaunt sozlamalari/chiqish menyusi ochiladi */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2.5 rounded-lg p-1 transition-colors hover:bg-slate-50"
            title="Profil"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
              {initials}
            </div>
            <div className="hidden text-left leading-tight sm:block">
              <p className="text-sm font-medium text-slate-700">{user.fullName}</p>
              <p className="text-xs text-slate-400">{roleLabels[user.role]}</p>
            </div>
            <ChevronDown
              className={`hidden h-4 w-4 text-slate-400 transition-transform sm:block ${
                menuOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
            >
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="truncate text-sm font-medium text-slate-700">{user.fullName}</p>
                {user.email && <p className="truncate text-xs text-slate-400">{user.email}</p>}
                <p className="mt-0.5 text-xs text-slate-400">{roleLabels[user.role]}</p>
              </div>
              <button
                role="menuitem"
                onClick={openAccount}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-50"
              >
                <Settings className="h-4 w-4 text-slate-400" />
                Akkaunt sozlamalari
              </button>
              <button
                role="menuitem"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 border-t border-slate-100 px-4 py-2.5 text-sm text-red-600 transition-colors hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" />
                Chiqish
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
