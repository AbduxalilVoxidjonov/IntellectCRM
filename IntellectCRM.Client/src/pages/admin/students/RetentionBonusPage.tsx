import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Award,
  CheckCircle2,
  Download,
  Hourglass,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  Undo2,
  Wallet,
} from 'lucide-react'
import {
  getRetentionReport,
  exportRetentionReport,
  restartRetentionCycle,
  cancelRetentionBonus,
  type RetentionReport,
  type RetentionRow,
  type RetentionState,
  type RetentionStatus,
} from '@/api/services/retentionBonus'
import { apiErrorMessage, cn, formatMoney } from '@/lib/utils'
import { usePerm } from '@/lib/permissions'
import { Card } from '@/components/ui/Card'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Loader } from '@/components/ui/Loader'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { GiveRetentionBonusModal } from './GiveRetentionBonusModal'
import { RetentionSettingsModal } from './RetentionSettingsModal'

type Chip = 'all' | 'progress' | 'ready' | 'broken' | 'given'

const CHIPS: { key: Chip; label: string }[] = [
  { key: 'all', label: 'Hammasi' },
  { key: 'ready', label: 'Tayyor' },
  { key: 'progress', label: "Yo'lda" },
  { key: 'broken', label: 'Uzilgan' },
  { key: 'given', label: 'Berilgan' },
]

/** Oy katagining belgisi va tushuntirishi (jadval ustidagi izohda ham shu ishlatiladi). */
const STATE_UI: Record<RetentionState, { icon: string; title: string; cls: string }> = {
  paid: { icon: '✅', title: "To'liq — o'qidi va to'ladi", cls: 'bg-emerald-50 text-emerald-700' },
  debt: { icon: '⏳', title: "Qarzdor — o'qidi, lekin to'lov hali yo'q (sikl uzilmaydi)", cls: 'bg-amber-50 text-amber-700' },
  frozen: { icon: '❄️', title: "Muzlatilgan — sanoq to'xtaydi, oyna cho'ziladi", cls: 'bg-sky-50 text-sky-700' },
  gone: { icon: '🚪', title: "A'zolik yo'q — sanoq to'xtaydi", cls: 'bg-slate-100 text-slate-500' },
}

const STATUS_UI: Record<RetentionStatus, { label: string; tone: BadgeTone }> = {
  ready: { label: 'Tayyor', tone: 'green' },
  progress: { label: "Yo'lda", tone: 'default' },
  broken: { label: 'Uzildi', tone: 'red' },
  notstarted: { label: 'Boshlanmagan', tone: 'amber' },
}

const control =
  'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-100'

/** Qatorda ko'rsatiladigan oxirgi N oy — jadval juda uzun bo'lib ketmasin. */
const MAX_CELLS = 14

