import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Download, TrendingUp, TrendingDown, Wallet, AlertCircle, Calculator, History, Inbox, Percent, Search, Receipt } from 'lucide-react'
import type {
  FinanceDirection,
  FinanceMonthly,
  FinanceSummary,
  FinanceTransaction,
  SalaryReportRow,
} from '@/types'
import {
  getFinanceSummary,
  getFinanceMonthly,
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  accrueTuition,
  getSalaryReport,
  getCourseReport,
  type FinanceTransactionPayload,
  type CourseFinanceReport,
  type GroupFinanceRow,
} from '@/api/services/finance'
import { addPayment } from '@/api/services/students'
import { financeCategoryLabel, financeDirectionLabels, formatMonth, paymentMethodLabel } from '@/config/constants'
import { formatDate, formatTime, formatMoney, exportToCsv, cn } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { PageHeader } from '@/components/ui/PageHeader'
import { Loader } from '@/components/ui/Loader'
import { StatCard } from '@/components/ui/StatCard'
import { FinanceMonthlyChart } from '@/components/charts/FinanceMonthlyChart'
import { AuditHistoryModal } from '@/components/audit/AuditHistoryModal'
import type { AuditFilters } from '@/api/services/audit'
import { TransactionFormModal } from './TransactionFormModal'
import { TeacherSalaryDetailModal } from './TeacherSalaryDetailModal'
import { GroupPaymentsModal } from './GroupPaymentsModal'
import { DailyReportCard } from './DailyReportCard'
import { ReasonPromptModal } from '@/components/ui/ReasonPromptModal'
import { ReceiptModal } from '@/components/finance/ReceiptModal'

const todayStr = new Date().toISOString().slice(0, 10)
const yearOf = (d: string) => Number(d.slice(0, 4))

const control =
  'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-slate-700 outline-none focus:border-brand-400'

type DirFilter = 'all' | FinanceDirection
type Tab = 'overview' | 'groups' | 'teachers' | 'payments'

const tabs: { value: Tab; label: string }[] = [
  { value: 'overview', label: 'Umumiy' },
  { value: 'groups', label: 'Guruhlar' },
  { value: 'teachers', label: "O'qituvchilar" },
  { value: 'payments', label: "To'lovlar" },
]

/** Qoldiq/qarz summasini belgisiga qarab ranglash */
function balanceClass(v: number): string {
  return v > 0 ? 'text-red-600' : v < 0 ? 'text-emerald-600' : 'text-slate-400'
}

