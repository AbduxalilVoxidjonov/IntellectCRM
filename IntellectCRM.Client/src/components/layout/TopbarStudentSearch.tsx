import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, User, X } from 'lucide-react'
import type { Student } from '@/types'
import { useAuth } from '@/context/auth-context'
import { searchStudents } from '@/api/services/students'
import { cn } from '@/lib/utils'

/** Qidiruv natijasidagi o'quvchi (arxivdagilar ham). */
interface Hit {
  id: string
  fullName: string
  phone?: string
  className?: string
  archived: boolean
}

/**
 * Topbar'da DOIM ko'rinib turadigan inline o'quvchi qidiruvi (barcha sahifalarda).
 * FISH yoki telefon (o'z/ota/ona) bo'yicha qidiradi, natijalar dropdown'da chiqadi,
 * tanlansa o'quvchi detal sahifasiga (`/admin/students/:id`) o'tadi. Arxivdagilar ham
 * chiqadi ("arxiv" badge). Faqat `students` ruxsati borlar uchun ko'rinadi.
 */
export function TopbarStudentSearch() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const [active, setActive] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const canSearch = !!user && (!user.permissions || user.permissions.includes('students'))

  // Tashqariga bosilganda dropdown'ni yopamiz
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // FISH/telefon bo'yicha qidirish (debounce 250ms)
  useEffect(() => {
    if (!canSearch) return
    const q = query.trim()
    if (q.length < 2) {
      setHits([])
      setSearching(false)
      return
    }
    setSearching(true)
    let cancelled = false
    const t = setTimeout(async () => {
      try {
        const list = await searchStudents(q)
        if (cancelled) return
        setHits(
          list.map((s: Student) => ({
            id: s.id,
            fullName: s.fullName,
            phone: s.phone || s.parentPhone || s.fatherPhone || s.motherPhone || undefined,
            className: s.groups?.[0] || s.className || undefined,
            archived: !!s.isArchived,
          })),
        )
        setActive(0)
      } catch {
        if (!cancelled) setHits([])
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [query, canSearch])

  if (!canSearch) return null

  const go = (s: Hit) => {
    setOpen(false)
    setQuery('')
    setHits([])
    navigate(`/admin/students/${s.id}`)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false)
      inputRef.current?.blur()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, hits.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const s = hits[active]
      if (s) go(s)
    }
  }

  const showDropdown = open && query.trim().length >= 2

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 transition-colors focus-within:border-brand-400 focus-within:bg-white">
        <Search className="h-[16px] w-[16px] shrink-0 text-slate-400" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="O'quvchi qidirish (FISH yoki telefon)..."
          className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setHits([])
              inputRef.current?.focus()
            }}
            className="shrink-0 text-slate-300 transition-colors hover:text-slate-500"
            title="Tozalash"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-40 mt-2 max-h-96 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          {hits.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">
              {searching ? 'Qidirilmoqda...' : 'Hech narsa topilmadi'}
            </p>
          ) : (
            hits.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => go(s)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                  i === active ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-50',
                )}
              >
                <User className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-2">
                    <span className="truncate">{s.fullName}</span>
                    {s.archived && (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                        arxiv
                      </span>
                    )}
                  </span>
                  {(s.phone || s.className) && (
                    <span className="truncate text-xs text-slate-400">
                      {s.className && <span>{s.className}</span>}
                      {s.className && s.phone && <span> · </span>}
                      {s.phone && <span className="font-mono">{s.phone}</span>}
                    </span>
                  )}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
