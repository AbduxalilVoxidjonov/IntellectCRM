import { useEffect, useState } from 'react'
import { Wallet } from 'lucide-react'
import type { MonthStatus, Student, StudentGroupMembership } from '@/types'
import { getStudentLedger, getGroupLedger } from '@/api/services/students'
import { getStudentGroups } from '@/api/services/classes'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Loader } from '@/components/ui/Loader'
import { formatMoney, cn } from '@/lib/utils'
import { formatMonth, monthStatusLabels, paymentMethods } from '@/config/constants'

interface Props {
  student: Student | null
  onClose: () => void
  onSubmit: (
    amount: number,
    month: string,
    groupId?: string,
    comment?: string,
    method?: string,
  ) => void | Promise<void>
}

/** Oy qatori (guruh yoki aggregate hisobdan normallashtirilgan) */
type Row = { month: string; remaining: number; status: MonthStatus }

/** "YYYY-MM" joriy oy */
const currentMonth = () => new Date().toISOString().slice(0, 7)

/** Oylar ro'yxatidan standart tanlov: eng eski qoldiqli oy; bo'lmasa oxirgi oy. */
const pickDefault = (rows: Row[]): { month: string; amount: number } => {
  const due = rows.find((r) => r.remaining > 0)
  const target = due ?? rows[rows.length - 1]
  return { month: target?.month ?? currentMonth(), amount: due ? due.remaining : 0 }
}

