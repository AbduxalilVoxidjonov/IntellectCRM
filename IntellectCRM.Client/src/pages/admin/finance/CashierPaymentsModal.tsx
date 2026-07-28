import { useEffect, useState } from 'react'
import { getCashierPayments } from '@/api/services/finance'
import type { CashierPayments, CashierSummary } from '@/api/services/kassa'
import { Modal } from '@/components/ui/Modal'
import { Loader } from '@/components/ui/Loader'
import { formatMoney, formatDate } from '@/lib/utils'
import { paymentMethodLabel, formatMonth } from '@/config/constants'

/**
 * Bitta KASSIR kiritgan to'lovlar (davr bo'yicha) — Moliya → "Kassirlar" jadvalidagi qatorni
 * bosganda ochiladi. Kim, qachon, qaysi o'quvchidan qancha qabul qilgani ko'rinadi.
 */
export function CashierPaymentsModal({
  target,
  from,
  to,
  onClose,
}: {
  target: CashierSummary | null
  from: string
  to: string
  onClose: () => void
}) {
  const [data, setData] = useState<CashierPayments | null>(null)
  const [loading, setLoading] = useState(false)
  const key = target?.key

  useEffect(() => {
    if (!target) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- modal ochilganda yuklash (maqsadli)
    setLoading(true)
    setData(null)
    let alive = true
    getCashierPayments(from, to, target.cashierId, target.cashierName)
      .then((d) => alive && setData(d))
      .catch(() => alive && setData(null))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
    // `key` — kassir almashganda qayta yuklash uchun (target obyekti har renderda yangi bo'lmasin).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, from, to])

  return (
    <Modal
      open={!!target}
      onClose={onClose}
      size="lg"
      title={target ? `${target.cashierName} — qabul qilgan to'lovlari` : ''}
    >
      {loading || !data ? (
        <Loader label="Yuklanmoqda..." />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Jami', value: formatMoney(data.summary.total) },
              { label: 'Naqd', value: formatMoney(data.summary.cash) },
              { label: 'Karta', value: formatMoney(data.summary.card) },
              { label: 'Bank', value: formatMoney(data.summary.bank) },
            ].map((x) => (
              <div key={x.label} className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-[11px] text-slate-400">{x.label}</p>
                <p className="font-mono text-[13px] font-semibold text-slate-700">{x.value}</p>
              </div>
            ))}
          </div>

          {data.payments.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">Bu davrda to'lov yo'q.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Sana</th>
                    <th>O'quvchi</th>
                    <th>Guruh</th>
                    <th>Oy</th>
                    <th>Usul</th>
                    <th>Kvitansiya</th>
                    <th className="num">Summa</th>
                  </tr>
                </thead>
                <tbody>
                  {data.payments.map((p) => (
                    <tr key={p.id}>
                      <td className="font-mono text-[12.5px] text-slate-500">
                        {formatDate(p.date)}
                        {p.paidTime && <span className="ml-1 text-slate-400">{p.paidTime}</span>}
                      </td>
                      <td className="font-medium text-slate-700">{p.studentName || '—'}</td>
                      <td className="text-slate-600">
                        {p.groupName || '—'}
                        {p.teacherName ? ` · ${p.teacherName}` : ''}
                      </td>
                      <td className="text-slate-500">{p.month ? formatMonth(p.month) : '—'}</td>
                      <td className="text-slate-500">{paymentMethodLabel(p.method)}</td>
                      <td className="font-mono text-[12.5px] text-slate-500">
                        {p.receiptNo ? p.receiptNo : p.cardLast4 ? `•••• ${p.cardLast4}` : '—'}
                      </td>
                      <td className="num font-mono font-semibold text-emerald-600">{formatMoney(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
