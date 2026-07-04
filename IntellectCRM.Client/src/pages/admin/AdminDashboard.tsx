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
import { StatCard } from '@/components/ui/StatCard'
import { PageHeader } from '@/components/ui/PageHeader'
import { Loader } from '@/components/ui/Loader'
import { TodayLessonsMonitor } from '@/components/dashboard/TodayLessonsMonitor'
import { CenterAiAnalysisCard } from '@/components/dashboard/CenterAiAnalysisCard'

export function AdminDashboard() {
  const { data, loading, error } = useAsync(getAdminDashboard, [])

  if (loading) return <Loader label="Yuklanmoqda..." />
  if (error) return <p className="text-red-600">Xatolik: {error}</p>
  if (!data) return null

  const { stats, studentBreakdown } = data

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

      {/* AI Tahlil — markaz bo'yicha kunlik sun'iy intellekt tahlili (guruh statistikasidan tepada) */}
      <div className="mb-4">
        <CenterAiAnalysisCard />
      </div>

      {/* Bugungi darslar monitoringi — o'qituvchilar davomat qildimi va baho qo'ydimi */}
      <TodayLessonsMonitor />
    </div>
  )
}
