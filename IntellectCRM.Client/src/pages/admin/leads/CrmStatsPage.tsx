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
import { PageHeader } from '@/components/ui/PageHeader'
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
  // Qiziqish fanlari: jadval BARCHA fanlarni, diagramma esa eng ko'p 10 tasini ko'rsatadi.
  const interestRows = data.byInterest ?? []
  const topInterest = interestRows[0]
  const interestChart = interestRows.slice(0, 10).map((r) => ({
    name: r.label,
    Lidlar: r.count,
    Aylantirilgan: r.converted,
  }))
  const monthlyData = data.monthly.map((m) => ({
    name: `${monthShortNames[Number(m.month.slice(5, 7)) - 1] ?? m.month} '${m.month.slice(2, 4)}`,
    Yangi: m.created,
    Aylantirilgan: m.converted,
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="CRM statistika"
        sub="Lidlar va konversiya bo'yicha umumiy ko'rsatkichlar"
      />

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

      {/* Qiziqish fanlari (kurslar) bo'yicha — gorizontal bar + to'liq jadval */}
      <Card>
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold text-slate-800">Qiziqish fanlari bo'yicha lidlar</h2>
          {topInterest && (
            <p className="text-sm text-slate-400">
              Eng ko'p qiziqish:{' '}
              <span className="font-medium text-slate-600">{topInterest.label}</span> — {topInterest.count} ta lid
            </p>
          )}
        </div>

        {interestRows.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400">Ma'lumot yo'q</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={Math.max(200, interestChart.length * 46 + 40)}>
              <BarChart
                data={interestChart}
                layout="vertical"
                margin={{ top: 4, right: 24, left: 0, bottom: 0 }}
                barGap={2}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eef0f4" />
                <XAxis type="number" tickLine={false} axisLine={false} tick={axisTick} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={150}
                  tickLine={false}
                  axisLine={false}
                  tick={axisTick}
                />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <Bar dataKey="Lidlar" fill="#6366f1" radius={[0, 6, 6, 0]} maxBarSize={14} />
                <Bar dataKey="Aylantirilgan" fill="#16a34a" radius={[0, 6, 6, 0]} maxBarSize={14} />
              </BarChart>
            </ResponsiveContainer>

            {interestRows.length > interestChart.length && (
              <p className="mt-1 text-xs text-slate-400">
                Diagrammada eng ko'p {interestChart.length} ta fan — qolgani jadvalda.
              </p>
            )}

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Fan (kurs)</th>
                    <th className="py-2 pr-3 text-right font-medium">Lidlar</th>
                    <th className="py-2 pr-3 text-right font-medium">Aylantirilgan</th>
                    <th className="py-2 text-right font-medium">Konversiya</th>
                  </tr>
                </thead>
                <tbody>
                  {interestRows.map((r) => (
                    <tr key={r.label} className="border-b border-slate-50 last:border-0">
                      <td className="py-2 pr-3 text-slate-700">{r.label}</td>
                      <td className="py-2 pr-3 text-right font-mono text-slate-700">{r.count}</td>
                      <td className="py-2 pr-3 text-right font-mono text-emerald-600">{r.converted}</td>
                      <td className="py-2 text-right font-mono text-slate-500">
                        {r.conversionRate.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

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