export function PaymentModal({ student, onClose, onSubmit }: Props) {
  const [amount, setAmount] = useState<number>(0)
  const [month, setMonth] = useState<string>(currentMonth())
  const [rows, setRows] = useState<Row[]>([])
  const [groups, setGroups] = useState<StudentGroupMembership[]>([])
  const [groupId, setGroupId] = useState<string>('')
  const [comment, setComment] = useState("")
  const [method, setMethod] = useState<string>('cash')
  const [loading, setLoading] = useState(false) // boshlang'ich (guruhlar) yuklash
  const [loadingMonths, setLoadingMonths] = useState(false) // tanlangan guruh oylari

  // Modal ochilganda: guruhlarni yukla. Guruh bo'lmasa — aggregate hisobni ko'rsat.
  useEffect(() => {
    if (!student) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- modal ochilganda holatni yuklash (maqsadli)
    setLoading(true)
    setRows([])
    setGroups([])
    setGroupId('')
    setComment("")
    setMethod('cash')
    setAmount(0)
    setMonth(currentMonth())
    getStudentGroups(student.id)
      .then(async (allGroups) => {
        const billable = allGroups.filter((g) => g.isActive && g.status !== 'trial')
        setGroups(billable)
        if (billable.length === 0) {
          // Guruhsiz (eski ClassName) o'quvchi — aggregate hisob.
          const ledger = await getStudentLedger(student.id)
          const r: Row[] = ledger.months.map((m) => ({
            month: m.month,
            remaining: m.remaining,
            status: m.status,
          }))
          setRows(r)
          const d = pickDefault(r)
          setMonth(d.month)
          setAmount(d.amount)
        } else if (billable.length === 1) {
          // Bitta guruh — avtomatik tanlanadi (oylar guruh effekti orqali yuklanadi).
          setGroupId(billable[0].groupId)
        }
        // Bir nechta guruh — foydalanuvchi tanlaguncha kutamiz.
      })
      .finally(() => setLoading(false))
  }, [student])

  // Guruh tanlanganda (yoki avtomatik bitta guruh) — shu guruh oylik hisobini yukla.
  useEffect(() => {
    if (!student || !groupId) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- guruh tanlanganda oylarni yuklash (maqsadli)
    setLoadingMonths(true)
    setRows([])
    getGroupLedger(student.id, groupId)
      .then((ledger) => {
        const r: Row[] = ledger.months.map((m) => ({
          month: m.month,
          remaining: m.remaining,
          status: m.status,
        }))
        setRows(r)
        const d = pickDefault(r)
        setMonth(d.month)
        setAmount(d.amount)
      })
      .finally(() => setLoadingMonths(false))
  }, [student, groupId])

  // Bir nechta guruh bo'lsa — guruh tanlanishi SHART.
  const needGroup = groups.length > 1
  // Oylarni ko'rsatish: guruhsiz (aggregate) yoki guruh tanlangan bo'lsa.
  const showMonths = groups.length === 0 || !!groupId

  const handleMonthChange = (value: string) => {
    setMonth(value)
    const r = rows.find((x) => x.month === value)
    setAmount(r && r.remaining > 0 ? r.remaining : 0)
  }

  const [submitting, setSubmitting] = useState(false)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Ikki marta bosishdan himoya (dublikat to'lov yaratilmasin).
    if (submitting || amount <= 0 || !month || (needGroup && !groupId)) return
    setSubmitting(true)
    try {
      await onSubmit(amount, month, groupId || undefined, comment.trim() || undefined, method)
    } finally {
      setSubmitting(false)
    }
  }

  const selected = rows.find((r) => r.month === month)
  const newBalance = student ? student.balance + amount : 0
  const monthOptions = rows.length > 0 ? rows.map((r) => r.month) : [currentMonth()]

  return (
    <Modal
      open={!!student}
      onClose={onClose}
      size="sm"
      title="To'lov kiritish"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button
            type="submit"
            form="payment-form"
            disabled={amount <= 0 || !month || (needGroup && !groupId) || loading || loadingMonths || submitting}
          >
            <Wallet className="h-4 w-4" /> {submitting ? 'Saqlanmoqda...' : 'Saqlash'}
          </Button>
        </>
      }
    >
      {student &&
        (loading ? (
          <Loader label="Yuklanmoqda..." />
        ) : (
          <form id="payment-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <p className="text-slate-500">{student.fullName}</p>
              <p className="mt-1 text-slate-500">
                Joriy balans:{' '}
                <span className={cn('font-mono font-semibold', student.balance < 0 ? 'text-red-600' : 'text-emerald-600')}>
                  {formatMoney(student.balance)}
                </span>
              </p>
            </div>

            {/* Qaysi guruh uchun to'lov — o'quvchi bir nechta guruhda o'qisa tanlanadi */}
            {groups.length > 0 && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600">
                  Qaysi guruh uchun
                  {needGroup && <span className="ml-1 text-red-500">*</span>}
                </label>
                {groups.length === 1 ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {groups[0].groupName}
                    {groups[0].courseName ? ` — ${groups[0].courseName}` : ''}
                  </div>
                ) : (
                  <select
                    value={groupId}
                    onChange={(e) => setGroupId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-400"
                  >
                    <option value="">— Guruhni tanlang —</option>
                    {groups.map((g) => (
                      <option key={g.groupId} value={g.groupId}>
                        {g.groupName}
                        {g.courseName ? ` — ${g.courseName}` : ''}
                        {` (${formatMoney(g.monthlyFee)})`}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Oy + summa — faqat guruh tanlangach (yoki guruhsiz aggregate) ko'rinadi */}
            {!showMonths ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                O'quvchi bir nechta guruhda o'qiydi — avval to'lov qaysi guruh uchun ekanini tanlang.
              </p>
            ) : loadingMonths ? (
              <Loader label="Oylar yuklanmoqda..." />
            ) : (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-600">Qaysi oy uchun</label>
                  <select
                    value={month}
                    onChange={(e) => handleMonthChange(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-400"
                  >
                    {monthOptions.map((mo) => {
                      const r = rows.find((x) => x.month === mo)
                      const future = mo > currentMonth()
                      const suffix = r
                        ? future
                          ? ' — kelajak oy (avans)'
                          : r.remaining > 0
                            ? ` — ${monthStatusLabels[r.status]} (qoldiq ${formatMoney(r.remaining)})`
                            : ` — ${monthStatusLabels[r.status]}`
                        : ''
                      return (
                        <option key={mo} value={mo}>
                          {formatMonth(mo)}
                          {suffix}
                        </option>
                      )
                    })}
                  </select>
                  {selected && month > currentMonth() ? (
                    <p className="mt-1 text-xs text-amber-600">
                      Kelajak oy — to'lov avans sifatida hisobga olinadi.
                    </p>
                  ) : selected && selected.remaining <= 0 ? (
                    <p className="mt-1 text-xs text-amber-600">
                      Bu oy allaqachon to'langan — to'lov avans sifatida hisobga olinadi.
                    </p>
                  ) : null}
                </div>

                <Input
                  label="To'lov summasi (so'm)"
                  type="number"
                  min={0}
                  step="any"
                  autoFocus
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                />
                {amount > 0 && (
                  <p className="text-sm text-slate-500">
                    To'lovdan keyingi balans:{' '}
                    <span className={cn('font-mono font-semibold', newBalance < 0 ? 'text-red-600' : 'text-emerald-600')}>
                      {formatMoney(newBalance)}
                    </span>
                  </p>
                )}

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-600">To'lov usuli</label>
                  <div className="grid grid-cols-3 gap-2">
                    {paymentMethods.map((m) => (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setMethod(m.value)}
                        className={cn(
                          'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                          method === m.value
                            ? 'border-brand-400 bg-brand-50 text-brand-700'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                        )}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-600">Izoh (ixtiyoriy)</label>
                  <textarea
                    rows={2}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="To'lov haqida izoh (ixtiyoriy)..."
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-400"
                  />
                </div>
              </>
            )}
          </form>
        ))}
    </Modal>
  )
}
