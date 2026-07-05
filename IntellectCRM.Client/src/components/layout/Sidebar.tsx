import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ChevronDown, Search } from 'lucide-react'
import type { Role } from '@/types'
import { useAuth } from '@/context/auth-context'
import { useUnread } from '@/context/unread-context'
import { getSchoolName } from '@/api/services/settings'
import { navByRole, roleLabels, homeByRole, type NavItem, type NavChild } from '@/config/navigation'
import { cn } from '@/lib/utils'

interface SidebarProps {
  open: boolean
  onNavigate: () => void
}

function initialsOf(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function Sidebar({ open, onNavigate }: SidebarProps) {
  const { user } = useAuth()
  const { unreadChannels } = useUnread()
  const totalUnread = unreadChannels.size
  const [schoolName, setSchoolName] = useState('')
  const [logoUrl, setLogoUrl] = useState('')

  // Markaz nomi va logosini yuklaymiz; sozlamada saqlangach 'school:updated' hodisasi bilan yangilanadi.
  useEffect(() => {
    const load = () => {
      getSchoolName()
        .then((s) => {
          setSchoolName(s.name)
          setLogoUrl(s.logoUrl)
        })
        .catch(() => {})
    }
    load()
    window.addEventListener('school:updated', load)
    return () => window.removeEventListener('school:updated', load)
  }, [])

  if (!user) return null
  const role = user.role
  // Element ko'rinadi: roli mos (yoki roles yo'q) VA xodim ruxsati bor (yoki perm yo'q / permissions yo'q).
  const canSee = (x: { roles?: Role[]; perm?: string }) =>
    (!x.roles || x.roles.includes(role)) &&
    (!x.perm || !user.permissions || user.permissions.includes(x.perm))

  // Guruh bolalarini (3-darajagacha) rekursiv filtrlaymiz; barcha bolalari yashirilgan guruh ko'rinmaydi.
  function filterNav<T extends { roles?: Role[]; perm?: string; children?: NavChild[] }>(list: T[]): T[] {
    return list
      .filter(canSee)
      .map((i) => (i.children ? { ...i, children: filterNav(i.children) } : i))
      .filter((i) => !i.children || i.children.length > 0)
  }
  const items = filterNav(navByRole[role])

  return (
    <aside
      className={cn(
        // Desktopda (lg) DOIM statik va ko'rinadi — `open` faqat mobil drawer'ni boshqaradi.
        // (Ilgari `open=false` da `lg:hidden` edi → tor oynada ochib kattalashtirilganda sidebar
        //  ham, hamburger ham yo'qolib, navigatsiyasiz qolinardi.)
        'fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:static lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full',
      )}
    >
      {/* Brend */}
      <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="Logo"
            className="h-8 w-8 shrink-0 rounded-lg object-contain"
          />
        ) : (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-600 to-fuchsia-600 text-[13px] font-extrabold tracking-tight text-white shadow-[0_4px_10px_oklch(0.5_0.18_282_/_0.3)]">
            IC
          </div>
        )}
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-bold tracking-tight text-slate-800">
            {schoolName || 'IntellectCRM'}
          </p>
          <p className="text-[11px] font-medium text-slate-400">{roleLabels[role]}</p>
        </div>
      </div>

      {/* Menyu */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {/* Qidiruv (Ctrl+K) — buyruq paneli: bo'limlar + o'quvchi (FISH/telefon) */}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event('cmdk:open'))}
          className="mb-1 flex w-full items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-[13px] text-slate-400 transition-colors hover:border-slate-300 hover:bg-white"
          title="Qidirish (Ctrl+K)"
        >
          <Search className="h-[16px] w-[16px]" />
          <span className="flex-1 text-left">Qidirish...</span>
          <kbd className="rounded border border-slate-200 bg-white px-1.5 font-mono text-[10px] text-slate-400">
            ⌘K
          </kbd>
        </button>
        <div className="px-2.5 pb-1.5 pt-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-400">
          Asosiy
        </div>
        {items.map((item) =>
          item.children ? (
            <NavGroup key={item.to} item={item} onNavigate={onNavigate} />
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === homeByRole[role]}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] transition-colors',
                  isActive
                    ? 'bg-brand-50 font-semibold text-brand-700'
                    : 'font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                )
              }
            >
              <item.icon className="h-[17px] w-[17px]" />
              {item.label}
              {item.to.endsWith('/messages') && totalUnread > 0 && (
                <span className="ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 font-mono text-[10px] font-bold text-white">
                  {totalUnread > 9 ? '9+' : totalUnread}
                </span>
              )}
            </NavLink>
          ),
        )}
      </nav>

      {/* Foydalanuvchi */}
      <div className="border-t border-slate-100 p-3">
        <div className="flex items-center gap-2.5 rounded-lg border border-slate-100 bg-slate-50 p-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-pink-500 text-[12px] font-bold text-white">
            {initialsOf(user.fullName)}
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[12.5px] font-semibold text-slate-700">{user.fullName}</p>
            <p className="truncate text-[11px] text-slate-400">{roleLabels[role]}</p>
          </div>
        </div>
      </div>
    </aside>
  )
}

