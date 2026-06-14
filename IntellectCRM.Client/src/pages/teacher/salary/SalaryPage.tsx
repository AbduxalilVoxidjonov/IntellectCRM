import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Wallet } from 'lucide-react'
import { getTeacherSalary } from '@/api/services/teacher'
import type { SalaryLedger } from '@/types'
import { formatMoney } from '@/lib/utils'
import { Loader } from '@/components/ui/Loader'

/**
 * O'qituvchi — Maosh. Joriy oy (hisoblandi/berildi/qoldi) + jami ko'rsatkichlar +
 * oylar ro'yxati (eng yangi tepada). Maosh rejimi: qat'iy yoki yig'ilgan to'lov foizi.
 */
const MONTH_NAMES = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
]

function monthLabel(m: string): string {
  // "YYYY-MM" → "Iyun 2026" (xato bo'lsa xom qaytadi)
  const parts = m.split('-')
  const y = parts[0]
  const mi = Number(parts[1]) - 1
  if (mi >= 0 && mi < 12 && y) return `${MONTH_NAMES[mi]} ${y}`
  return m
}

function statusChip(status: string): { label: string; cls: string } {
  switch (status) {
    case 'paid':
      return { label: "To'langan", cls: 'bg-tealsoft text-teal-700' }
    case 'partial':
      return { label: 'Qisman', cls: 'bg-amber-100 text-amber-700' }
    default:
      return { label: "To'lanmagan", cls: 'bg-rose-100 text-rose-600' }
  }
}

export function TeacherSalaryPage() {
  const nav = useNavigate()
  const [ledger, setLedger] = useState<SalaryLedger | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    getTeacherSalary()
      .then((d) => {
        if (alive) setLedger(d)
      })
      .catch(() => {
        if (alive) setLedger(null)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  // Joriy oy "YYYY-MM"
  const now = new Date()
  const curKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  return (
    <div className="px-4 pt-3 pb-6">
      {/* Sarlavha */}
      <div className="mb-4 flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => nav(-1)}
          className="tap-scale flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-mute shadow-[var(--shadow-card)]"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <p className="text-[17px] font-extrabold text-ink">Maosh</p>
      </div>

      {loading ? (
        <Loader label="Yuklanmoqda..." />
      ) : !ledger || ledger.months.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-[20px] border border-line bg-white p-8 text-center shadow-[var(--shadow-card)]">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-tealsoft text-teal-700">
            <Wallet className="h-6 w-6" />
          </div>
          <p className="text-[14px] font-semibold text-ink">Maosh ma'lumoti yo'q</p>
          <p className="text-[13px] text-mute">Hozircha hisoblangan oylik mavjud emas.</p>
        </div>
      ) : (
        <>
          {/* Umumiy karta */}
          {(() => {
            const cur = ledger.months.find((m) => m.month === curKey)
            const expected = cur ? cur.expected : ledger.totalExpected
            const paid = cur ? cur.paid : ledger.totalPaid
            const remaining = cur ? cur.remaining : ledger.remaining
            const modeSub =
              ledger.salaryMode === 'percent'
                ? `Yig'ilgan to'lovga asoslangan (${ledger.salaryPercent}%)`
                : "Qat'iy oylik"
            return (
              <div className="rounded-[20px] border border-line bg-white p-4 shadow-[var(--shadow-card)]">
                <div className="mb-3 flex items-center gap-2.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-tealsoft text-teal-700">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold text-ink">
                      {cur ? monthLabel(curKey) : 'Jami'}
                    </p>
                    <p className="truncate text-[12px] text-mute">{modeSub}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-[14px] border border-line bg-white p-2.5 text-center">
                    <p className="text-[11px] font-semibold text-faint">Hisoblandi</p>
                    <p className="mt-0.5 text-[14px] font-extrabold text-ink font-mono">
                      {formatMoney(expected)}
                    </p>
                  </div>
                  <div className="rounded-[14px] border border-line bg-white p-2.5 text-center">
                    <p className="text-[11px] font-semibold text-faint">Berildi</p>
                    <p className="mt-0.5 text-[14px] font-extrabold text-teal-700 font-mono">
                      {formatMoney(paid)}
                    </p>
                  </div>
                  <div className="rounded-[14px] border border-line bg-white p-2.5 text-center">
                    <p className="text-[11px] font-semibold text-faint">Qoldi</p>
                    <p className="mt-0.5 text-[14px] font-extrabold text-ink font-mono">
                      {formatMoney(remaining)}
                    </p>
                  </div>
                </div>

                {/* Jami (joriy oy ko'rsatilganda alohida) */}
                {cur && (
                  <div className="mt-3 flex items-center justify-between rounded-[14px] bg-tealsoft px-3.5 py-2.5">
                    <p className="text-[12px] font-semibold text-teal-700">Jami qoldiq</p>
                    <p className="text-[14px] font-extrabold text-teal-700 font-mono">
                      {formatMoney(ledger.remaining)}
                    </p>
                  </div>
                )}
              </div>
            )
          })()}

          {/* Oylar ro'yxati */}
          <p className="px-0.5 pb-2 pt-5 text-[13px] font-bold text-ink">Oylar</p>
          <div className="divide-y divide-line rounded-[20px] border border-line bg-white shadow-[var(--shadow-card)]">
            {[...ledger.months].reverse().map((m) => {
              const chip = statusChip(m.status)
              return (
                <div key={m.month} className="flex items-center gap-3 px-3.5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-bold text-ink">{monthLabel(m.month)}</p>
                    <p className="text-[12px] text-mute">
                      Hisoblandi:{' '}
                      <span className="font-mono text-ink">{formatMoney(m.expected)}</span>
                      {' · '}Berildi:{' '}
                      <span className="font-mono text-teal-700">{formatMoney(m.paid)}</span>
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${chip.cls}`}
                    >
                      {chip.label}
                    </span>
                    <p className="mt-1 text-[12px] font-semibold text-faint">
                      Qoldi: <span className="font-mono text-ink">{formatMoney(m.remaining)}</span>
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
