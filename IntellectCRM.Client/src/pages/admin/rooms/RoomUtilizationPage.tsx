import { useEffect, useMemo, useState } from 'react'
import { BarChart3, Building2, MapPin, Search, Users, TrendingUp, AlertTriangle, CheckCircle2, X, Layers } from 'lucide-react'
import type { RoomUtilization } from '@/types'
import { getRoomUtilizationDashboard, getRoomCapacity, type RoomCapacityMetric } from '@/api/services/rooms'
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
  const [capacityModal, setCapacityModal] = useState<RoomCapacityMetric | null>(null)
  const [capacityLoading, setCapacityLoading] = useState<string | null>(null)

  useEffect(() => {
    getRoomUtilizationDashboard()
      .then((data) => {
        const sorted = [...data].sort((a, b) => b.efficiencyScore - a.efficiencyScore)
        setItems(sorted)
      })
      .finally(() => setLoading(false))
  }, [])

  function openCapacity(roomId: string) {
    setCapacityLoading(roomId)
    getRoomCapacity(roomId)
      .then(setCapacityModal)
      .catch(() => {})
      .finally(() => setCapacityLoading(null))
  }

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
            <UtilizationCard
              key={item.roomId}
              item={item}
              onCapacityClick={() => openCapacity(item.roomId)}
              capacityLoading={capacityLoading === item.roomId}
            />
          ))}
        </div>
      )}

      {capacityModal && (
        <CapacityModal metric={capacityModal} onClose={() => setCapacityModal(null)} />
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

function UtilizationCard({ item, onCapacityClick, capacityLoading }: {
  item: RoomUtilization
  onCapacityClick: () => void
  capacityLoading: boolean
}) {
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
        <span>Haftalik soat: <strong className="text-slate-700">{Math.round(item.weeklyActiveHours)}h</strong></span>
      </div>
      {item.groupNames && item.groupNames.length > 0 && (
        <div className="flex flex-wrap gap-1 border-t border-slate-100 pt-2">
          {item.groupNames.map((name) => (
            <span key={name} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{name}</span>
          ))}
        </div>
      )}

      <button
        onClick={onCapacityClick}
        disabled={capacityLoading}
        className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 py-1.5 text-xs font-medium text-brand-700 transition hover:bg-brand-100 disabled:opacity-60"
      >
        <Layers className="h-3.5 w-3.5" />
        {capacityLoading ? 'Yuklanmoqda...' : 'Sig\'im tahlili'}
      </button>
    </div>
  )
}

const CAPACITY_STATUS_STYLES: Record<string, { cls: string; label: string }> = {
  Optimal:      { cls: 'text-emerald-700 bg-emerald-50 border-emerald-200', label: 'Optimal' },
  Underutilized:{ cls: 'text-amber-700 bg-amber-50 border-amber-200',      label: "Kam to'lgan" },
  Overcrowded:  { cls: 'text-red-700 bg-red-50 border-red-200',            label: "To'lib toshgan" },
  Empty:        { cls: 'text-slate-600 bg-slate-100 border-slate-200',     label: 'Bo\'sh' },
}

function utilizationBarColor(pct: number): string {
  if (pct > 90) return 'bg-red-500'
  if (pct > 60) return 'bg-emerald-500'
  return 'bg-amber-500'
}

function CapacityModal({ metric, onClose }: { metric: RoomCapacityMetric; onClose: () => void }) {
  const st = CAPACITY_STATUS_STYLES[metric.status] ?? CAPACITY_STATUS_STYLES['Optimal']

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Sig'im tahlili</h2>
            <p className="text-sm text-slate-500">{metric.roomName}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-slate-100">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 p-5">
          {/* Asosiy metrikalar */}
          <div className="grid grid-cols-3 gap-3">
            <MetricBox label="Sig'im" value={String(metric.capacity)} sub="joy / guruh" />
            <MetricBox label="Guruhlar" value={String(metric.groupCount)} sub="faol guruh" />
            <MetricBox label="Jami slotlar" value={String(metric.totalSlots)} sub={`${metric.capacity}×${metric.groupCount}`} />
          </div>

          {/* Utilization progress */}
          <div>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">
                O'quvchilar: <span className="font-semibold tabular-nums text-slate-900">{metric.actualStudents}</span>
                <span className="text-slate-400"> / {metric.totalSlots}</span>
              </span>
              <span className={cn('rounded-full border px-2.5 py-0.5 text-xs font-medium', st.cls)}>
                {st.label}
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={cn('h-full rounded-full transition-all', utilizationBarColor(metric.utilizationPercent))}
                style={{ width: `${Math.min(100, metric.utilizationPercent)}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-xs text-slate-400">
              <span>{metric.utilizationPercent.toFixed(1)}% to'lgan</span>
              <span className={metric.gap > 0 ? 'text-amber-600' : 'text-emerald-600'}>
                {metric.gap > 0 ? `${metric.gap} bo'sh joy` : 'To\'liq band'}
              </span>
            </div>
          </div>

          {/* Guruhlar jadvali */}
          {metric.groups.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Guruhlar bo'yicha</p>
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                {metric.groups.map((g) => {
                  const pct = metric.capacity > 0 ? Math.round(g.studentCount / metric.capacity * 100) : 0
                  return (
                    <div key={g.groupId} className="flex items-center justify-between px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">{g.groupName}</p>
                        {g.courseName && <p className="text-xs text-slate-400">{g.courseName}</p>}
                      </div>
                      <div className="ml-3 flex items-center gap-2 text-right">
                        <span className="text-sm font-semibold tabular-nums text-slate-700">
                          {g.studentCount}
                          <span className="text-xs font-normal text-slate-400">/{metric.capacity}</span>
                        </span>
                        <span className={cn(
                          'min-w-[44px] rounded-full px-2 py-0.5 text-center text-xs font-medium',
                          pct > 90 ? 'bg-red-100 text-red-700' :
                          pct > 60 ? 'bg-emerald-100 text-emerald-700' :
                                     'bg-amber-100 text-amber-700'
                        )}>
                          {pct}%
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Tavsiya */}
          {metric.gap > 0 && metric.status !== 'Overcrowded' && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>
                <strong>{metric.gap} ta</strong> bo'sh o'rin bor. Yangi o'quvchilar qabul qilish tavsiya etiladi.
              </span>
            </div>
          )}
          {metric.status === 'Overcrowded' && (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>Xona sig'imidan oshib ketgan. Guruh sonini kamaytirish yoki kattaroq xona kerak.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MetricBox({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-3 text-center">
      <p className="text-lg font-bold tabular-nums text-slate-800">{value}</p>
      <p className="text-xs font-medium text-slate-600">{label}</p>
      <p className="text-xs text-slate-400">{sub}</p>
    </div>
  )
}
