import { useEffect, useState, useCallback } from 'react'
import {
  Sparkles,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Lightbulb,
  UserPlus,
  UserMinus,
  Star,
  Banknote,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from 'recharts'
import {
  getCenterAiAnalysis,
  runCenterAiAnalysis,
} from '@/api/services/aiAnalysis'
import type { CenterAiRecord, CenterPoint } from '@/types'
import { useAuth } from '@/context/auth-context'
import { cn, formatMoney, formatDate } from '@/lib/utils'

export function CenterAiAnalysisCard() {
  const { user } = useAuth()
  const isSuper = user?.role === 'superadmin'
  const [rec, setRec] = useState<CenterAiRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRec(await getCenterAiAnalysis())
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function run(force: boolean) {
    setRunning(true)
    setMsg(null)
    try {
      const res = await runCenterAiAnalysis(force)
      if (!res.ok) setMsg(res.error || 'Tahlil yaratilmadi')
      else {
        setRec(res.record)
        if (res.alreadyToday)
          setMsg("Bugungi tahlil allaqachon tayyor. Qayta tahlil uchun \"Qayta\" tugmasi (superadmin).")
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Xatolik yuz berdi')
    } finally {
      setRunning(false)
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  const isToday = rec?.date === today

  return (
    <div className="card overflow-hidden p-0">
      {/* Sarlavha */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-violet-50 to-indigo-50 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 text-white shadow-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">AI Tahlil</h3>
            <p className="text-[11px] text-slate-500">
              {rec
                ? `${formatDate(rec.date)}${isToday ? ' · bugun' : ''} · ${rec.model}`
                : 'Markaz bo’yicha kunlik sun’iy intellekt tahlili'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {rec && <TrendChip trend={rec.ai.trend} health={rec.health} />}
          <button
            type="button"
            onClick={() => run(false)}
            disabled={running}
            className="btn btn-secondary btn-sm inline-flex items-center gap-1.5"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', running && 'animate-spin')} />
            {rec ? 'Yangilash' : 'Tahlil qilish'}
          </button>
          {isSuper && rec && isToday && (
            <button
              type="button"
              onClick={() => run(true)}
              disabled={running}
              className="btn btn-ghost btn-sm"
              title="Bugungi tahlilni qayta yaratish"
            >
              Qayta
            </button>
          )}
        </div>
      </div>

      <div className="p-4">
        {msg && (
          <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {msg}
          </div>
        )}

        {loading ? (
          <p className="py-8 text-center text-sm text-slate-400">Yuklanmoqda...</p>
        ) : !rec ? (
          <div className="py-8 text-center">
            <p className="text-sm text-slate-500">
              AI tahlil hali tayyorlanmagan.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Har kuni ertalab soat 8:00 da avtomatik yaratiladi yoki hozir qo'lda
              tahlil qilishingiz mumkin (Gemini kaliti sozlangan bo'lsa).
            </p>
          </div>
        ) : (
          <Body rec={rec} />
        )}
      </div>
    </div>
  )
}

function Body({ rec }: { rec: CenterAiRecord }) {
  const { ai, revenue, metrics } = rec
  const collectPct =
    revenue.expectedThisMonth > 0
      ? Math.min(100, (revenue.collectedThisMonth / revenue.expectedThisMonth) * 100)
      : 0
  const gradeDelta = metrics.avgGradeThisMonth - metrics.avgGradePrevMonth

  return (
    <div className="space-y-5">
      {/* Umumiy xulosa */}
      {ai.umumiy && (
        <p className="rounded-xl bg-slate-50 p-3.5 text-sm leading-relaxed text-slate-700">
          {ai.umumiy}
        </p>
      )}

      {/* Moliya — tushum prognozi */}
      <section>
        <SecTitle icon={Banknote} text="Tushum prognozi (joriy oy)" />
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          <Money label="Yig'ilgan tushum" value={revenue.collectedThisMonth} accent="emerald" />
          <Money label="Kutilayotgan hisob" value={revenue.expectedThisMonth} />
          <Money label="Oy oxiri prognozi" value={revenue.predictedMonthEnd} accent="violet" />
          <Money label="Jami qarzdorlik" value={revenue.outstandingDebt} accent="red" />
        </div>
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
            <span>Yig'ilish darajasi</span>
            <span className="font-mono font-medium text-slate-700">
              {Math.round(collectPct)}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${collectPct}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Kechagi tushum: {formatMoney(revenue.yesterdayIncome)}
          </p>
        </div>
        {revenue.outstandingDebt > 0 && metrics.incomeLast14Days.some((p) => p.value > 0) && (
          <div className="mt-3 h-28">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.incomeLast14Days} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  interval={1}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                  contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }}
                  formatter={(v) => [formatMoney(Number(v)), 'Tushum']}
                />
                <Bar dataKey="value" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {ai.tushumTahlili && <Note text={ai.tushumTahlili} />}
      </section>

      {/* Baholar dinamikasi */}
      <section>
        <SecTitle icon={Star} text="O'quvchilar baholari dinamikasi" />
        <div className="flex flex-wrap items-center gap-3">
          <Stat label="Shu oy o'rtacha" value={metrics.avgGradeThisMonth.toFixed(2)} />
          <Stat label="O'tgan oy" value={metrics.avgGradePrevMonth.toFixed(2)} muted />
          <DeltaChip delta={gradeDelta} />
        </div>
        {ai.baholarTahlili && <Note text={ai.baholarTahlili} />}
      </section>

      {/* Lidlar */}
      <section>
        <SecTitle icon={UserPlus} text="O'quvchilar kelishi (lidlar)" />
        <div className="flex flex-wrap items-center gap-3">
          <Stat label="Shu oy yangi" value={metrics.newLeadsThisMonth} />
          <Stat label="Kecha" value={metrics.newLeadsYesterday} />
          <Stat label="Konversiya" value={metrics.convertedThisMonth} accent="emerald" />
          <Stat label="Aktiv o'quvchilar" value={metrics.activeStudents} />
        </div>
        {metrics.leadsBySource.length > 0 && (
          <MiniBars points={metrics.leadsBySource} color="bg-violet-500" />
        )}
        {ai.lidlar && <Note text={ai.lidlar} />}
      </section>

      {/* Ketganlar */}
      <section>
        <SecTitle icon={UserMinus} text="Ketgan o'quvchilar va sabablari" />
        <div className="flex flex-wrap items-center gap-3">
          <Stat label="Shu oy ketdi" value={metrics.departedThisMonth} accent="red" />
        </div>
        {metrics.departureReasons.length > 0 ? (
          <MiniBars points={metrics.departureReasons} color="bg-red-400" />
        ) : (
          <p className="mt-2 text-xs text-slate-400">Sabablar bo'yicha ma'lumot yo'q.</p>
        )}
        {ai.ketganlar && <Note text={ai.ketganlar} />}
      </section>

      {/* Xavflar + Tavsiyalar */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {ai.xavflar.length > 0 && (
          <ListCard
            icon={AlertTriangle}
            title="E'tibor talab qiladi"
            items={ai.xavflar}
            tone="amber"
          />
        )}
        {ai.tavsiyalar.length > 0 && (
          <ListCard
            icon={Lightbulb}
            title="Tavsiyalar"
            items={ai.tavsiyalar}
            tone="emerald"
          />
        )}
      </div>
    </div>
  )
}

/* ---------- yordamchi komponentlar ---------- */

function SecTitle({ icon: Icon, text }: { icon: typeof Star; text: string }) {
  return (
    <div className="mb-2.5 flex items-center gap-2">
      <Icon className="h-4 w-4 text-slate-400" />
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {text}
      </h4>
    </div>
  )
}

function Note({ text }: { text: string }) {
  return <p className="mt-2.5 text-sm leading-relaxed text-slate-600">{text}</p>
}

const ACCENT: Record<string, string> = {
  slate: 'text-slate-800',
  emerald: 'text-emerald-600',
  red: 'text-red-600',
  violet: 'text-violet-600',
}

function Money({
  label,
  value,
  accent = 'slate',
}: {
  label: string
  value: number
  accent?: string
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-2.5">
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className={cn('mt-0.5 font-mono text-sm font-semibold', ACCENT[accent])}>
        {formatMoney(value)}
      </p>
    </div>
  )
}

function Stat({
  label,
  value,
  accent = 'slate',
  muted,
}: {
  label: string
  value: number | string
  accent?: string
  muted?: boolean
}) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-1.5">
      <span className="text-[11px] text-slate-400">{label}: </span>
      <span
        className={cn(
          'font-mono text-sm font-semibold',
          muted ? 'text-slate-400' : ACCENT[accent],
        )}
      >
        {value}
      </span>
    </div>
  )
}

function MiniBars({ points, color }: { points: CenterPoint[]; color: string }) {
  const max = Math.max(1, ...points.map((p) => p.value))
  return (
    <div className="mt-2.5 space-y-1.5">
      {points.slice(0, 6).map((p) => (
        <div key={p.label} className="flex items-center gap-2">
          <span className="w-28 shrink-0 truncate text-[11px] text-slate-500">
            {p.label}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className={cn('h-full rounded-full', color)}
              style={{ width: `${(p.value / max) * 100}%` }}
            />
          </div>
          <span className="w-6 shrink-0 text-right font-mono text-[11px] font-medium text-slate-600">
            {p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

function ListCard({
  icon: Icon,
  title,
  items,
  tone,
}: {
  icon: typeof Star
  title: string
  items: string[]
  tone: 'amber' | 'emerald'
}) {
  const ring = tone === 'amber' ? 'border-amber-100 bg-amber-50' : 'border-emerald-100 bg-emerald-50'
  const ic = tone === 'amber' ? 'text-amber-500' : 'text-emerald-500'
  return (
    <div className={cn('rounded-xl border p-3', ring)}>
      <div className="mb-2 flex items-center gap-1.5">
        <Icon className={cn('h-4 w-4', ic)} />
        <h4 className="text-xs font-semibold text-slate-700">{title}</h4>
      </div>
      <ul className="space-y-1.5">
        {items.map((t, i) => (
          <li key={i} className="flex gap-1.5 text-xs leading-relaxed text-slate-600">
            <span className={ic}>•</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function TrendChip({ trend, health }: { trend: string; health: number }) {
  const t = trend.toLowerCase()
  const up = t.includes('yaxshi')
  const down = t.includes('yomon')
  const Icon = up ? TrendingUp : down ? TrendingDown : Minus
  const cls = up
    ? 'bg-emerald-50 text-emerald-700'
    : down
      ? 'bg-red-50 text-red-700'
      : 'bg-slate-100 text-slate-600'
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium', cls)}>
      <Icon className="h-3.5 w-3.5" />
      <span className="font-mono">{health}</span>
      <span className="text-[11px] opacity-70">salomatlik</span>
    </span>
  )
}

function DeltaChip({ delta }: { delta: number }) {
  if (Math.abs(delta) < 0.01)
    return (
      <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-500">
        <Minus className="h-3 w-3" /> o'zgarmadi
      </span>
    )
  const up = delta > 0
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium',
        up ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700',
      )}
    >
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? '+' : ''}
      {delta.toFixed(2)}
    </span>
  )
}
