import { useEffect, useState } from 'react'
import { GraduationCap, BookOpen, Wallet, LogOut, MessageSquare, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { SalaryLedger, TeacherClass } from '@/types'
import { getMyClasses, getTeacherSalary } from '@/api/services/teacher'
import { useAuth } from '@/context/auth-context'
import { Loader } from '@/components/ui/Loader'
import { formatMoney } from '@/lib/utils'

function initialsOf(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

/** O'qituvchi profili — mobil ekran (teal): header karta, ma'lumot qatorlari, guruhlar, chiqish. */
export function TeacherProfilePage() {
  const { user, logout } = useAuth()
  const [classes, setClasses] = useState<TeacherClass[]>([])
  const [salary, setSalary] = useState<SalaryLedger | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getMyClasses().catch(() => [] as TeacherClass[]),
      getTeacherSalary().catch(() => null),
    ])
      .then(([cl, sal]) => {
        setClasses(cl)
        setSalary(sal)
      })
      .finally(() => setLoading(false))
  }, [])

  const subjectCount = classes.reduce((acc, c) => acc + c.subjects.length, 0)

  // Joriy oy maoshi (mavjud bo'lsa) — FAQAT hisoblangan summa ko'rsatiladi (foiz emas)
  const ym = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })()
  const currentMonth = salary?.months?.find((m) => m.month === ym) ?? null

  return (
    <div className="px-4 pt-3 pb-6">
      {/* Sarlavha */}
      <p className="mb-3 text-[17px] font-extrabold text-ink">Profil</p>

      {/* Header karta — teal cover + avatar + ma'lumot qatorlari */}
      <div className="overflow-hidden rounded-[20px] border border-line bg-white shadow-[var(--shadow-card)]">
        <div className="h-[90px] bg-gradient-to-br from-teal-500 to-teal-700" />
        <div className="-mt-10 flex flex-col items-center pb-4">
          <div
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-teal-700 text-[30px] font-bold text-white"
            style={{ boxShadow: '0 0 0 2px var(--color-paper), 0 0 0 5px rgba(13,148,136,.5)' }}
          >
            {initialsOf(user?.fullName || 'O')}
          </div>
          <p className="mt-3 text-[18px] font-extrabold text-ink">
            {user?.fullName || "O'qituvchi"}
          </p>
          {user?.email && <p className="text-[12px] text-mute">{user.email}</p>}
          <span className="mt-3 inline-flex items-center gap-1 rounded-lg bg-tealsoft px-2.5 py-1 text-[12px] font-semibold text-teal-700">
            <GraduationCap className="h-3.5 w-3.5" />
            O'qituvchi
          </span>

          {/* Ma'lumot qatorlari */}
          <div className="mt-4 w-full divide-y divide-line px-5">
            <InfoRow
              icon={GraduationCap}
              label="Guruhlar"
              value={classes.length > 0 ? `${classes.length} ta guruh` : '—'}
            />
            <InfoRow
              icon={BookOpen}
              label="Fanlar"
              value={subjectCount > 0 ? String(subjectCount) : '—'}
            />
            <InfoRow
              icon={Wallet}
              label="Maosh"
              value={formatMoney(currentMonth?.expected ?? 0)}
              mono
            />
          </div>
        </div>
      </div>

      {/* Dars beradigan guruhlar */}
      <div className="mt-4">
        <p className="pb-2 pl-1 text-[13px] font-bold tracking-tight text-ink">
          Dars beradigan guruhlar
        </p>
        {loading ? (
          <div className="rounded-[20px] border border-line bg-white p-5 shadow-[var(--shadow-card)]">
            <Loader label="Yuklanmoqda..." />
          </div>
        ) : classes.length === 0 ? (
          <div className="rounded-[20px] border border-line bg-white px-5 py-8 text-center text-[13px] text-faint shadow-[var(--shadow-card)]">
            Sizga biriktirilgan guruh/fan yo'q.
          </div>
        ) : (
          <div className="overflow-hidden rounded-[20px] border border-line bg-white shadow-[var(--shadow-card)]">
            {classes.map((c, i) => (
              <Link
                key={c.classId}
                to={`/teacher/groups/${c.classId}`}
                className={
                  'tap-scale flex items-center gap-3 px-4 py-3.5 text-left' +
                  (i < classes.length - 1 ? ' border-b border-line' : '')
                }
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-tealsoft text-[15px] font-extrabold text-teal-700">
                  {initialsOf(c.className)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold text-ink">{c.className}</p>
                  {c.subjects.length > 0 && (
                    <p className="truncate text-[11px] text-mute">
                      {c.subjects.map((s) => s.name).join(', ')}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Boshqa */}
      <div className="mt-4 overflow-hidden rounded-[20px] border border-line bg-white shadow-[var(--shadow-card)]">
        <Link to="/teacher/feedback" className="tap-scale flex items-center gap-3 px-4 py-3.5 text-left">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-tealsoft text-teal-700">
            <MessageSquare className="h-[18px] w-[18px]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold text-ink">Taklif va shikoyat</p>
            <p className="text-[11px] text-mute">Adminga taklif yoki shikoyat yuborish</p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-faint" />
        </Link>
      </div>

      {/* Chiqish */}
      <div className="mt-4">
        <button
          type="button"
          onClick={logout}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-line bg-transparent text-[15px] font-semibold text-red-500"
        >
          <LogOut className="h-[18px] w-[18px]" />
          Chiqish
        </button>
      </div>
    </div>
  )
}

function InfoRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: typeof GraduationCap
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="mt-0.5 text-mute">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] text-mute">{label}</p>
        <p className={'text-[14px] font-semibold text-ink' + (mono ? ' font-mono' : '')}>
          {value}
        </p>
      </div>
    </div>
  )
}
