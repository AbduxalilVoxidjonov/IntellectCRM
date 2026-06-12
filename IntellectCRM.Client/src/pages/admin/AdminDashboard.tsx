import { useState } from 'react'
import {
  Users,
  GraduationCap,
  Star,
  CalendarCheck,
  UserCheck,
  UserX,
  Wallet,
  BadgeCheck,
  UsersRound,
  UserMinus,
} from 'lucide-react'
import { getAdminDashboard } from '@/api/services/dashboard'
import { useAsync } from '@/hooks/useAsync'
import { Card } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import { PageHeader } from '@/components/ui/PageHeader'
import { Loader } from '@/components/ui/Loader'
import {
  ClassPerformanceChart,
  type Metric,
} from '@/components/charts/ClassPerformanceChart'
import { cn } from '@/lib/utils'

export function AdminDashboard() {
  const { data, loading, error } = useAsync(getAdminDashboard, [])
  const [metric, setMetric] = useState<Metric>('grade')

  if (loading) return <Loader label="Yuklanmoqda..." />
  if (error) return <p className="text-red-600">Xatolik: {error}</p>
  if (!data) return null

  const { stats, classPerformance, topClasses, studentBreakdown } = data

  // O'rtacha baho bo'yicha eng yuqori 5 ta sinf
  const ranked = [...topClasses]
    .sort((a, b) => b.averageGrade - a.averageGrade)
    .slice(0, 5)

  return (
    <div>
      <PageHeader title="Bosh sahifa" sub="Markaz bo'yicha umumiy ko'rsatkichlar" />

      {/* Statistik kartalar */}
      <div className="kpi-grid mb-4">
        <StatCard
          label="O'quvchilar soni"
          value={stats.studentsCount.toLocaleString()}
          icon={Users}
        />
        <StatCard
          label="O'qituvchilar soni"
          value={stats.teachersCount}
          icon={GraduationCap}
          iconBg="bg-violet-50"
          iconColor="text-violet-600"
        />
        <StatCard
          label="O'rtacha baho"
          value={stats.averageGrade.toFixed(1)}
          icon={Star}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
          hint="5 ballik tizim"
        />
        <StatCard
          label="Umumiy davomat"
          value={stats.attendanceRate == null ? '—' : `${stats.attendanceRate}%`}
          icon={CalendarCheck}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
      </div>

      {/* O'quvchilar bo'yicha taqsimot */}
      <div className="kpi-grid mb-4">
        <StatCard
          label="Aktiv talabalar"
          value={studentBreakdown.active.toLocaleString()}
          icon={UserCheck}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <StatCard
          label="Aktiv emas"
          value={studentBreakdown.inactive.toLocaleString()}
          icon={UserX}
          iconBg="bg-slate-100"
          iconColor="text-slate-500"
        />
        <StatCard
          label="Qarzdorlar"
          value={studentBreakdown.debtors.toLocaleString()}
          icon={Wallet}
          iconBg="bg-red-50"
          iconColor="text-red-600"
        />
        <StatCard
          label="Qarzi yo'q"
          value={studentBreakdown.paid.toLocaleString()}
          icon={BadgeCheck}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <StatCard
          label="Guruhli"
          value={studentBreakdown.withGroup.toLocaleString()}
          icon={UsersRound}
          iconBg="bg-violet-50"
          iconColor="text-violet-600"
        />
        <StatCard
          label="Guruhsiz"
          value={studentBreakdown.withoutGroup.toLocaleString()}
          icon={UserMinus}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
        />
      </div>

      {/* Statistika grafigi + reyting */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Grafik (baho / davomat tanlash) */}
        <Card
          className="xl:col-span-2"
          title="Guruhlar bo'yicha statistika"
          sub={metric === 'grade' ? "O'rtacha baho bo'yicha" : "Davomat bo'yicha"}
          actions={
            <div className="tabs" role="tablist">
              <button
                type="button"
                role="tab"
                onClick={() => setMetric('grade')}
                className={cn('tab', metric === 'grade' && 'active')}
              >
                O'rtacha baho
              </button>
              <button
                type="button"
                role="tab"
                onClick={() => setMetric('attendance')}
                className={cn('tab', metric === 'attendance' && 'active')}
              >
                Davomat
              </button>
            </div>
          }
        >
          <ClassPerformanceChart data={classPerformance} metric={metric} />
        </Card>

        {/* Eng yuqori o'rtacha baholi guruhlar (Top 5) */}
        <Card title="Eng yuqori bahoga ega guruhlar" sub="O'rtacha baho bo'yicha Top 5">
          <ul className="space-y-2">
            {ranked.map((c, i) => (
              <li
                key={c.id}
                className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/40 p-3 transition-colors hover:bg-slate-50"
              >
                <div
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-mono text-sm font-bold',
                    i === 0
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-100 text-slate-500',
                  )}
                >
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-800">{c.name}</p>
                  <p className="font-mono text-xs text-slate-400">{c.studentsCount} o'quvchi</p>
                </div>
                <div className="flex items-center gap-1 text-amber-600">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span className="font-mono font-semibold">{c.averageGrade.toFixed(1)}</span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}
