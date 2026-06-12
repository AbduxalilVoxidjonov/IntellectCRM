import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { StudentViewModal } from './StudentViewModal'
import { Plus, Search, Pencil, Trash2, Send, Download, X, Wallet, History, Archive, RotateCcw, FileDown, Upload } from 'lucide-react'
import type { Gender, Student } from '@/types'
import type { StudentPayload, StudentImportResult } from '@/api/services/students'
import {
  getStudents,
  getArchivedStudents,
  archiveStudent,
  restoreStudent,
  createStudent,
  updateStudent,
  deleteStudent,
  addPayment,
  downloadStudentCredentials,
  downloadStudentImportTemplate,
  importStudents,
} from '@/api/services/students'
import { getClasses } from '@/api/services/classes'
import { genderLabels } from '@/config/constants'
import { formatDate, formatMoney, exportToCsv, cn } from '@/lib/utils'
import { useAuth } from '@/context/auth-context'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Loader } from '@/components/ui/Loader'
import { Modal } from '@/components/ui/Modal'
import { StudentFormModal } from './StudentFormModal'
import { SmsModal } from './SmsModal'
import { PaymentModal } from './PaymentModal'
import { PaymentHistoryModal } from './PaymentHistoryModal'

type BalanceFilter = 'all' | 'debt' | 'paid'
type Tab = 'active' | 'archived'

/** Filtr select'lari uchun yagona ko'rinish (toolbar ichida). */
const control =
  'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-100'

/** Ism bo'yicha barqaror avatar rangi (crm/ namunasidagi kabi). */
const AVATAR_COLORS = [
  '#7c3aed', '#2563eb', '#0891b2', '#16a34a', '#ca8a04', '#dc2626', '#db2777', '#9333ea',
]
function avatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}
function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}

