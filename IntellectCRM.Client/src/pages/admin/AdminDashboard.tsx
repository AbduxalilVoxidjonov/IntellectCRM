import { UserPlus, Hourglass, UserCheck, Snowflake, Wallet } from 'lucide-react'
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

  const { header } = data

  return (
    <div>
      <PageHeader title="Bosh sahifa" sub="Markaz bo'yicha umumiy ko'rsatkichlar" />

      {/* Asosiy 5 ta ko'rsatkich */}
      <div className="kpi-grid mb-4">
        <StatCard
          label="Lidlar"
          value={header.leads.toLocaleString()}
          icon={UserPlus}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <StatCard
          label="Sinovda o'quvchilar"
          value={header.trialStudents.toLocaleString()}
          icon={Hourglass}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
        />
        <StatCard
          label="Faol o'quvchilar"
          value={header.paidThisMonth.toLocaleString()}
          icon={UserCheck}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          hint="shu oy to'lov qilgan"
        />
        <StatCard
          label="Muzlatilganlar"
          value={header.frozen.toLocaleString()}
          icon={Snowflake}
          iconBg="bg-sky-50"
          iconColor="text-sky-600"
        />
        <StatCard
          label="Qarzdorlar"
          value={header.debtors.toLocaleString()}
          icon={Wallet}
          iconBg="bg-red-50"
          iconColor="text-red-600"
        />
      </div>

      {/* AI Tahlil — markaz bo'yicha kunlik sun'iy intellekt tahlili */}
      <div className="mb-4">
        <CenterAiAnalysisCard />
      </div>

      {/* Bugungi darslar monitoringi — o'qituvchilar davomat qildimi va baho qo'ydimi */}
      <TodayLessonsMonitor />
    </div>
  )
}
