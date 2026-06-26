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
  CheckSquare,
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
import { WeeklySchedule } from '@/components/dashboard/WeeklySchedule'
import { cn } from '@/lib/utils'

export function AdminDashboard() {
  const { data, loading, error } = useAsync(getAdminDashboard, [])
  const [metric, setMetric] = useState<Metric>('grade')

  if (loading) return <Loader label="Yuklanmoqda..." />
  if (error) return <p className="text-red-600">Xatolik: {error}</p>
  if (!data) return null

  const { stats, classPerformance, studentBreakdown } = data

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

      {/* O'quvchilar bo'yicha taqsimot + Baholash faollik */}
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
          label="Baholash faollik"
          value={(data.totalGradesCount ?? 0).toLocaleString()}
          icon={CheckSquare}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          hint="shu oyda kiritilgan ba'holar"
        />
      </div>

      {/* Statistika grafigi + reyting */}
      <div className="grid grid-cols-1 gap-4">
        {/* Grafik (baho / davomat tanlash) — x o'qida o'qituvchi, guruh nomi hoverda */}
        <Card
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
      </div>

      {/* Dars jadvali (raspisaniye) — yaratilgan guruhlarning haftalik jadvali */}
      <div className="mt-4">
        <WeeklySchedule />
      </div>
    </div>
  )
}
