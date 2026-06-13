import { useEffect, useState } from 'react'
import { GraduationCap, BookOpen, Crown, Wallet, LogOut } from 'lucide-react'
import type { SalaryLedger, TeacherClass } from '@/types'
import { getMyClasses, getTeacherSalary } from '@/api/services/teacher'
import { useAuth } from '@/context/auth-context'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
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

/** O'qituvchi profili — mobil ekran: nom/login, guruh/fanlar, maosh xulosasi, chiqish. */
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

  const homeroomCount = classes.filter((c) => c.isHomeroom).length
  const subjectCount = classes.reduce((acc, c) => acc + c.subjects.length, 0)

  // Joriy oy maoshi (mavjud bo'lsa)
  const ym = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })()
  const currentMonth = salary?.months?.find((m) => m.month === ym) ?? null
  const isPercent = salary?.salaryMode === 'percent'
  const expected = currentMonth?.expected ?? 0
  const paid = currentMonth?.paid ?? 0
  const remaining = Math.max(0, expected - paid)

  return (
    <div className="space-y-4">
      {/* Profil sarlavhasi */}
      <Card>
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-xl font-extrabold text-white shadow-sm">
            {initialsOf(user?.fullName || 'O')}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-extrabold tracking-tight text-slate-800">
              {user?.fullName || "O'qituvchi"}
            </p>
            {user?.email && (
              <p className="truncate text-sm text-slate-400">{user.email}</p>
            )}
            <span className="mt-1 inline-flex">
              <Badge tone="violet">O'qituvchi</Badge>
            </span>
          </div>
        </div>
      </Card>

      {/* Qisqacha statistika */}
      <div className="grid grid-cols-3 gap-3">
        <MiniStat icon={GraduationCap} value={classes.length} label="Guruhlar" />
        <MiniStat icon={BookOpen} value={subjectCount} label="Fanlar" />
        <MiniStat icon={Crown} value={homeroomCount} label="Rahbarlik" />
      </div>

      {/* Maosh xulosasi — FAQAT hisoblangan summa (foiz/ulush ko'rsatilmaydi) */}
      {salary && (
        <Card title="Maosh" sub={isPercent ? "Yig'ilgan to'lovga asoslangan" : "Qat'iy oylik"} tight>
          <div className="space-y-3 p-[18px]">
            <div className="flex items-center gap-3 rounded-xl border border-brand-100 bg-brand-50 p-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white text-brand-600">
                <Wallet className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-500">Joriy oy hisoblandi</p>
                <p className="font-mono text-xl font-extrabold text-slate-800">
                  {formatMoney(expected)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <SalaryCell label="Berildi" value={formatMoney(paid)} />
              <SalaryCell label="Qoldi" value={formatMoney(remaining)} />
            </div>
          </div>
        </Card>
      )}

      {/* Guruhlar/fanlar */}
      <Card title="Dars beradigan guruhlar" tight>
        {loading ? (
          <div className="p-5">
            <Loader label="Yuklanmoqda..." />
          </div>
        ) : classes.length === 0 ? (
          <div className="state px-5 py-8 text-center text-sm text-slate-400">
            Sizga biriktirilgan guruh/fan yo'q.
          </div>
        ) : (
          <div className="space-y-2.5 p-[18px]">
            {classes.map((c) => (
              <div
                key={c.classId}
                className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-[var(--shadow-1)]"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold tracking-tight text-slate-800">{c.className}</p>
                  {c.isHomeroom && (
                    <Badge tone="amber">
                      <Crown className="h-3 w-3" /> Rahbar
                    </Badge>
                  )}
                </div>
                {c.subjects.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {c.subjects.map((s) => (
                      <span
                        key={s.id}
                        className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
                      >
                        {s.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Chiqish */}
      <button
        type="button"
        onClick={logout}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3.5 font-bold text-red-600 transition-colors hover:bg-red-100"
      >
        <LogOut className="h-5 w-5" />
        Chiqish
      </button>
    </div>
  )
}

function MiniStat({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof GraduationCap
  value: number
  label: string
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-center shadow-[var(--shadow-1)]">
      <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-2 font-mono text-xl font-extrabold text-slate-800">{value}</p>
      <p className="text-[11px] text-slate-400">{label}</p>
    </div>
  )
}

function SalaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 font-mono text-sm font-extrabold text-slate-800">{value}</p>
    </div>
  )
}