export function FinancePage() {
  const [tab, setTab] = useState<Tab>('overview')
  const [from, setFrom] = useState(`${yearOf(todayStr)}-01-01`)
  const [to, setTo] = useState(todayStr)
  const [dirFilter, setDirFilter] = useState<DirFilter>('all')

  const [summary, setSummary] = useState<FinanceSummary | null>(null)
  const [monthly, setMonthly] = useState<FinanceMonthly[]>([])
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([])
  const [salaryReport, setSalaryReport] = useState<SalaryReportRow[]>([])
  const [payments, setPayments] = useState<FinanceTransaction[]>([])
  const [paySearch, setPaySearch] = useState('')
  const [courseReport, setCourseReport] = useState<CourseFinanceReport | null>(null)
  const [loading, setLoading] = useState(true)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<FinanceTransaction | null>(null)
  const [audit, setAudit] = useState<{ filters: AuditFilters; title: string } | null>(null)
  const [detailTeacher, setDetailTeacher] = useState<SalaryReportRow | null>(null)
  const [detailGroup, setDetailGroup] = useState<GroupFinanceRow | null>(null)
  const [deleting, setDeleting] = useState<FinanceTransaction | null>(null)
  // Chek (kvitansiya): qaysi to'lovning cheki ochiq + avtomatik print (to'lov kiritilgandan keyin).
  const [receiptTx, setReceiptTx] = useState<string | null>(null)
  const [receiptAuto, setReceiptAuto] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      getFinanceSummary(from, to),
      getFinanceMonthly(yearOf(to)),
      getTransactions({ from, to, direction: dirFilter === 'all' ? undefined : dirFilter }),
      getSalaryReport(from, to),
      getTransactions({ from, to, direction: 'income', category: 'tuition' }),
      getCourseReport(from, to),
    ])
      .then(([s, m, t, sr, pay, cr]) => {
        setSummary(s)
        setMonthly(m)
        setTransactions(t)
        setSalaryReport(sr)
        setPayments(pay)
        setCourseReport(cr)
      })
      .finally(() => setLoading(false))
  }, [from, to, dirFilter])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- filtr o'zgarganda ma'lumotni qayta yuklash (maqsadli, useAsync bilan bir xil naqsh)
  useEffect(() => load(), [load])

  const handleSubmit = async (values: FinanceTransactionPayload) => {
    // Yangi o'quvchi to'lovi (kirim → o'quvchi to'lovi) — o'quvchi balansini yangilaydigan to'lov
    // mexanizmi orqali (o'quvchilar bo'limidagi to'lov kabi), oddiy xom yozuv emas.
    let newTxId: string | null = null
    if (!editing && values.direction === 'income' && values.category === 'tuition' && values.studentId) {
      newTxId = await addPayment(values.studentId, values.amount, values.month, undefined, undefined, values.method)
    } else if (editing) {
      await updateTransaction(editing.id, values)
    } else {
      const tx = await createTransaction(values)
      if (values.direction === 'income') newTxId = tx.id
    }
    setFormOpen(false)
    setEditing(null)
    load()
    // Yangi kirim (to'lov) bo'lsa — chekni avtomatik ochib, print dialogini chiqaramiz.
    if (newTxId) {
      setReceiptAuto(true)
      setReceiptTx(newTxId)
    }
  }

  /** Mavjud to'lov uchun chekni qayta ochish (avtomatik print yo'q). */
  const openReceipt = (txId: string) => {
    setReceiptAuto(false)
    setReceiptTx(txId)
  }

  const handleDelete = (t: FinanceTransaction) => setDeleting(t)

  const doDelete = (reasonId?: string) => {
    const t = deleting
    if (!t) return
    deleteTransaction(t.id, reasonId)
      .then(() => {
        setDeleting(null)
        load()
      })
      .catch((e) => alert(e?.response?.data?.message ?? "O'chirib bo'lmadi"))
  }

  const handleAccrue = async () => {
    if (!confirm("Hisoblanmagan oylik to'lovlar barcha o'quvchilarga hisoblanadimi?")) return
    const res = await accrueTuition()
    alert(
      res.count > 0
        ? `${res.months.join(', ')} uchun ${res.count} ta o'quvchiga jami ${formatMoney(res.total)} hisoblandi.`
        : "Yangi hisoblanadigan oy yo'q — hammasi hisoblangan.",
    )
    load()
  }

  const handleExport = () => {
    exportToCsv(
      'moliya.csv',
      ['Sana', "Yo'nalish", 'Toifa', "To'lov usuli", 'Izoh', 'Summa'],
      transactions.map((t) => [
        formatDate(t.date),
        financeDirectionLabels[t.direction],
        financeCategoryLabel(t.category),
        t.direction === 'income' && t.method ? paymentMethodLabel(t.method) : '',
        t.note ?? '',
        String(t.amount),
      ]),
    )
  }

  const handleExportTeachers = () => {
    exportToCsv(
      'oqituvchilar-maoshi.csv',
      ["O'qituvchi", 'Oylik', 'Jurnal ushlanmasi', "O'tkazib yuborilgan dars", 'Hisoblangan', 'Berilgan', 'Qoldiq'],
      salaryReport.map((r) => [
        r.teacherName,
        String(r.salary),
        String(r.deduction ?? 0),
        String(r.missedLessons ?? 0),
        String(r.expected),
        String(r.totalPaid),
        String(r.remaining),
      ]),
    )
  }

  // To'lovlar bo'limi: o'quvchi nomi bo'yicha qidiruv (+ guruh/izoh).
  const filteredPayments = (() => {
    const q = paySearch.trim().toLowerCase()
    if (!q) return payments
    return payments.filter(
      (p) =>
        (p.studentName ?? '').toLowerCase().includes(q) ||
        (p.groupName ?? '').toLowerCase().includes(q) ||
        (p.note ?? '').toLowerCase().includes(q),
    )
  })()

  const handleExportPayments = () => {
    exportToCsv(
      'tolovlar.csv',
      ['Sana', "O'quvchi", 'Guruh', 'Oy', "To'lov usuli", 'Summa'],
      filteredPayments.map((p) => [
        formatDate(p.date),
        p.studentName ?? '',
        p.groupName ?? '',
        p.month ?? '',
        p.method ? paymentMethodLabel(p.method) : '',
        String(p.amount),
      ]),
    )
  }

  const handleExportGroups = () => {
    if (!courseReport) return
    exportToCsv(
      'guruhlar-faollik.csv',
      ['Guruh', 'Kurs', "O'qituvchi", "O'quvchilar", 'Hisoblangan', "Yig'ilgan", "Yig'ilish %", "To'liq to'lagan", 'Billable'],
      courseReport.groups.map((g) => [
        g.groupName,
        g.courseName,
        g.teacherName,
        String(g.studentCount),
        String(g.billed),
        String(g.collected),
        String(g.collectionPct),
        String(g.fullyPaidStudents),
        String(g.billableStudents),
      ]),
    )
  }

  // Tanlangan davrning kalendar oylari (har o'qituvchining hisoblangan oyi boshlanish oyiga
  // qarab farq qilishi mumkin — bu faqat davr uzunligini ko'rsatadi).
  const periodMonths = (() => {
    const [fy, fm] = from.slice(0, 7).split('-').map(Number)
    const [ty, tm] = to.slice(0, 7).split('-').map(Number)
    return Math.max(1, (ty - fy) * 12 + (tm - fm) + 1)
  })()

  const teacherTotals = {
    expected: salaryReport.reduce((a, r) => a + r.expected, 0),
    paid: salaryReport.reduce((a, r) => a + r.totalPaid, 0),
    remaining: salaryReport.reduce((a, r) => a + Math.max(0, r.remaining), 0),
  }
  // Maosh jurnalga bog'langan bo'lsa (Guruhlar → Jurnal boshqaruvi) — "Ushlanma" ustuni ko'rsatiladi.
  const anyDeduction = salaryReport.some((r) => (r.deduction ?? 0) > 0)
  const paymentsTotal = filteredPayments.reduce((a, p) => a + p.amount, 0)

  return (
    <div>
      <PageHeader
        title="Moliya"
        sub="Markaz kirim-chiqimlari va hisobotlar"
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => setAudit({ filters: {}, title: "Moliya o'zgarishlar tarixi" })}
            >
              <History className="h-4 w-4" /> Tarix
            </Button>
            <Button variant="secondary" onClick={handleAccrue}>
              <Calculator className="h-4 w-4" /> Oylik to'lovni hisoblash
            </Button>
            <Button
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
            >
              <Plus className="h-4 w-4" /> Yangi amal
            </Button>
          </>
        }
      />

      {/* Bo'limlar (sub-tablar) */}
      <div className="subnav">
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={cn('subnav-tab', tab === t.value && 'active')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Davr tanlash (barcha bo'limlar uchun) */}
      <div className="toolbar">
        <span className="text-sm font-medium text-slate-600">Davr:</span>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={control} />
        <span className="text-slate-400">—</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={control} />
      </div>

      {loading || !summary ? (
        <Loader label="Yuklanmoqda..." />
      ) : (
        <>
          {/* ============ UMUMIY ============ */}
          {tab === 'overview' && (
            <div className="space-y-6">
              {/* Kunlik hisobot — oy kalendar qatori, kun bosilsa shu kunlik kirim/chiqim */}
              <DailyReportCard initialMonth={to.slice(0, 7)} />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label="Umumiy kirim"
                  value={formatMoney(summary.totalIncome)}
                  icon={TrendingUp}
                  iconBg="bg-emerald-50"
                  iconColor="text-emerald-600"
                  hint={`O'quvchi to'lovi: ${formatMoney(summary.tuitionIncome)}`}
                />
                <StatCard
                  label="Umumiy chiqim"
                  value={formatMoney(summary.totalExpense)}
                  icon={TrendingDown}
                  iconBg="bg-red-50"
                  iconColor="text-red-600"
                />
                <StatCard
                  label="Sof balans"
                  value={formatMoney(summary.net)}
                  icon={Wallet}
                  iconBg={summary.net >= 0 ? 'bg-emerald-50' : 'bg-red-50'}
                  iconColor={summary.net >= 0 ? 'text-emerald-600' : 'text-red-600'}
                  hint="Kirim − Chiqim"
                />
                <StatCard
                  label="O'quvchilar qarzi"
                  value={formatMoney(summary.studentDebt)}
                  icon={AlertCircle}
                  iconBg="bg-amber-50"
                  iconColor="text-amber-600"
                  hint={`Avans: ${formatMoney(summary.studentAdvance)}`}
                />
              </div>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <Card
                  className="xl:col-span-2"
                  title={`Oylik kirim/chiqim (${yearOf(to)})`}
                >
                  <FinanceMonthlyChart data={monthly} />
                </Card>

                <Card title="Toifalar bo'yicha">
                  <CategoryList title="Kirim" items={summary.incomeByCategory} positive />
                  <div className="my-3 border-t border-slate-100" />
                  <CategoryList title="Chiqim" items={summary.expenseByCategory} positive={false} />
                </Card>
              </div>

              {/* Amallar jadvali */}
              <Card
                tight
                title="Amallar"
                actions={
                  <>
                    <div className="toolbar !mb-0">
                      {(['all', 'income', 'expense'] as DirFilter[]).map((d) => (
                        <button
                          key={d}
                          onClick={() => setDirFilter(d)}
                          className={cn('filter-chip', dirFilter === d && 'active')}
                        >
                          {d === 'all' ? 'Barchasi' : financeDirectionLabels[d]}
                        </button>
                      ))}
                    </div>
                    <Button variant="secondary" onClick={handleExport} disabled={transactions.length === 0}>
                      <Download className="h-4 w-4" /> CSV
                    </Button>
                  </>
                }
              >
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Sana</th>
                        <th>Yo'nalish</th>
                        <th>Toifa</th>
                        <th>To'lov usuli</th>
                        <th>Izoh</th>
                        <th className="num">Summa</th>
                        <th className="num">Amallar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((t) => (
                        <tr key={t.id}>
                          <td className="font-mono text-[12.5px] text-slate-500">
                            {formatDate(t.date)}
                            {t.createdAt && formatTime(t.createdAt) && (
                              <span className="ml-1 text-slate-400">{formatTime(t.createdAt)}</span>
                            )}
                          </td>
                          <td>
                            <Badge tone={t.direction === 'income' ? 'green' : 'red'}>
                              {financeDirectionLabels[t.direction]}
                            </Badge>
                          </td>
                          <td className="text-slate-600">{financeCategoryLabel(t.category)}</td>
                          <td>
                            {t.direction === 'income' && t.method ? (
                              <Badge tone="blue">{paymentMethodLabel(t.method)}</Badge>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="text-slate-500">{t.note ?? '—'}</td>
                          <td
                            className={cn(
                              'num font-semibold',
                              t.direction === 'income' ? 'text-emerald-600' : 'text-red-600',
                            )}
                          >
                            {t.direction === 'income' ? '+' : '−'}
                            {formatMoney(t.amount)}
                          </td>
                          <td className="num">
                            <div className="flex items-center justify-end gap-0.5">
                              {t.direction === 'income' && (
                                <button
                                  type="button"
                                  title="Chek (kvitansiya)"
                                  onClick={() => openReceipt(t.id)}
                                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-brand-50 hover:text-brand-600"
                                >
                                  <Receipt className="h-4 w-4" />
                                </button>
                              )}
                              <button
                                type="button"
                                title="O'zgarishlar tarixi"
                                onClick={() =>
                                  setAudit({
                                    filters: { entityType: 'FinanceTransaction', entityId: t.id },
                                    title: 'Amal tarixi',
                                  })
                                }
                                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                              >
                                <History className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                title="Tahrirlash"
                                onClick={() => {
                                  setEditing(t)
                                  setFormOpen(true)
                                }}
                                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                title="O'chirish"
                                onClick={() => handleDelete(t)}
                                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {transactions.length === 0 && (
                  <div className="state">
                    <div className="state-icon">
                      <Inbox className="h-5 w-5" />
                    </div>
                    <h4>Bu davrda amallar yo'q</h4>
                    <p>Tanlangan davr yoki filtr bo'yicha moliyaviy amal topilmadi.</p>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ============ GURUHLAR (faollik + to'lov holati) ============ */}
          {tab === 'groups' && courseReport && (
            <GroupsReport report={courseReport} onExport={handleExportGroups} onSelect={setDetailGroup} />
          )}

          {/* ============ O'QITUVCHILAR ============ */}
          {tab === 'teachers' && (
            <div className="space-y-6">
              {salaryReport.length > 0 && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <StatCard
                    label="Jami hisoblangan"
                    value={formatMoney(teacherTotals.expected)}
                    icon={Calculator}
                  />
                  <StatCard
                    label="Jami berilgan"
                    value={formatMoney(teacherTotals.paid)}
                    icon={Wallet}
                    iconBg="bg-emerald-50"
                    iconColor="text-emerald-600"
                  />
                  <StatCard
                    label="Jami qoldiq"
                    value={formatMoney(teacherTotals.remaining)}
                    icon={AlertCircle}
                    iconBg="bg-red-50"
                    iconColor="text-red-600"
                  />
                </div>
              )}
              <Card
                tight
                title="O'qituvchilar maoshi"
                sub={`Davr bo'yicha — ${periodMonths} oy · batafsil uchun o'qituvchini bosing`}
                actions={
                  <Button variant="secondary" onClick={handleExportTeachers} disabled={salaryReport.length === 0}>
                    <Download className="h-4 w-4" /> CSV
                  </Button>
                }
              >
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>O'qituvchi</th>
                        <th className="num">Oylik</th>
                        {anyDeduction && <th className="num">Ushlanma</th>}
                        <th className="num">Hisoblangan</th>
                        <th className="num">Berilgan</th>
                        <th className="num">Qoldiq</th>
                        <th className="num">Tarix</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salaryReport.map((r) => (
                        <tr
                          key={r.teacherId}
                          onClick={() => setDetailTeacher(r)}
                          className="cursor-pointer"
                        >
                          <td className="font-medium text-brand-700">{r.teacherName}</td>
                          <td className="num text-slate-600">
                            {r.salaryMode === 'percent'
                              ? `${r.salaryPercent ?? 0}% (guruh to'lovidan)`
                              : formatMoney(r.salary)}
                          </td>
                          {anyDeduction && (
                            <td className="num" title="Jurnalda belgilanmagan darslar uchun ushlanma">
                              {(r.deduction ?? 0) > 0 ? (
                                <span className="text-red-600">
                                  −{formatMoney(r.deduction ?? 0)}
                                  <span className="ml-1 text-xs text-slate-400">
                                    ({r.missedLessons ?? 0} dars)
                                  </span>
                                </span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          )}
                          <td className="num text-slate-600">{formatMoney(r.expected)}</td>
                          <td className="num font-semibold text-emerald-600">
                            {formatMoney(r.totalPaid)}
                          </td>
                          <td className={cn('num font-semibold', balanceClass(r.remaining))}>
                            {r.remaining < 0 ? `+${formatMoney(-r.remaining)}` : formatMoney(r.remaining)}
                          </td>
                          <td className="num">
                            <button
                              type="button"
                              title="O'zgarishlar tarixi"
                              onClick={(e) => {
                                e.stopPropagation()
                                setAudit({ filters: { teacherId: r.teacherId }, title: `Tarix — ${r.teacherName}` })
                              }}
                              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                            >
                              <History className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {salaryReport.length === 0 && (
                  <div className="state">
                    <div className="state-icon">
                      <Inbox className="h-5 w-5" />
                    </div>
                    <h4>Ma'lumot yo'q</h4>
                    <p>Tanlangan davr bo'yicha maosh hisoboti topilmadi.</p>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ============ TO'LOVLAR (kiritilgan to'lovlar ro'yxati) ============ */}
          {tab === 'payments' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <StatCard label="To'lovlar soni" value={String(filteredPayments.length)} icon={Wallet} />
                <StatCard
                  label="Jami summa"
                  value={formatMoney(paymentsTotal)}
                  icon={TrendingUp}
                  iconBg="bg-emerald-50"
                  iconColor="text-emerald-600"
                />
              </div>
              <Card
                tight
                title="Kiritilgan to'lovlar"
                sub="O'quvchi to'lovlari (tuition) — xato bo'lsa o'chiring, balans qayta tiklanadi"
                actions={
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="O'quvchi / guruh qidirish..."
                        value={paySearch}
                        onChange={(e) => setPaySearch(e.target.value)}
                        className="w-56 rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm text-slate-700 outline-none focus:border-brand-400"
                      />
                    </div>
                    <Button variant="secondary" onClick={handleExportPayments} disabled={filteredPayments.length === 0}>
                      <Download className="h-4 w-4" /> CSV
                    </Button>
                  </div>
                }
              >
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Sana</th>
                        <th>O'quvchi</th>
                        <th>Guruh</th>
                        <th>Oy</th>
                        <th>To'lov usuli</th>
                        <th className="num">Summa</th>
                        <th className="num">Amallar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPayments.map((p) => (
                        <tr key={p.id}>
                          <td className="font-mono text-[12.5px] text-slate-500">
                            {formatDate(p.date)}
                            {p.createdAt && formatTime(p.createdAt) && (
                              <span className="ml-1 text-slate-400">{formatTime(p.createdAt)}</span>
                            )}
                          </td>
                          <td className="font-medium text-slate-800">{p.studentName ?? '—'}</td>
                          <td>{p.groupName ? <Badge>{p.groupName}</Badge> : <span className="text-slate-300">—</span>}</td>
                          <td className="text-slate-600">{p.month ? formatMonth(p.month) : '—'}</td>
                          <td>
                            {p.method ? (
                              <Badge tone="blue">{paymentMethodLabel(p.method)}</Badge>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="num font-semibold text-emerald-600">+{formatMoney(p.amount)}</td>
                          <td className="num">
                            <div className="flex items-center justify-end gap-0.5">
                              <button
                                type="button"
                                title="Chek (kvitansiya)"
                                onClick={() => openReceipt(p.id)}
                                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-brand-50 hover:text-brand-600"
                              >
                                <Receipt className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                title="O'zgarishlar tarixi"
                                onClick={() =>
                                  setAudit({
                                    filters: { entityType: 'FinanceTransaction', entityId: p.id },
                                    title: "To'lov tarixi",
                                  })
                                }
                                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                              >
                                <History className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                title="O'chirish (balans tiklanadi)"
                                onClick={() => handleDelete(p)}
                                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {filteredPayments.length === 0 && (
                  <div className="state">
                    <div className="state-icon">
                      <Inbox className="h-5 w-5" />
                    </div>
                    <h4>To'lov yo'q</h4>
                    <p>{paySearch ? 'Qidiruv bo\'yicha to\'lov topilmadi.' : 'Tanlangan davrda kiritilgan to\'lov yo\'q.'}</p>
                  </div>
                )}
              </Card>
            </div>
          )}
        </>
      )}

      <TransactionFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
        onSubmit={handleSubmit}
        initial={editing}
      />

      <AuditHistoryModal
        open={!!audit}
        onClose={() => setAudit(null)}
        title={audit?.title}
        filters={audit?.filters ?? {}}
      />

      <TeacherSalaryDetailModal
        teacher={detailTeacher}
        from={from}
        to={to}
        onClose={() => setDetailTeacher(null)}
      />

      <GroupPaymentsModal
        groupId={detailGroup?.groupId ?? null}
        groupName={detailGroup?.groupName ?? ''}
        from={from}
        to={to}
        onClose={() => setDetailGroup(null)}
      />

      <ReasonPromptModal
        open={!!deleting}
        category="finance_delete"
        title="Tranzaksiyani o'chirish"
        message={deleting ? "Ushbu moliyaviy amalni o'chirasizmi?" : undefined}
        confirmLabel="O'chirish"
        tone="red"
        onConfirm={doDelete}
        onClose={() => setDeleting(null)}
      />

      <ReceiptModal
        txId={receiptTx}
        autoPrint={receiptAuto}
        onClose={() => {
          setReceiptTx(null)
          setReceiptAuto(false)
        }}
      />
    </div>
  )
}

/** Yig'ilish foizini ranglash (90%+ yashil, 60%+ sariq, past qizil). */
function pctClass(p: number): string {
  return p >= 90 ? 'text-emerald-600' : p >= 60 ? 'text-amber-600' : 'text-red-600'
}
function pctBar(p: number): string {
  return p >= 90 ? 'bg-emerald-500' : p >= 60 ? 'bg-amber-500' : 'bg-red-500'
}

/** Guruhlar kesimida moliyaviy hisobot: faollik + bosilganda guruh ichidagi to'lov holati. */
function GroupsReport({
  report,
  onExport,
  onSelect,
}: {
  report: CourseFinanceReport
  onExport: () => void
  onSelect: (g: GroupFinanceRow) => void
}) {
  const [teacherId, setTeacherId] = useState<string>('')

  // O'qituvchi filtri uchun noyob ro'yxat (guruhlardan).
  const teachers = (() => {
    const map = new Map<string, string>()
    report.groups.forEach((g) => {
      if (g.teacherId) map.set(g.teacherId, g.teacherName)
    })
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  })()

  const groups = teacherId ? report.groups.filter((g) => g.teacherId === teacherId) : report.groups

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Jami yig'ilgan (davr)"
          value={formatMoney(report.totalCollected)}
          icon={Wallet}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          hint="Tanlangan davrdagi tuition to'lovlari"
        />
        <StatCard
          label="Jami hisoblangan"
          value={formatMoney(report.totalBilled)}
          icon={Calculator}
          hint="Davr uchun hisoblangan oyliklar"
        />
        <StatCard
          label="Yig'ilish foizi"
          value={`${report.collectionPct}%`}
          icon={Percent}
          iconBg={report.collectionPct >= 90 ? 'bg-emerald-50' : 'bg-amber-50'}
          iconColor={report.collectionPct >= 90 ? 'text-emerald-600' : 'text-amber-600'}
          hint="Yig'ilgan ÷ hisoblangan"
        />
      </div>

      {/* Guruhlar — faollik (qaysi o'qituvchi guruhi ko'proq yig'di). Guruhni bosing — to'lov holati. */}
      <Card
        tight
        title="Guruhlar bo'yicha faollik"
        sub="Guruhni bosing — kim to'ladi, kim to'lamadi"
        actions={
          <div className="flex items-center gap-2">
            <select
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-400"
            >
              <option value="">Barcha o'qituvchilar</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <Button variant="secondary" onClick={onExport} disabled={report.groups.length === 0}>
              <Download className="h-4 w-4" /> CSV
            </Button>
          </div>
        }
      >
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Guruh</th>
                <th>Kurs</th>
                <th>O'qituvchi</th>
                <th className="num">O'quvchi</th>
                <th className="num">Hisoblangan</th>
                <th className="num">Yig'ilgan</th>
                <th className="num">Yig'ilish</th>
                <th className="num">To'liq to'lagan</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.groupId} onClick={() => onSelect(g)} className="cursor-pointer">
                  <td className="font-medium text-brand-700">{g.groupName}</td>
                  <td>
                    <Badge>{g.courseName}</Badge>
                  </td>
                  <td className="text-slate-600">{g.teacherName}</td>
                  <td className="num text-slate-600">{g.studentCount}</td>
                  <td className="num text-slate-600">{formatMoney(g.billed)}</td>
                  <td className="num font-semibold text-emerald-600">{formatMoney(g.collected)}</td>
                  <td className="num">
                    <div className="flex items-center justify-end gap-2">
                      <div className="h-1.5 w-12 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={cn('h-full rounded-full', pctBar(g.collectionPct))}
                          style={{ width: `${Math.min(100, g.collectionPct)}%` }}
                        />
                      </div>
                      <span className={cn('font-mono font-semibold', pctClass(g.collectionPct))}>
                        {g.collectionPct}%
                      </span>
                    </div>
                  </td>
                  <td className="num font-mono text-slate-700">
                    {g.fullyPaidStudents}/{g.billableStudents}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {groups.length === 0 && (
          <div className="state">
            <div className="state-icon">
              <Inbox className="h-5 w-5" />
            </div>
            <h4>Ma'lumot yo'q</h4>
            <p>Tanlangan davr/o'qituvchi bo'yicha guruh faolligi topilmadi.</p>
          </div>
        )}
      </Card>
    </div>
  )
}

function CategoryList({
  title,
  items,
  positive,
}: {
  title: string
  items: { category: string; amount: number }[]
  positive: boolean
}) {
  const total = items.reduce((a, c) => a + c.amount, 0)
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">Ma'lumot yo'q</p>
      ) : (
        <ul className="space-y-2">
          {items.map((c) => (
            <li key={c.category} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-slate-600">{financeCategoryLabel(c.category)}</span>
              <span className={cn('font-mono font-semibold', positive ? 'text-emerald-600' : 'text-red-600')}>
                {formatMoney(c.amount)}
              </span>
            </li>
          ))}
          <li className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2 text-sm font-semibold">
            <span className="text-slate-700">Jami</span>
            <span className={cn('font-mono', positive ? 'text-emerald-700' : 'text-red-700')}>
              {formatMoney(total)}
            </span>
          </li>
        </ul>
      )}
    </div>
  )
}
