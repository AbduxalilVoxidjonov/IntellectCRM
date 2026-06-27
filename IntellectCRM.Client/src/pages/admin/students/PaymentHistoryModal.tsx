import { useEffect, useState } from 'react'
import { Check, Pencil, X } from 'lucide-react'
import type { MonthStatus, StudentLedger } from '@/types'
import { getStudentLedger, editStudentCharge } from '@/api/services/students'
import { useAuth } from '@/context/auth-context'
import { Modal } from '@/components/ui/Modal'
import { Loader } from '@/components/ui/Loader'
import { AuditHistoryList } from '@/components/audit/AuditHistoryList'
import { formatDate, formatMoney, cn } from '@/lib/utils'
import { formatMonth, monthStatusLabels } from '@/config/constants'

interface Props {
  studentId: string | null
  onClose: () => void
}

const statusStyles: Record<MonthStatus, string> = {
  paid: 'bg-emerald-50 text-emerald-700',
  partial: 'bg-amber-50 text-amber-700',
  unpaid: 'bg-red-50 text-red-700',
}

export function PaymentHistoryModal({ studentId, onClose }: Props) {
  const { user } = useAuth()
  const isSuper = user?.role === 'superadmin'
  const [ledger, setLedger] = useState<StudentLedger | null>(null)
  const [loading, setLoading] = useState(false)
  /** Hisoblangan summani qo'lda tahrirlash (faqat super admin) — har (oy, guruh) bo'yicha alohida.
   *  Kalit: `${month}|${groupId ?? ''}` — ko'p guruhli o'quvchida har guruh ulushi alohida tahrirlanadi. */
  const [editKey, setEditKey] = useState<string | null>(null)
  const [editVal, setEditVal] = useState('')
  const [saving, setSaving] = useState(false)

  const keyOf = (month: string, groupId?: string | null) => `${month}|${groupId ?? ''}`

  useEffect(() => {
    if (!studentId) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- modal ochilganda tarixni yuklash (maqsadli)
    setLoading(true)
    setLedger(null)
    setEditKey(null)
    getStudentLedger(studentId)
      .then(setLedger)
      .finally(() => setLoading(false))
  }, [studentId])

  const saveEdit = async (month: string, groupId?: string | null) => {
    if (!studentId) return
    const amount = Number(editVal)
    if (!Number.isFinite(amount) || amount < 0) {
      alert("Summa noto'g'ri")
      return
    }
    setSaving(true)
    try {
      // Guruhsiz (ClassName) hisob — groupId=undefined (backend null = ClassName);
      // guruhli ulush — shu guruh hisobi alohida tahrirlanadi.
      await editStudentCharge(studentId, month, amount, groupId ?? undefined)
      const fresh = await getStudentLedger(studentId)
      setLedger(fresh)
      setEditKey(null)
    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : (err as any)?.response?.data?.message ?? "Tahrirlab bo'lmadi"
      alert(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={!!studentId} onClose={onClose} size="lg" title="To'lov tarixi">
      {loading || !ledger ? (
        <Loader label="Yuklanmoqda..." />
      ) : (
        <div className="space-y-5">
          {/* Sarlavha */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
            <div>
              <p className="font-semibold text-slate-800">{ledger.student.fullName}</p>
              <p className="text-sm text-slate-500">
                {ledger.student.className} · oylik <span className="font-mono">{formatMoney(ledger.monthlyFee)}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">Joriy balans</p>
              <p
                className={cn(
                  'font-mono text-lg font-semibold',
                  ledger.balance < 0
                    ? 'text-red-600'
                    : ledger.balance > 0
                      ? 'text-emerald-600'
                      : 'text-slate-600',
                )}
              >
                {ledger.balance > 0 ? `+${formatMoney(ledger.balance)}` : formatMoney(ledger.balance)}
              </p>
            </div>
          </div>

          {/* Oylar bo'yicha holat */}
          <div>
            <p className="mb-2 text-sm font-medium text-slate-600">Oylar bo'yicha</p>
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-2.5">Oy</th>
                    <th className="px-4 py-2.5 text-right">Hisoblangan</th>
                    <th className="px-4 py-2.5 text-right">Chegirma</th>
                    <th className="px-4 py-2.5 text-right">To'langan</th>
                    <th className="px-4 py-2.5 text-right">Qoldiq</th>
                    <th className="px-4 py-2.5 text-center">Holat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ledger.months.map((m) => (
                    <tr key={m.month} className="hover:bg-slate-50/60">
                      <td className="px-4 py-2.5 align-top font-medium text-slate-700">
                        {formatMonth(m.month)}
                        {m.courses.length > 0 && (
                          <div className="mt-1 space-y-1">
                            {m.courses.map((co, i) => {
                              const k = keyOf(m.month, co.groupId)
                              const editing = isSuper && editKey === k
                              return (
                                <div
                                  key={i}
                                  className="flex items-center gap-1.5 text-xs font-normal text-slate-400"
                                >
                                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-300" />
                                  <span className="truncate text-slate-500">{co.courseName}</span>
                                  <span className="text-slate-300">·</span>
                                  {editing ? (
                                    <span className="inline-flex items-center gap-1">
                                      <input
                                        type="number"
                                        autoFocus
                                        value={editVal}
                                        disabled={saving}
                                        onChange={(e) => setEditVal(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') saveEdit(m.month, co.groupId)
                                          if (e.key === 'Escape') setEditKey(null)
                                        }}
                                        className="w-24 rounded-md border border-slate-200 px-2 py-0.5 text-right font-mono text-xs outline-none focus:border-brand-400 disabled:opacity-50"
                                      />
                                      <button
                                        type="button"
                                        title="Saqlash"
                                        disabled={saving}
                                        onClick={() => saveEdit(m.month, co.groupId)}
                                        className="rounded p-0.5 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                                      >
                                        <Check className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        title="Bekor"
                                        disabled={saving}
                                        onClick={() => setEditKey(null)}
                                        className="rounded p-0.5 text-slate-400 hover:bg-slate-100 disabled:opacity-50"
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    </span>
                                  ) : (
                                    <>
                                      <span className="font-mono text-slate-500">{formatMoney(co.fee)}</span>
                                      {isSuper && (
                                        <button
                                          type="button"
                                          title="Bu guruh hisobini tahrirlash"
                                          onClick={() => {
                                            setEditKey(k)
                                            setEditVal(String(co.fee))
                                          }}
                                          className="rounded p-0.5 text-slate-300 transition-colors hover:bg-slate-100 hover:text-brand-600"
                                        >
                                          <Pencil className="h-3 w-3" />
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right align-top font-mono text-slate-600">
                        {formatMoney(m.charged)}
                        {isSuper && m.courses.length > 1 && (
                          <p className="mt-0.5 text-[10px] font-normal text-slate-300">
                            har guruh alohida ↙
                          </p>
                        )}
                      </td>
                      <td
                        className={cn(
                          'px-4 py-2.5 text-right font-mono',
                          m.discount > 0 ? 'text-amber-600 font-medium' : 'text-slate-300',
                        )}
                      >
                        {m.discount > 0 ? `−${formatMoney(m.discount)}` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-emerald-600 font-medium">
                        {formatMoney(m.paid)}
                      </td>
                      <td
                        className={cn(
                          'px-4 py-2.5 text-right font-mono',
                          m.remaining > 0 ? 'text-red-600' : 'text-slate-400',
                        )}
                      >
                        {formatMoney(m.remaining)}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span
                          className={cn(
                            'rounded-md px-2 py-0.5 text-xs font-medium',
                            statusStyles[m.status],
                          )}
                        >
                          {monthStatusLabels[m.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700">
                  <tr>
                    <td className="px-4 py-2.5">Jami</td>
                    <td className="px-4 py-2.5 text-right font-mono">{formatMoney(ledger.totalCharged)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-amber-700">
                      {ledger.totalDiscount > 0 ? `−${formatMoney(ledger.totalDiscount)}` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-emerald-700">
                      {formatMoney(ledger.totalPaid)}
                    </td>
                    <td className="px-4 py-2.5 text-right" colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* To'lovlar tarixi (kassa yozuvlari) */}
          <div>
            <p className="mb-2 text-sm font-medium text-slate-600">Amalga oshirilgan to'lovlar</p>
            {ledger.payments.length === 0 ? (
              <p className="text-sm text-slate-400">To'lov yozuvlari yo'q</p>
            ) : (
              <ul className="space-y-1.5">
                {ledger.payments.map((p, i) => (
                  <li
                    key={i}
                    className="rounded-lg border border-slate-100 px-3 py-2 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-slate-500">
                        <span className="font-mono">{formatDate(p.date)}</span>
                        {p.month && (
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">
                            {formatMonth(p.month)} uchun
                          </span>
                        )}
                      </span>
                      <span className="font-mono font-medium text-emerald-600">+{formatMoney(p.amount)}</span>
                    </div>
                    {p.comment && <p className="mt-0.5 text-xs text-slate-500">{p.comment}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* O'zgarishlar tarixi (audit) */}
          <div>
            <p className="mb-2 text-sm font-medium text-slate-600">O'zgarishlar tarixi</p>
            <AuditHistoryList
              filters={{ studentId: ledger.student.id }}
              emptyLabel="To'lovlar bo'yicha o'zgarishlar yo'q"
            />
          </div>
        </div>
      )}
    </Modal>
  )
}