export function StudentsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('active')
  const [students, setStudents] = useState<Student[]>([])
  const [archived, setArchived] = useState<Student[]>([])
  const [classNames, setClassNames] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  /** Arxivlash modali — sabab kiritish uchun. */
  const [archiveTarget, setArchiveTarget] = useState<Student | null>(null)
  const [archiveReason, setArchiveReason] = useState('')

  // filtrlar
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState('all')
  const [genderFilter, setGenderFilter] = useState<'all' | Gender>('all')
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>('all')

  // tanlash
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // modallar
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Student | null>(null)
  // Yangi o'quvchi yaratilgach login/parolni ko'rsatish uchun (Eye tugmasi esa shaxsiy daftarga boradi).
  const [viewing, setViewing] = useState<Student | null>(null)
  const openNotebook = (s: Student) => navigate(`/admin/students/${s.id}`)
  const [smsOpen, setSmsOpen] = useState(false)
  const [paying, setPaying] = useState<Student | null>(null)
  const [historyOf, setHistoryOf] = useState<Student | null>(null)

  // Excel'dan ommaviy import
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<StudentImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // bir xil faylni qayta tanlash mumkin bo'lsin
    if (!file) return
    setImporting(true)
    try {
      const result = await importStudents(file)
      setImportResult(result)
      if (result.created > 0) setStudents(await getStudents())
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      alert('Yuklashda xatolik: ' + (msg ?? 'fayl noto\'g\'ri yoki server xatosi'))
    } finally {
      setImporting(false)
    }
  }

  // Chegirma o'zgarganda — yangi chegirmani joriy oyga qo'llashni so'rash
  const [discountPrompt, setDiscountPrompt] = useState<{
    id: string
    values: StudentPayload
    oldPct: number
    oldAmount: number
    newPct: number
    newAmount: number
  } | null>(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([getStudents(), getArchivedStudents()])
      .then(([active, arch]) => {
        setStudents(active)
        setArchived(arch)
      })
      .finally(() => setLoading(false))
    getClasses().then((cs) => setClassNames(cs.map((c) => c.name)))
  }, [])

  // Joriy tab manbai.
  const source = tab === 'active' ? students : archived

  const filtered = source.filter((s) => {
    const q = search.trim().toLowerCase()
    const matchSearch =
      !q ||
      s.fullName.toLowerCase().includes(q) ||
      s.parentFullName.toLowerCase().includes(q)
    const matchClass =
      classFilter === 'all' ||
      s.className === classFilter ||
      (s.groups ?? []).includes(classFilter)
    const matchGender = genderFilter === 'all' || s.gender === genderFilter
    const matchBalance =
      balanceFilter === 'all' ||
      (balanceFilter === 'debt' ? s.balance < 0 : s.balance >= 0)
    return matchSearch && matchClass && matchGender && matchBalance
  })

  const selectedStudents = source.filter((s) => selected.has(s.id))

  // hammasini tanlash holati
  const allSelected = filtered.length > 0 && filtered.every((s) => selected.has(s.id))
  const someSelected = filtered.some((s) => selected.has(s.id)) && !allSelected
  const headerCbRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (headerCbRef.current) headerCbRef.current.indeterminate = someSelected
  })

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (allSelected) filtered.forEach((s) => next.delete(s.id))
      else filtered.forEach((s) => next.add(s.id))
      return next
    })

  const clearSelection = () => setSelected(new Set())

  const handleExport = () => {
    exportToCsv(
      'oquvchilar.csv',
      ['F.I.SH', 'Guruh', 'Jinsi', "Tug'ilgan kun", 'Manzil', 'Ota-ona', 'Telefon', 'Balans', 'Chegirma'],
      selectedStudents.map((s) => [
        s.fullName,
        s.groups && s.groups.length > 0 ? s.groups.join(', ') : s.className,
        genderLabels[s.gender],
        formatDate(s.birthDate),
        s.address,
        s.parentFullName,
        s.parentPhone,
        formatMoney(s.balance),
        s.discountPct > 0 || s.discountAmount > 0
          ? [
              s.discountPct > 0 ? `${s.discountPct}%` : null,
              s.discountAmount > 0 ? formatMoney(s.discountAmount) : null,
            ]
              .filter(Boolean)
              .join(' + ') + (s.discountNote ? ` — ${s.discountNote}` : '')
          : '',
      ]),
    )
  }

  const applyUpdate = (id: string, values: StudentPayload, applyDiscount: boolean) => {
    updateStudent(id, values, applyDiscount)
    // balansni saqlab qolib, qolgan maydonlarni yangilaymiz
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, ...values } : s)))
  }

  const resolveDiscountPrompt = (applyDiscount: boolean) => {
    if (!discountPrompt) return
    applyUpdate(discountPrompt.id, discountPrompt.values, applyDiscount)
    setDiscountPrompt(null)
  }

  const handleFormSubmit = (values: StudentPayload) => {
    if (editing) {
      const id = editing.id
      const newPct = values.discountPct ?? 0
      const newAmount = values.discountAmount ?? 0
      const oldPct = editing.discountPct
      const oldAmount = editing.discountAmount
      const discountChanged = newPct !== oldPct || newAmount !== oldAmount
      if (discountChanged) {
        // "Ha/Yo'q" tasdiq dialog'i — joriy oyga qo'llash yoki keyingi oydan?
        setDiscountPrompt({ id, values, oldPct, oldAmount, newPct, newAmount })
      } else {
        applyUpdate(id, values, false)
      }
    } else {
      createStudent(values).then((created) => {
        setStudents((prev) => [created, ...prev])
        // Yangi o'quvchining login/parolini darrov ko'rsatamiz.
        setViewing(created)
      })
    }
    setFormOpen(false)
    setEditing(null)
  }

  const handlePayment = (amount: number, month: string, groupId?: string) => {
    if (!paying) return
    const id = paying.id
    addPayment(id, amount, month, groupId)
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, balance: s.balance + amount } : s)),
    )
    setPaying(null)
  }

  const handleDelete = (s: Student) => {
    if (!confirm(`"${s.fullName}" o'quvchini BUTUNLAY o'chirishni tasdiqlaysizmi? Bu amal qaytarib bo'lmaydi.`)) return
    deleteStudent(s.id).then(() => {
      setStudents((prev) => prev.filter((x) => x.id !== s.id))
      setArchived((prev) => prev.filter((x) => x.id !== s.id))
      setSelected((prev) => {
        const next = new Set(prev)
        next.delete(s.id)
        return next
      })
    })
  }

  /** Arxivga ko'chirish — sabab so'raydi va backend'ga uzatadi. */
  const openArchive = (s: Student) => {
    setArchiveTarget(s)
    setArchiveReason('')
  }
  const confirmArchive = () => {
    if (!archiveTarget) return
    const s = archiveTarget
    archiveStudent(s.id, archiveReason.trim()).then(() => {
      // Faol ro'yxatdan olib tashlab, arxivga qo'shamiz (yangi sana bilan).
      const updated: Student = {
        ...s,
        isArchived: true,
        archivedAt: new Date().toISOString().slice(0, 10),
        archiveReason: archiveReason.trim() || null,
      }
      setStudents((prev) => prev.filter((x) => x.id !== s.id))
      setArchived((prev) => [updated, ...prev])
      setSelected((prev) => {
        const next = new Set(prev)
        next.delete(s.id)
        return next
      })
      setArchiveTarget(null)
    })
  }
  /** Arxivdan qaytarish. */
  const handleRestore = (s: Student) => {
    if (!confirm(`"${s.fullName}" o'quvchini arxivdan qaytarish? Login bloklangicha qoladi — keyin parol generatsiya qiling.`)) return
    restoreStudent(s.id).then(() => {
      const updated: Student = { ...s, isArchived: false, archivedAt: null, archiveReason: null }
      setArchived((prev) => prev.filter((x) => x.id !== s.id))
      setStudents((prev) => [updated, ...prev])
    })
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="O'quvchilar"
        sub={
          tab === 'active'
            ? `Faol: ${students.length} ta · Arxivda: ${archived.length} ta`
            : `Arxivda: ${archived.length} ta o'quvchi`
        }
        actions={
          <>
            {/* Faol/Arxiv tab toggle */}
            <div className="tabs">
              <button
                type="button"
                onClick={() => {
                  setTab('active')
                  clearSelection()
                }}
                className={cn('tab', tab === 'active' && 'active')}
              >
                Faol
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('archived')
                  clearSelection()
                }}
                className={cn('tab', tab === 'archived' && 'active')}
              >
                <Archive className="mr-1 inline h-4 w-4" />
                Arxiv ({archived.length})
              </button>
            </div>
            {/* Faqat superadmin: barcha o'quvchilarni login/parol bilan Excel'ga yuklab olish.
                Parol faqat foydalanuvchi hali kirmagan bo'lsa ko'rinadi. */}
            {user?.role === 'superadmin' && (
              <Button variant="secondary" onClick={() => downloadStudentCredentials()}>
                <Download className="h-4 w-4" /> Login/parollar
              </Button>
            )}
            {tab === 'active' && (
              <>
                <Button variant="secondary" onClick={() => downloadStudentImportTemplate()}>
                  <FileDown className="h-4 w-4" /> Shablon
                </Button>
                <Button
                  variant="secondary"
                  disabled={importing}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" /> {importing ? 'Yuklanmoqda…' : 'Excel yuklash'}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={handleImportFile}
                />
                <Button
                  onClick={() => {
                    setEditing(null)
                    setFormOpen(true)
                  }}
                >
                  <Plus className="h-4 w-4" /> Yangi qo'shish
                </Button>
              </>
            )}
          </>
        }
      />

      {/* Filtrlar — toolbar */}
      <div className="toolbar">
        <div className="left">
          <div className="search-inline">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="F.I.SH yoki ota-ona bo'yicha qidirish..."
            />
          </div>
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className={control}
          >
            <option value="all">Barcha guruhlar</option>
            {classNames.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={genderFilter}
            onChange={(e) => setGenderFilter(e.target.value as 'all' | Gender)}
            className={control}
          >
            <option value="all">Barcha jinslar</option>
            <option value="male">{genderLabels.male}</option>
            <option value="female">{genderLabels.female}</option>
          </select>
          <select
            value={balanceFilter}
            onChange={(e) => setBalanceFilter(e.target.value as BalanceFilter)}
            className={control}
          >
            <option value="all">Barcha balans</option>
            <option value="debt">Qarzdorlar</option>
            <option value="paid">Qarzsizlar</option>
          </select>
        </div>
        <div className="right">
          <span className="text-sm text-slate-400">{filtered.length} ta</span>
        </div>
      </div>

      <Card tight>
        {/* Tanlanganlar uchun amal paneli */}
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-brand-50/60 px-4 py-3">
            <span className="text-sm font-semibold text-brand-700">
              {selected.size} ta tanlandi
            </span>
            <Button variant="secondary" onClick={() => setSmsOpen(true)}>
              <Send className="h-4 w-4" /> SMS yuborish
            </Button>
            <Button variant="secondary" onClick={handleExport}>
              <Download className="h-4 w-4" /> Yuklab olish (CSV)
            </Button>
            <button
              onClick={clearSelection}
              className="ml-auto inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
            >
              <X className="h-4 w-4" /> Bekor qilish
            </button>
          </div>
        )}

        {/* Jadval */}
        {loading ? (
          <Loader label="Yuklanmoqda..." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-10">
                    <input
                      ref={headerCbRef}
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="h-4 w-4 accent-brand-600"
                    />
                  </th>
                  <th className="w-10">#</th>
                  <th>F.I.SH</th>
                  <th>Guruh</th>
                  <th>Jinsi</th>
                  <th>Tug'ilgan kun</th>
                  <th>Ota-ona</th>
                  <th>Telefon</th>
                  <th className="num">Balans</th>
                  {tab === 'archived' && <th>Arxiv sanasi</th>}
                  {tab === 'archived' && <th>Sabab</th>}
                  <th className="text-right">Amallar</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr
                    key={s.id}
                    onClick={() => openNotebook(s)}
                    title="Shaxsiy daftarni ochish"
                    className="cursor-pointer"
                  >
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(s.id)}
                        onChange={() => toggleOne(s.id)}
                        className="h-4 w-4 accent-brand-600"
                      />
                    </td>
                    <td className="font-mono text-slate-400">{i + 1}</td>
                    <td>
                      <div className="cell-user">
                        <div className="avatar" style={{ background: avatarColor(s.fullName) }}>
                          {initials(s.fullName)}
                        </div>
                        <div className="meta">
                          <strong>
                            <Link
                              to={`/admin/students/${s.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-inherit no-underline hover:underline"
                            >
                              {s.fullName}
                            </Link>
                          </strong>
                          <span>{genderLabels[s.gender]}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {(s.groups && s.groups.length > 0
                          ? s.groups
                          : s.className
                            ? [s.className]
                            : []
                        ).map((g, gi) => (
                          <Badge key={gi} tone="violet">
                            {g}
                          </Badge>
                        ))}
                        {(!s.groups || s.groups.length === 0) && !s.className && (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </div>
                    </td>
                    <td className="text-slate-600">{genderLabels[s.gender]}</td>
                    <td className="font-mono text-slate-600">{formatDate(s.birthDate)}</td>
                    <td className="text-slate-600">{s.parentFullName}</td>
                    <td className="font-mono text-slate-600">{s.parentPhone}</td>
                    <td
                      className={cn(
                        'num font-semibold',
                        s.balance < 0
                          ? 'text-red-600'
                          : s.balance > 0
                            ? 'text-emerald-600'
                            : 'text-slate-500',
                      )}
                    >
                      {s.balance > 0 ? `+${formatMoney(s.balance)}` : formatMoney(s.balance)}
                    </td>
                    {tab === 'archived' && (
                      <td className="font-mono text-slate-600">{s.archivedAt ? formatDate(s.archivedAt) : '—'}</td>
                    )}
                    {tab === 'archived' && (
                      <td className="max-w-[18rem] truncate text-slate-600" title={s.archiveReason ?? ''}>
                        {s.archiveReason || '—'}
                      </td>
                    )}
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-0.5">
                        {tab === 'active' ? (
                          <>
                            <IconBtn icon={Wallet} title="To'lov kiritish" onClick={() => setPaying(s)} />
                            <IconBtn icon={History} title="To'lov tarixi" onClick={() => setHistoryOf(s)} />
                            <IconBtn
                              icon={Pencil}
                              title="Tahrirlash"
                              onClick={() => {
                                setEditing(s)
                                setFormOpen(true)
                              }}
                            />
                            <IconBtn icon={Archive} title="Arxivga ko'chirish" onClick={() => openArchive(s)} />
                          </>
                        ) : (
                          <>
                            <IconBtn icon={RotateCcw} title="Arxivdan qaytarish" onClick={() => handleRestore(s)} />
                            <IconBtn
                              icon={Trash2}
                              title="Butunlay o'chirish"
                              danger
                              onClick={() => handleDelete(s)}
                            />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={tab === 'archived' ? 12 : 10} className="px-4 py-12 text-center text-slate-400">
                      {tab === 'archived' ? 'Arxivda o\'quvchi yo\'q' : 'Hech narsa topilmadi'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modallar */}
      <StudentFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
        onSubmit={handleFormSubmit}
        initial={editing}
      />
      <StudentViewModal student={viewing} onClose={() => setViewing(null)} />
      <SmsModal open={smsOpen} onClose={() => setSmsOpen(false)} recipients={selectedStudents} />
      <PaymentModal student={paying} onClose={() => setPaying(null)} onSubmit={handlePayment} />
      <PaymentHistoryModal studentId={historyOf?.id ?? null} onClose={() => setHistoryOf(null)} />

      {/* Excel'dan import natijasi */}
      <Modal
        open={!!importResult}
        onClose={() => setImportResult(null)}
        title="Excel'dan yuklash natijasi"
        size="md"
        footer={<Button onClick={() => setImportResult(null)}>Yopish</Button>}
      >
        {importResult && (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              <span className="text-emerald-700">
                ✓ Qo'shildi: <b>{importResult.created}</b>
              </span>
              {importResult.failed > 0 && (
                <span className="text-red-600">
                  ✗ Xato: <b>{importResult.failed}</b>
                </span>
              )}
              {importResult.skipped > 0 && (
                <span className="text-slate-500">
                  O'tkazib yuborildi (bo'sh): <b>{importResult.skipped}</b>
                </span>
              )}
            </div>

            {importResult.errors.length > 0 && (
              <div className="max-h-72 overflow-auto rounded-lg border border-slate-100">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="w-16 px-3 py-2">Qator</th>
                      <th className="px-3 py-2">Xato</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {importResult.errors.map((e, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-slate-500">{e.row}</td>
                        <td className="px-3 py-2 text-red-600">{e.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {importResult.created > 0 && (
              <p className="text-slate-500">
                Yangi o'quvchilarning login/parollarini <b>"Login/parollar"</b> tugmasi orqali yuklab olishingiz mumkin.
              </p>
            )}
          </div>
        )}
      </Modal>

      {/* Arxivga ko'chirish modali — sabab kiritish */}
      <Modal
        open={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        title="O'quvchini arxivga ko'chirish"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setArchiveTarget(null)}>
              Bekor qilish
            </Button>
            <Button variant="danger" onClick={confirmArchive}>
              <Archive className="h-4 w-4" /> Arxivga ko'chirish
            </Button>
          </>
        }
      >
        {archiveTarget && (
          <div className="space-y-3 text-sm text-slate-600">
            <p>
              <span className="font-medium text-slate-800">{archiveTarget.fullName}</span>{' '}
              o'quvchini arxivga ko'chirasiz. Tarixiy ma'lumotlar (jurnal, davomat, to'lovlar)
              saqlanadi, lekin:
            </p>
            <ul className="ml-5 list-disc space-y-0.5 text-slate-500">
              <li>Faol ro'yxatdan yashirinadi (jurnal/davomat/dashboardda ko'rinmaydi)</li>
              <li>Oylik to'lov hisoblanmaydi</li>
              <li>Login bloklanadi (akkaunt paroli o'chiriladi)</li>
            </ul>
            <div>
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Sababi (ixtiyoriy)
              </span>
              <input
                value={archiveReason}
                onChange={(e) => setArchiveReason(e.target.value)}
                placeholder="masalan: Boshqa markazga ko'chdi, oilaviy sabab..."
                className={cn(control, 'w-full')}
                autoFocus
              />
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!discountPrompt}
        onClose={() => setDiscountPrompt(null)}
        title="Chegirmani joriy oyga qo'llash"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => resolveDiscountPrompt(false)}>
              Yo'q — keyingi oydan
            </Button>
            <Button onClick={() => resolveDiscountPrompt(true)}>Ha — joriy oydan</Button>
          </>
        }
      >
        {discountPrompt && (
          <div className="space-y-3 text-sm text-slate-600">
            <p>
              <span className="font-medium text-slate-800">
                {discountPrompt.values.fullName}
              </span>{' '}
              o'quvchisining chegirmasi{' '}
              <span className="font-medium">
                {discountPrompt.oldPct}% / {formatMoney(discountPrompt.oldAmount)}
              </span>{' '}
              →{' '}
              <span className="font-medium">
                {discountPrompt.newPct}% / {formatMoney(discountPrompt.newAmount)}
              </span>{' '}
              ga o'zgardi. Yangi chegirma qachondan qo'llansin?
            </p>
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-slate-500">
              <p>
                <b className="text-slate-700">Ha</b> — joriy oy hisobi yangi chegirma bilan qayta
                hisoblanadi (balans farqqa moslab to'g'rilanadi).
              </p>
              <p className="mt-1">
                <b className="text-slate-700">Yo'q</b> — joriy oy eski hisobda qoladi, yangi
                chegirma keyingi oydan amal qiladi.
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

interface IconBtnProps {
  icon: typeof Pencil
  title: string
  onClick: () => void
  danger?: boolean
}

function IconBtn({ icon: Icon, title, onClick, danger }: IconBtnProps) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'rounded-lg p-1.5 transition-colors',
        danger
          ? 'text-slate-400 hover:bg-red-50 hover:text-red-600'
          : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700',
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}