function NavGroup({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  const location = useLocation()
  // Guruh — o'z manzili ostida YOKI bolalaridan biri faol bo'lsa belgilanadi/ochiladi
  // (bolalar boshqa yo'l ostida bo'lishi mumkin, masalan Fanlar yoki Sozlamalar).
  const isUnder =
    location.pathname.startsWith(item.to) ||
    (item.children?.some(
      (c) => location.pathname === c.to || location.pathname.startsWith(c.to + '/'),
    ) ??
      false)
  const [openGroup, setOpenGroup] = useState(isUnder)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- marshrut shu guruh ostida bo'lsa, uni avtomatik ochamiz (maqsadli)
    if (isUnder) setOpenGroup(true)
  }, [isUnder])

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpenGroup((o) => !o)}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] transition-colors',
          isUnder
            ? 'bg-slate-50 font-semibold text-slate-900'
            : 'font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900',
        )}
      >
        <item.icon className="h-[17px] w-[17px]" />
        {item.label}
        <ChevronDown
          className={cn('ml-auto h-3.5 w-3.5 text-slate-400 transition-transform', openGroup && 'rotate-180')}
        />
      </button>

      {openGroup && (
        <div className="ml-[18px] mt-0.5 space-y-px border-l border-slate-200 pl-3">
          {item.children?.map((child) =>
            child.children ? (
              <NavSubGroup key={child.to} child={child} onNavigate={onNavigate} />
            ) : (
              <NavLink
                key={child.to}
                to={child.to}
                end={child.end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'block rounded-md px-2.5 py-1.5 text-[12.5px] transition-colors',
                    isActive
                      ? 'bg-brand-50 font-semibold text-brand-700'
                      : 'font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800',
                  )
                }
              >
                {child.label}
              </NavLink>
            ),
          )}
        </div>
      )}
    </div>
  )
}

// 3-daraja: "O'quv bo'limi" → "Guruhlar" → "Reyting" kabi ichki yig'iladigan bo'lim.
function NavSubGroup({ child, onNavigate }: { child: NavChild; onNavigate: () => void }) {
  const location = useLocation()
  const isUnder =
    child.children?.some(
      (c) => location.pathname === c.to || location.pathname.startsWith(c.to + '/'),
    ) ?? false
  const [openGroup, setOpenGroup] = useState(isUnder)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- marshrut shu bo'lim ostida bo'lsa avtomatik ochamiz
    if (isUnder) setOpenGroup(true)
  }, [isUnder])

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpenGroup((o) => !o)}
        className={cn(
          'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[12.5px] transition-colors',
          isUnder ? 'font-semibold text-brand-700' : 'font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800',
        )}
      >
        {child.label}
        <ChevronDown className={cn('ml-auto h-3 w-3 transition-transform', openGroup && 'rotate-180')} />
      </button>

      {openGroup && (
        <div className="mt-0.5 space-y-px pl-3">
          {child.children?.map((c) => (
            <NavLink
              key={c.to}
              to={c.to}
              end={c.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'block rounded-md px-2.5 py-1.5 text-[12.5px] transition-colors',
                  isActive
                    ? 'bg-brand-50 font-semibold text-brand-700'
                    : 'font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800',
                )
              }
            >
              {c.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}