export function RetentionBonusPage() {
  const { can } = usePerm()
  const canEdit = can('finance', 'edit')

  const [report, setReport] = useState<RetentionReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [chip, setChip] = useState<Chip>('all')
  const [search, setSearch] = useState('')
  const [giveFor, setGiveFor] = useState<RetentionRow | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [busy, setBusy] = useState('')

  const load = () => {
    setLoading(true)
    setError('')
    getRetentionReport()
      .then(setReport)
      .catch((err) => setError(apiErrorMessage(err, "Bonus hisobotini yuklab bo'lmadi")))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const rows = report?.rows ?? []

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (chip === 'given' && r.awards.filter((a) => a.status === 'given').length === 0) return false
      if (chip !== 'all' && chip !== 'given' && r.status !== chip) return false
      if (q && !r.fullName.toLowerCase().includes(q) && !r.groupNames.toLowerCase().includes(q))
        return false
      return true
    })
  }, [rows, chip, search])

  const totals = useMemo(() => {
    const given = rows.flatMap((r) => r.awards).filter((a) => a.status === 'given')
    return {
      ready: rows.filter((r) => r.status === 'ready').length,
      progress: rows.filter((r) => r.status === 'progress').length,
      givenCount: given.length,
      givenSum: given.reduce((s, a) => s + a.totalAmount, 0),
    }
  }, [rows])

  const handleRestart = async (row: RetentionRow) => {
    const suggested = new Date().toISOString().slice(0, 7)
    const month = window.prompt(
      `${row.fullName} — sanoq qaysi oydan qayta boshlansin? (YYYY-MM)`,
      suggested,
    )
    if (!month) return
    setBusy(row.studentId)
    try {
      await restartRetentionCycle(row.studentId, month.trim())
      load()
    } catch (err) {
      setError(apiErrorMessage(err, "Qayta boshlab bo'lmadi"))
    } finally {
      setBusy('')
    }
  }

  const handleCancel = async (awardId: string, studentName: string) => {
    const reason = window.prompt(`${studentName} — bonusni bekor qilish sababi?`, '')
    if (reason === null) return
    setBusy(awardId)
    try {
      await cancelRetentionBonus(awardId, reason)
      load()
    } catch (err) {
      setError(apiErrorMessage(err, "Bekor qilib bo'lmadi"))
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Bonus hisoboti"
        sub={
          report
            ? `O'quvchi ${report.settings.monthsRequired} oy uzluksiz o'qib to'lasa — uni o'qitgan o'qituvchilarga bonus. Tanaffusga ruxsat: ${report.settings.maxGapMonths} oy.`
            : "O'quvchini ushlab turgan o'qituvchilarni rag'batlantirish."
        }
        actions={
          <>
            <Button variant="ghost" onClick={load} disabled={loading}>
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              Yangilash
            </Button>
            <Button variant="ghost" onClick={() => void exportRetentionReport()}>
              <Download className="h-4 w-4" />
              Excel
            </Button>
            {canEdit && (
              <Button variant="ghost" onClick={() => setSettingsOpen(true)}>
                <Settings2 className="h-4 w-4" />
                Sozlamalar
              </Button>
            )}
          </>
        }
      />

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Bonusga tayyor" value={totals.ready} icon={Award} />
        <StatCard label="Yo'lda" value={totals.progress} icon={Hourglass} />
        <StatCard label="Berilgan bonuslar" value={totals.givenCount} icon={CheckCircle2} />
        <StatCard label="Berilgan summa" value={formatMoney(totals.givenSum)} icon={Wallet} />
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          {CHIPS.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setChip(c.key)}
              className={cn(
                'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                chip === c.key
                  ? 'bg-brand-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
              {c.label}
            </button>
          ))}
          <div className="relative ml-auto">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className={cn(control, 'pl-9')}
              placeholder="F.I.Sh yoki guruh..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <p className="mt-3 text-xs text-slate-400">
          {(Object.keys(STATE_UI) as RetentionState[]).map((s) => (
            <span key={s} className="mr-4 inline-block">
              {STATE_UI[s].icon} {STATE_UI[s].title}
            </span>
          ))}
        </p>
      </Card>

      {loading ? (
        <Loader />
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-slate-400">
          {rows.length === 0 ? (
            <>
              Hali birorta o'quvchida bonus ptichkasi yoqilmagan. O'quvchi formasidagi
              «Ushlab turish bonusi» bo'limidan yoqing.
            </>
          ) : (
            'Filtrga mos o’quvchi topilmadi.'
          )}
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">F.I.Sh</th>
                <th className="px-4 py-3">Guruh</th>
                <th className="px-4 py-3">Dars kunlari</th>
                <th className="px-4 py-3">Oylar</th>
                <th className="px-4 py-3">Sanoq</th>
                <th className="px-4 py-3">Holat</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((r) => {
                const cells = r.months.slice(-MAX_CELLS)
                const hidden = r.months.length - cells.length
                const givenAwards = r.awards.filter((a) => a.status === 'given')
                return (
                  <tr key={r.studentId} className="align-top hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <Link
                        to={`/admin/students/${r.studentId}`}
                        className="font-medium text-slate-800 hover:text-brand-600"
                      >
                        {r.fullName}
                      </Link>
                      {r.isArchived && (
                        <Badge tone="red" className="ml-2">
                          arxivda
                        </Badge>
                      )}
                      {r.startMonth && (
                        <div className="text-xs text-slate-400">
                          {r.cycleNo}-sikl · {r.startMonth} dan
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{r.groupNames || '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{r.days || '—'}</td>
                    <td className="px-4 py-3">
                      {cells.length === 0 ? (
                        <span className="text-xs text-slate-400">—</span>
                      ) : (
                        <div className="flex flex-wrap items-start gap-1">
                          {hidden > 0 && (
                            <span className="self-center text-xs text-slate-400">+{hidden}…</span>
                          )}
                          {cells.map((m) => (
                            <div
                              key={m.month}
                              title={`${m.month} — ${STATE_UI[m.state].title}${
                                m.teacherName ? `\nO'qituvchi: ${m.teacherName}` : ''
                              }${
                                m.state === 'debt'
                                  ? `\nHisoblangan: ${formatMoney(m.charged)} · To'langan: ${formatMoney(m.paid)}`
                                  : ''
                              }`}
                              className={cn(
                                'w-14 rounded-md px-1 py-1 text-center',
                                STATE_UI[m.state].cls,
                              )}
                            >
                              <div className="text-sm leading-none">{STATE_UI[m.state].icon}</div>
                              <div className="mt-0.5 text-[10px] leading-tight opacity-70">
                                {m.month.slice(5)}
                              </div>
                              <div className="truncate text-[10px] leading-tight opacity-60">
                                {m.teacherName ? m.teacherName.split(' ')[0] : ''}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-700">
                      {r.counted}/{r.required}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_UI[r.status].tone}>{STATUS_UI[r.status].label}</Badge>
                      <div className="mt-1 max-w-[220px] text-xs text-slate-400">{r.statusNote}</div>
                      {givenAwards.map((a) => (
                        <div key={a.id} className="mt-1 text-xs text-emerald-700">
                          {a.cycleNo}-sikl: {formatMoney(a.totalAmount)}
                          {canEdit && (
                            <button
                              type="button"
                              className="ml-1 text-slate-400 hover:text-rose-600"
                              title="Bonusni bekor qilish"
                              disabled={busy === a.id}
                              onClick={() => void handleCancel(a.id, r.fullName)}
                            >
                              <Undo2 className="inline h-3 w-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canEdit && r.status === 'ready' && (
                        <Button className="whitespace-nowrap" onClick={() => setGiveFor(r)}>
                          <Award className="h-4 w-4" />
                          Bonus berish
                        </Button>
                      )}
                      {canEdit && (r.status === 'broken' || r.status === 'notstarted') && (
                        <Button
                          variant="ghost"
                          className="whitespace-nowrap"
                          disabled={busy === r.studentId}
                          onClick={() => void handleRestart(r)}
                        >
                          <RotateCcw className="h-4 w-4" />
                          {r.status === 'broken' ? 'Qayta boshlash' : 'Oyni belgilash'}
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}

      {giveFor && report && (
        <GiveRetentionBonusModal
          row={giveFor}
          defaultAmount={report.settings.defaultAmount}
          onClose={() => setGiveFor(null)}
          onSaved={() => {
            setGiveFor(null)
            load()
          }}
        />
      )}

      {settingsOpen && (
        <RetentionSettingsModal
          onClose={() => setSettingsOpen(false)}
          onSaved={() => {
            setSettingsOpen(false)
            load()
          }}
        />
      )}
    </div>
  )
}
