import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Users, UserCheck, Percent } from 'lucide-react'
import { getCrmStats } from '@/api/services/leads'
import { useAsync } from '@/hooks/useAsync'
import { Card } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import { Loader } from '@/components/ui/Loader'
import { monthShortNames } from '@/config/constants'

const PIE_COLORS = ['#6366f1', '#16a34a', '#f59e0b', '#0ea5e9', '#ec4899', '#94a3b8']

const axisTick = { fontSize: 12, fill: '#94a3b8' }
const tooltipStyle = { borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }

export function CrmStatsPage() {
  const { data, loading, error } = useAsync(getCrmStats, [])

  if (loading) return <Loader label="Yuklanmoqda..." />
  if (error) return <p className="text-red-600">Xatolik: {error}</p>
  if (!data) return null

  const sourceData = data.bySource.map((s) => ({ name: s.label, count: s.count }))
  const stageData = data.byStage.map((s) => ({ name: s.label, value: s.count }))
  const monthlyData = data.monthly.map((m) => ({
    name: monthShortNames[Number(m.month.slice(5, 7)) - 1] ?? m.month,
    Yangi: m.created,
    Aylantirilgan: m.converted,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">CRM statistika</h1>
        <p className="text-sm text-slate-400">Lidlar va konversiya bo'yicha umumiy ko'rsatkichlar</p>
      </div>

      {/* KPI kartalar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Jami lidlar" value={data.totalLeads.toLocaleString()} icon={Users} />
        <StatCard
          label="Aylantirilgan"
          value={data.converted.toLocaleString()}
          icon={UserCheck}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <StatCard
          label="Konversiya"
          value={`${data.conversionRate.toFixed(1)}%`}
          icon={Percent}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Manba bo'yicha (bar) */}
        <Card>
          <h2 className="mb-4 font-semibold text-slate-800">Manba bo'yicha lidlar</h2>
          {sourceData.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">Ma'lumot yo'q</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={sourceData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f4" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={axisTick} />
                <YAxis tickLine={false} axisLine={false} tick={axisTick} allowDecimals={false} />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} contentStyle={tooltipStyle} />
                <Bar dataKey="count" name="Lidlar" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Bosqich bo'yicha (pie) */}
        <Card>
          <h2 className="mb-4 font-semibold text-slate-800">Bosqich bo'yicha lidlar</h2>
          {stageData.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">Ma'lumot yo'q</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stageData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(entry: { name?: string; value?: number }) =>
                    `${entry.name ?? ''}: ${entry.value ?? 0}`
                  }
                >
                  {stageData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 13 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Oylik dinamika (line) */}
      <Card>
        <h2 className="mb-4 font-semibold text-slate-800">Oylik dinamika</h2>
        {monthlyData.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400">Ma'lumot yo'q</p>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f4" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tick={axisTick} />
              <YAxis tickLine={false} axisLine={false} tick={axisTick} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 13 }} />
              <Line type="monotone" dataKey="Yangi" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
              <Line
                type="monotone"
                dataKey="Aylantirilgan"
                stroke="#16a34a"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  )
}
