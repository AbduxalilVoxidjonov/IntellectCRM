import { useEffect, useMemo, useState } from 'react'
import { BarChart3, Building2, MapPin, Search, Users, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { RoomUtilization } from '@/types'
import { getRoomUtilizationDashboard } from '@/api/services/rooms'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Loader } from '@/components/ui/Loader'
import { cn } from '@/lib/utils'

type StatusFilter = 'all' | 'Optimal' | 'Underutilized' | 'Overcrowded'

const STATUS_LABELS: Record<string, string> = {
  Optimal: 'Optimal',
  Underutilized: "Kam to'lgan",
  Overcrowded: "To'lib toshgan",
}

const STATUS_COLORS: Record<string, string> = {
  Optimal: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  Underutilized: 'text-amber-700 bg-amber-50 border-amber-200',
  Overcrowded: 'text-red-700 bg-red-50 border-red-200',
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  Optimal: <CheckCircle2 className="h-3.5 w-3.5" />,
  Underutilized: <TrendingUp className="h-3.5 w-3.5 rotate-[-45deg]" />,
  Overcrowded: <AlertTriangle className="h-3.5 w-3.5" />,
}

function efficiencyColor(score: number): string {
  if (score >= 50) return 'bg-emerald-500'
  if (score >= 30) return 'bg-amber-500'
  return 'bg-red-500'
}

function efficiencyTextColor(score: number): string {
  if (score >= 50) return 'text-emerald-700'
  if (score >= 30) return 'text-amber-700'
  return 'text-red-700'
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className={cn('h-full rounded-full transition-all', color)}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}

export function RoomUtilizationPage() {
  const [items, setItems] = useState<RoomUtilization[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  useEffect(() => {
    getRoomUtilizationDashboard()
      .then((data) => {
        const sorted = [...data].sort((a, b) => b.efficiencyScore - a.efficiencyScore)
        setItems(sorted)
      })
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchSearch = item.roomName.toLowerCase().includes(search.toLowerCase()) ||
        (item.building ?? '').toLowerCase().includes(search.toLowerCase())
      const matchStatus = statusFilter === 'all' || item.efficiencyStatus === statusFilter
      return matchSearch && matchStatus
    })
  }, [items, search, statusFilter])

  const summary = useMemo(() => {
    const optimal = items.filter((i) => i.efficiencyStatus === 'Optimal').length
    const under = items.filter((i) => i.efficiencyStatus === 'Underutilized').length
    const over = items.filter((i) => i.efficiencyStatus === 'Overcrowded').length
    const avgEff = items.length > 0
      ? Math.round(items.reduce((s, i) => s + i.efficiencyScore, 0) / items.length)
      : 0
    return { optimal, under, over, avgEff }
  }, [items])

  if (loading) return <Loader />

  return (
    <div className="space-y-6">
      <PageHeader
        title="Xona samaradorligi"
        sub="Xonalarning bandlik va samaradorlik ko'rsatkichlari"
      />

      {/* Xulosa statistikasi */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryKpi label="O'rtacha samaradorlik" value={`${summary.avgEff}%`} color="text-brand-600" />
        <SummaryKpi label="Optimal xonalar" value={String(summary.optimal)} color="text-emerald-600" />
        <SummaryKpi label="Kam to'lgan" value={String(summary.under)} color="text-amber-600" />
        <SummaryKpi label="To'lib toshgan" value={String(summary.over)} color="text-red-600" />
      </div>

      {/* Filtrlar */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Xona yoki bino bo'yicha qidirish..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400"
        >
          <option value="all">Barcha holatlar</option>
          <option value="Optimal">Optimal</option>
          <option value="Underutilized">Kam to'lgan</option>
          <option value="Overcrowded">To'lib toshgan</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <BarChart3 className="h-12 w-12 text-slate-300" />
            <p className="text-sm text-slate-500">
              {items.length === 0 ? "Hali xona qo'shilmagan" : "Filtr bo'yicha xona topilmadi"}
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <UtilizationCard key={item.roomId} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}

function SummaryKpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="kpi-card">
      <p className="kpi-label">{label}</p>
      <p className={cn('kpi-value', color)}>{value}</p>
    </div>
  )
}

function UtilizationCard({ item }: { item: RoomUtilization }) {
  const statusLabel = STATUS_LABELS[item.efficiencyStatus] ?? item.efficiencyStatus
  const statusCls = STATUS_COLORS[item.efficiencyStatus] ?? 'text-slate-600 bg-slate-100 border-slate-200'

  return (
    <div className="entity-card flex flex-col gap-4 p-5">
      {/* Sarlavha */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-800">{item.roomName}</h3>
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-400">
            {item.building && (
              <span className="flex items-center gap-1">
                <Building2 className="h-3 w-3" /> {item.building}
              </span>
            )}
            {item.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {item.location}
              </span>
            )}
          </div>
        </div>
        <span className={cn('flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium', statusCls)}>
          {STATUS_ICONS[item.efficiencyStatus]}
          {statusLabel}
        </span>
      </div>

      {/* Samaradorlik bali */}
      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-slate-500">Samaradorlik</span>
          <span className={cn('font-semibold tabular-nums', efficiencyTextColor(item.efficiencyScore))}>
            {item.efficiencyScore}%
          </span>
        </div>
        <ProgressBar value={item.efficiencyScore} color={efficiencyColor(item.efficiencyScore)} />
      </div>

      {/* O'quvchi to'ldirishi */}
      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 text-slate-500">
            <Users className="h-3.5 w-3.5" />
            O'quvchilar ({item.currentStudents}/{item.capacity})
          </span>
          <span className="font-medium tabular-nums text-slate-700">{Math.round(item.occupancyPercent)}%</span>
        </div>
        <ProgressBar
          value={item.occupancyPercent}
          color={item.occupancyPercent > 95 ? 'bg-red-500' : item.occupancyPercent > 70 ? 'bg-amber-500' : 'bg-sky-500'}
        />
      </div>

      {/* Haftalik bandlik */}
      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-slate-500">Haftalik bandlik</span>
          <span className="font-medium tabular-nums text-slate-700">{Math.round(item.weeklyUtilizationPercent)}%</span>
        </div>
        <ProgressBar value={item.weeklyUtilizationPercent} color="bg-brand-500" />
      </div>

      {/* Qo'shimcha ma'lumot */}
      <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs text-slate-500">
        <span>Faol guruhlar: <strong className="text-slate-700">{item.activeGroupCount}</strong></span>
        <span>Sig'im: <strong className="text-slate-700">{item.capacity}</strong></span>
      </div>
    </div>
  )
}
