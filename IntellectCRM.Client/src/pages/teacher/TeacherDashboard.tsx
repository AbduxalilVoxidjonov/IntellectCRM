import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, GraduationCap, BookOpen, ClipboardCheck, ChevronRight, Users, Send } from 'lucide-react'
import type { TeacherClass } from '@/types'
import { getMyClasses, getTeacherSchool } from '@/api/services/teacher'
import { useAuth } from '@/context/auth-context'
import { telegramUrl } from '@/lib/utils'

const WEEKDAYS_UZ = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba']
const MONTHS_UZ = [
  'yanvar',
  'fevral',
  'mart',
  'aprel',
  'may',
  'iyun',
  'iyul',
  'avgust',
  'sentabr',
  'oktabr',
  'noyabr',
  'dekabr',
]

function todayLineUz(): string {
  const d = new Date()
  return `${d.getDate()}-${MONTHS_UZ[d.getMonth()]}, ${WEEKDAYS_UZ[d.getDay()]}`
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

function groupInitials(name: string): string {
  const cleaned = name.replace(/\s+/g, '')
  return cleaned.slice(0, 3).toUpperCase() || '?'
}

export function TeacherDashboard() {
  const { user } = useAuth()
  const [classes, setClasses] = useState<TeacherClass[]>([])
  const [channel, setChannel] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMyClasses()
      .then(setClasses)
      .finally(() => setLoading(false))
    getTeacherSchool()
      .then((s) => setChannel(s.telegramChannel || ''))
      .catch(() => {})
  }, [])

  const subjectCount = classes.reduce((acc, c) => acc + c.subjects.length, 0)

  const fullName = user?.fullName ?? ''
  const firstName = fullName.trim().split(/\s+/)[0] || 'ustoz'

  return (
    <div className="px-4 pb-6">
      {/* ── Header ── */}
      <div className="flex items-center gap-2.5 pt-2 pb-3">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium text-mute">{todayLineUz()}</p>
          <p className="text-[22px] font-extrabold tracking-tight text-ink">
            Assalomu alaykum, <span className="text-teal-600">{firstName}</span> {"\u{1F44B}"}
          </p>
        </div>
        <button
          type="button"
          className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-panel2 text-ink"
          aria-label="Bildirishnomalar"
        >
          <Bell className="h-5 w-5" />
        </button>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-teal-700 text-[14px] font-extrabold text-white">
          {initials(fullName)}
        </div>
      </div>

      {/* ── Tezkor statistika ── */}
      <div className="flex gap-2.5 pb-4">
        <div className="flex-1 rounded-[18px] border border-line bg-white p-3.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-tealsoft text-teal-600">
            <GraduationCap className="h-4 w-4" />
          </div>
          <p className="mt-3 text-[22px] font-extrabold tracking-tight text-ink font-mono">
            {classes.length}
          </p>
          <p className="mt-1 text-[11px] leading-tight text-mute">Guruhlar</p>
        </div>
        <div className="flex-1 rounded-[18px] border border-line bg-white p-3.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-sky-100 text-sky-600">
            <BookOpen className="h-4 w-4" />
          </div>
          <p className="mt-3 text-[22px] font-extrabold tracking-tight text-ink font-mono">
            {subjectCount}
          </p>
          <p className="mt-1 text-[11px] leading-tight text-mute">Fanlar</p>
        </div>
      </div>

      {/* ── Topshiriqlar yorlig'i ── */}
      <Link
        to="/teacher/assignments"
        className="tap-scale mb-5 flex items-center gap-3.5 rounded-[20px] p-[18px] text-white shadow-[var(--shadow-glow)]"
        style={{ background: 'linear-gradient(135deg,#0D9488,#115E59)' }}
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white">
          <ClipboardCheck className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-extrabold tracking-tight">Topshiriqlar</p>
          <p className="mt-0.5 text-[13px] text-white/85">
            Guruhlaringizga topshiriq yarating va kuzating
          </p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-white/80" />
      </Link>

      {/* ── Telegram kanal (sozlangan bo'lsa) ── */}
      {channel.trim() && (
        <a
          href={telegramUrl(channel)}
          target="_blank"
          rel="noopener noreferrer"
          className="tap-scale mb-5 flex items-center gap-3.5 rounded-[20px] border border-line bg-white p-3.5 shadow-[var(--shadow-card)]"
        >
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"
            style={{ background: '#229ED9' }}
          >
            <Send className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold tracking-tight text-ink">Telegram kanalimiz</p>
            <p className="mt-0.5 text-[12px] text-mute">Markaz e'lonlari — kanalga o'ting</p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-faint" />
        </a>
      )}

      {/* ── Mening guruhlarim ── */}
      <div>
        <p className="px-1 pb-2 text-[13px] font-bold tracking-tight text-ink">Mening guruhlarim</p>
        {loading ? (
          <div className="space-y-2.5">
            <div className="skeleton h-[78px] rounded-[20px]" />
            <div className="skeleton h-[78px] rounded-[20px]" />
            <div className="skeleton h-[78px] rounded-[20px]" />
          </div>
        ) : classes.length === 0 ? (
          <div className="rounded-[20px] border border-line bg-white px-5 py-10 text-center text-[13px] text-mute shadow-[var(--shadow-card)]">
            Sizga biriktirilgan guruh yo'q. Markaz ma'muriyatiga murojaat qiling.
          </div>
        ) : (
          <div className="space-y-2.5">
            {classes.map((c) => (
              <Link
                key={c.classId}
                to={`/teacher/groups/${c.classId}`}
                className="tap-scale flex items-center gap-3.5 rounded-[20px] border border-line bg-white p-3.5 shadow-[var(--shadow-card)]"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 text-[14px] font-extrabold text-white">
                  {groupInitials(c.className)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold text-ink">{c.className}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {c.subjects.length === 0 ? (
                      <span className="inline-flex items-center gap-1 text-[12px] text-faint">
                        <Users className="h-3.5 w-3.5" /> Fan biriktirilmagan
                      </span>
                    ) : (
                      c.subjects.map((s) => (
                        <span
                          key={s.id}
                          className="rounded-lg bg-chip px-2.5 py-1 text-[12px] font-semibold text-ink"
                        >
                          {s.name}
                        </span>
                      ))
                    )}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-faint" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
