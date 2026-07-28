import { useEffect, useState } from 'react'
import { ReceiptText, Printer, Loader2 } from 'lucide-react'
import { getMyKassaPayments, type CashierPayments } from '@/api/services/kassa'
import { ReceiptModal } from '@/components/finance/ReceiptModal'
import { formatMoney, formatDate, cn } from '@/lib/utils'
import { paymentMethodLabel, formatMonth } from '@/config/constants'

/** Davr tanlovi — kassirga eng kerakli uchtasi. */
type Period = 'today' | 'week' | 'month'

const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Bugun' },
  { key: 'week', label: '7 kun' },
  { key: 'month', label: 'Shu oy' },
]

const iso = (d: Date) => d.toISOString().slice(0, 10)

/** Tanlangan davr uchun (from, to) — "yyyy-MM-dd". */
function range(p: Period): { from: string; to: string } {
  const now = new Date()
  const to = iso(now)
  if (p === 'today') return { from: to, to }
  if (p === 'week') {
    const d = new Date(now)
    d.setDate(d.getDate() - 6) // bugun ham kiradi → 7 kun
    return { from: iso(d), to }
  }
  return { from: `${to.slice(0, 7)}-01`, to }
}

/**
 * "To'lovlarim" — kassir O'ZI kiritgan to'lovlar va jami (davr bo'yicha). Server faqat token
 * egasining yozuvlarini qaytaradi, ya'ni boshqa kassirning ro'yxatini ko'rib bo'lmaydi.
 * Qatorni bosib chekni qayta chiqarish mumkin.
 */
export function KassaMyPaymentsPage() {
  const [period, setPeriod] = useState<Period>('today')
  const [data, setData] = useState<CashierPayments | null>(null)
  const [loading, setLoading] = useState(true)
  const [receiptTx, setReceiptTx] = useState<string | null>(null)

  useEffect(() => {
    const { from, to } = range(period)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- davr o'zgarganda yuklash (maqsadli)
    setLoading(true)
    let alive = true
    getMyKassaPayments(from, to)
      .then((d) => alive && setData(d))
      .catch(() => alive && setData(null))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [period])

  const s = data?.summary

  return (
    <div className="space-y-3">
      {/* Davr */}
      <div className="flex gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPeriod(p.key)}
            className={cn(
              'flex-1 rounded-xl px-3 py-2 text-[13px] font-semibold transition',
              period === p.key ? 'bg-brand-600 text-white shadow-sm' : 'bg-white text-slate-600 ring-1 ring-slate-200',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Jami */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-[12px] font-medium text-slate-400">Qabul qilingan (jami)</p>
        <p className="mt-0.5 font-mono text-2xl font-bold text-emerald-600">
          {loading ? '...' : formatMoney(s?.total ?? 0)}
        </p>
        <p className="mt-0.5 text-[12px] text-slate-400">{s?.count ?? 0} ta to'lov</p>
        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center">
          {[
            { label: 'Naqd', value: s?.cash ?? 0 },
            { label: 'Karta', value: s?.card ?? 0 },
            { label: 'Bank', value: s?.bank ?? 0 },
          ].map((x) => (
            <div key={x.label}>
              <p className="text-[11px] text-slate-400">{x.label}</p>
              <p className="font-mono text-[13px] font-semibold text-slate-700">{formatMoney(x.value)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Ro'yxat */}
      <h2 className="flex items-center gap-2 px-1 text-[13px] font-semibold text-slate-500">
        <ReceiptText className="h-4 w-4" /> To'lovlar
      </h2>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <p className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Yuklanmoqda...
          </p>
        ) : !data || data.payments.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">Bu davrda to'lov kiritilmagan.</p>
        ) : (
          data.payments.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setReceiptTx(p.id)}
              className="flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2.5 text-left last:border-0 active:bg-slate-50"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-slate-800">{p.studentName || '—'}</p>
                <p className="truncate text-[12px] text-slate-400">
                  {[p.groupName, p.courseName].filter(Boolean).join(' · ') || 'Guruhsiz'}
                </p>
                <p className="truncate text-[11px] text-slate-400">
                  {formatDate(p.date)}
                  {p.month ? ` · ${formatMonth(p.month)} uchun` : ''}
                  {` · ${paymentMethodLabel(p.method)}`}
                  {p.receiptNo ? ` · ${p.receiptNo}` : p.cardLast4 ? ` · •••• ${p.cardLast4}` : ''}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono text-[14px] font-bold text-emerald-600">{formatMoney(p.amount)}</p>
                <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-slate-400">
                  <Printer className="h-3 w-3" /> chek
                </span>
              </div>
            </button>
          ))
        )}
      </div>

      <ReceiptModal txId={receiptTx} onClose={() => setReceiptTx(null)} />
    </div>
  )
}
