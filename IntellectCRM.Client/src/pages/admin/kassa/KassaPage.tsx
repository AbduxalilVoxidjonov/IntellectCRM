import { useEffect, useMemo, useState } from 'react'
import { Search, Users, GraduationCap, School, Wallet, Loader2, Archive } from 'lucide-react'
import type { Group, GroupMember, Student, Subject, Teacher } from '@/types'
import { searchKassaStudents, addKassaPayment, type KassaStudent } from '@/api/services/kassa'
import { getStudent } from '@/api/services/students'
import { getTeachers } from '@/api/services/teachers'
import { getClasses, getGroupMembers } from '@/api/services/classes'
import { getSubjects } from '@/api/services/subjects'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import type { BadgeTone } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Loader } from '@/components/ui/Loader'
import { ReceiptModal } from '@/components/finance/ReceiptModal'
import { PaymentModal } from '@/pages/admin/students/PaymentModal'
import { formatMoney, apiErrorMessage, cn } from '@/lib/utils'

/** O'quvchini topish usuli: F.I.Sh (qidiruv) yoki o'qituvchi → guruh → o'quvchi. */
type Mode = 'search' | 'group'

/** A'zolik holati yorlig'i (guruh a'zolari ro'yxatida). */
const memberStatus = (m: GroupMember): { label: string; tone: BadgeTone } | null => {
  if (!m.isActive) return { label: 'Chiqarilgan', tone: 'default' }
  if (m.status === 'trial') return { label: 'Sinov', tone: 'amber' }
  if (m.status === 'frozen') return { label: 'Muzlatilgan', tone: 'blue' }
  return null // faol a'zo — belgi shart emas (ro'yxat shovqin bo'lmasin)
}

/** Balans rangi: manfiy (qarz) — qizil, aks holda yashil. */
const balanceClass = (v: number) => cn('font-mono font-semibold', v < 0 ? 'text-red-600' : 'text-emerald-600')

/**
 * KASSA — pul qabul qilish ish o'rni. Kassir o'quvchini ikki yo'l bilan topadi:
 *  1) F.I.Sh yoki telefon bo'yicha qidirish (server tomonda, 30 tagacha natija);
 *  2) o'qituvchi → uning guruhi → guruh o'quvchisi.
 * "To'lov qilish" bosilganda o'quvchilar bo'limidagi AYNAN SHU to'lov oynasi (`PaymentModal`)
 * ochiladi — oy/guruh tanlash, kvitansiya raqami, karta oxirgi 4 raqami hammasi bir xil ishlaydi.
 * Saqlangach chek (kvitansiya) avtomatik ochiladi.
 *
 * RUXSAT: "kassa" bo'limi (`RequirePerm perm="kassa"`). To'lov yozish ham shu ruxsat ostidagi
 * alohida endpoint orqali — kassirga o'quvchilarni tahrirlash huquqi berilishi SHART EMAS.
 */
export function KassaPage() {
  const [mode, setMode] = useState<Mode>('search')

  /* ---------- 1-usul: F.I.Sh / telefon qidiruvi ---------- */
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<KassaStudent[]>([])
  const [searching, setSearching] = useState(false)
  /** Qidiruv yakunlanganini bildiradi — "topilmadi" xabarini faqat shundan keyin ko'rsatamiz. */
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    const q = term.trim()
    if (q.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- qidiruv bo'shatilganda tozalash
      setResults([])
      setSearched(false)
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- yozayotganda indikator
    setSearching(true)
    let alive = true
    const t = setTimeout(() => {
      searchKassaStudents(q)
        .then((r) => {
          if (!alive) return
          setResults(r)
          setSearched(true)
        })
        .catch(() => alive && setResults([]))
        .finally(() => alive && setSearching(false))
    }, 300) // har bosishda so'rov ketmasin
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [term])

  /* ---------- 2-usul: o'qituvchi → guruh → o'quvchi ---------- */
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [classes, setClasses] = useState<Group[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [refsLoading, setRefsLoading] = useState(false)
  const [teacherId, setTeacherId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [members, setMembers] = useState<GroupMember[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  /** O'qituvchilar ro'yxatini filtrlash (markazda o'nlab o'qituvchi bo'lishi mumkin). */
  const [teacherFilter, setTeacherFilter] = useState('')

  // Ma'lumotnomalar (o'qituvchi/guruh/kurs) — faqat 2-usul birinchi marta ochilganda.
  useEffect(() => {
    if (mode !== 'group' || teachers.length > 0 || refsLoading) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- bo'lim ochilganda yuklash (maqsadli)
    setRefsLoading(true)
    Promise.all([getTeachers(), getClasses(), getSubjects()])
      .then(([t, c, s]) => {
        setTeachers(t)
        setClasses(c)
        setSubjects(s)
      })
      .finally(() => setRefsLoading(false))
  }, [mode, teachers.length, refsLoading])

  const courseName = useMemo(() => {
    const map = new Map(subjects.map((s) => [s.id, s.name]))
    return (g: Group) => (g.courseId ? (map.get(g.courseId) ?? '') : '')
  }, [subjects])

  /** Har o'qituvchining arxivlanmagan guruhlari (tanlov ro'yxatlari uchun). */
  const groupsByTeacher = useMemo(() => {
    const map = new Map<string, Group[]>()
    for (const g of classes) {
      if (g.isArchived || !g.teacherId) continue
      const list = map.get(g.teacherId)
      if (list) list.push(g)
      else map.set(g.teacherId, [g])
    }
    for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name))
    return map
  }, [classes])

  /** Faqat guruhi bor o'qituvchilar — kassada guruhsiz o'qituvchini tanlashning ma'nosi yo'q. */
  const teacherList = useMemo(() => {
    const q = teacherFilter.trim().toLowerCase()
    return teachers
      .filter((t) => (groupsByTeacher.get(t.id)?.length ?? 0) > 0)
      .filter((t) => !q || t.fullName.toLowerCase().includes(q))
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
  }, [teachers, groupsByTeacher, teacherFilter])

  const teacherGroups = teacherId ? (groupsByTeacher.get(teacherId) ?? []) : []
  const selectedGroup = teacherGroups.find((g) => g.id === groupId) ?? null

  // Guruh tanlanganda a'zolarni yuklaymiz (balans — SHU GURUH bo'yicha).
  useEffect(() => {
    if (!groupId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- guruh bekor qilinganda tozalash
      setMembers([])
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- guruh tanlanganda yuklash (maqsadli)
    setMembersLoading(true)
    let alive = true
    getGroupMembers(groupId)
      .then((m) => alive && setMembers(m))
      .catch(() => alive && setMembers([]))
      .finally(() => alive && setMembersLoading(false))
    return () => {
      alive = false
    }
  }, [groupId])

  /** Ro'yxatlarni to'lovdan keyin yangilash (balans o'zgardi). */
  const reload = () => {
    if (mode === 'group' && groupId) {
      getGroupMembers(groupId).then(setMembers).catch(() => {})
      return
    }
    const q = term.trim()
    if (q.length >= 2) searchKassaStudents(q).then(setResults).catch(() => {})
  }

  /* ---------- To'lov ---------- */
  /** To'lov oynasi uchun TO'LIQ o'quvchi (balans/guruhlar shu obyektdan olinadi). */
  const [payStudent, setPayStudent] = useState<Student | null>(null)
  /** Qaysi qator uchun o'quvchi yuklanmoqda (tugmada spinner). */
  const [opening, setOpening] = useState<string | null>(null)
  const [receiptTx, setReceiptTx] = useState<string | null>(null)
  const [receiptAuto, setReceiptAuto] = useState(false)

  const openPayment = async (studentId: string) => {
    setOpening(studentId)
    try {
      setPayStudent(await getStudent(studentId))
    } catch (e) {
      alert(apiErrorMessage(e, "O'quvchi ma'lumotini olib bo'lmadi"))
    } finally {
      setOpening(null)
    }
  }

  // DIQQAT: xato YUTILMAYDI — `PaymentModal` uni o'zi ko'rsatadi (kvitansiya band bo'lsa
  // ogohlantirish kartochkasi + "Baribir saqlash"). Shu sabab try/catch YO'Q.
  const handlePayment = async (
    amount: number,
    month: string,
    gid?: string,
    comment?: string,
    method?: string,
    date?: string,
    extra?: { receiptNo?: string; paidTime?: string; cardLast4?: string; forceReceipt?: boolean },
  ) => {
    if (!payStudent) return
    const txId = await addKassaPayment(payStudent.id, amount, month, gid, comment, method, date, extra)
    setPayStudent(null)
    reload()
    // Chek — to'lovdan so'ng darrov ochiladi va print dialogi chiqadi (moliya bo'limidagi kabi).
    if (txId) {
      setReceiptAuto(true)
      setReceiptTx(txId)
    }
  }

  /** Ro'yxatdagi "To'lov qilish" tugmasi (ikkala usulda ham bir xil). */
  const payButton = (studentId: string) => (
    <Button
      className="px-2.5 py-1.5 text-xs"
      disabled={opening === studentId}
      onClick={() => void openPayment(studentId)}
    >
      {opening === studentId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
      To'lov qilish
    </Button>
  )

  return (
    <div>
      <PageHeader
        title="Kassa"
        sub="O'quvchini F.I.Sh bo'yicha toping yoki o'qituvchi → guruh orqali tanlang va to'lovni kiriting"
      />

      {/* Topish usuli */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode('search')}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition',
            mode === 'search' ? 'bg-brand-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
          )}
        >
          <Search className="h-4 w-4" /> F.I.Sh bo'yicha
        </button>
        <button
          type="button"
          onClick={() => setMode('group')}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition',
            mode === 'group' ? 'bg-brand-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
          )}
        >
          <GraduationCap className="h-4 w-4" /> O'qituvchi → guruh
        </button>
      </div>

      {mode === 'search' ? (
        <Card>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="F.I.Sh yoki telefon raqami..."
              className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-brand-400"
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
            )}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Kamida 2 belgi. Telefon — o'quvchining o'zi, otasi, onasi yoki ota-ona raqami bo'yicha.
          </p>

          {results.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>O'quvchi</th>
                    <th>Telefon</th>
                    <th>Guruhlar</th>
                    <th className="num">Balans</th>
                    <th className="num">Amal</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((s) => (
                    <tr key={s.id}>
                      <td className="font-medium text-slate-700">
                        {s.fullName}
                        {s.isArchived && (
                          <Badge tone="default" className="ml-2">
                            <Archive className="h-3 w-3" /> Arxiv
                          </Badge>
                        )}
                      </td>
                      <td className="font-mono text-[12.5px] text-slate-500">
                        {s.phone || s.parentPhone || '—'}
                      </td>
                      <td className="text-slate-600">{s.groups.length > 0 ? s.groups.join(', ') : '—'}</td>
                      <td className={cn('num', balanceClass(s.balance))}>{formatMoney(s.balance)}</td>
                      <td className="num">
                        {payButton(s.id)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : searched && !searching ? (
            <p className="py-10 text-center text-sm text-slate-400">O'quvchi topilmadi.</p>
          ) : (
            !searching && (
              <p className="py-10 text-center text-sm text-slate-400">
                To'lov qabul qilish uchun o'quvchini qidiring.
              </p>
            )
          )}
        </Card>
      ) : refsLoading ? (
        <Card>
          <Loader label="Yuklanmoqda..." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)]">
          {/* 1-ustun: o'qituvchilar */}
          <Card className="min-w-0">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <GraduationCap className="h-4 w-4 text-brand-600" /> O'qituvchi
            </h2>
            <input
              value={teacherFilter}
              onChange={(e) => setTeacherFilter(e.target.value)}
              placeholder="Qidirish..."
              className="mb-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-400"
            />
            <div className="max-h-[26rem] overflow-y-auto">
              {teacherList.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">O'qituvchi topilmadi.</p>
              ) : (
                teacherList.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setTeacherId(t.id)
                      setGroupId('')
                    }}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition',
                      teacherId === t.id ? 'bg-brand-50 font-semibold text-brand-700' : 'text-slate-600 hover:bg-slate-50',
                    )}
                  >
                    <span className="truncate">{t.fullName}</span>
                    <span className="shrink-0 text-xs text-slate-400">
                      {groupsByTeacher.get(t.id)?.length ?? 0} guruh
                    </span>
                  </button>
                ))
              )}
            </div>
          </Card>

          {/* 2-ustun: tanlangan o'qituvchining guruhlari */}
          <Card className="min-w-0">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <School className="h-4 w-4 text-brand-600" /> Guruh
            </h2>
            {!teacherId ? (
              <p className="py-6 text-center text-sm text-slate-400">Avval o'qituvchini tanlang.</p>
            ) : teacherGroups.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">Guruh yo'q.</p>
            ) : (
              <div className="max-h-[26rem] overflow-y-auto">
                {teacherGroups.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGroupId(g.id)}
                    className={cn(
                      'w-full rounded-lg px-3 py-2 text-left text-sm transition',
                      groupId === g.id ? 'bg-brand-50 font-semibold text-brand-700' : 'text-slate-600 hover:bg-slate-50',
                    )}
                  >
                    <span className="block truncate">{g.name}</span>
                    <span className="block truncate text-xs font-normal text-slate-400">
                      {[courseName(g), g.monthlyFee ? formatMoney(g.monthlyFee) : ''].filter(Boolean).join(' · ')}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* 3-ustun: guruh o'quvchilari */}
          <Card className="min-w-0">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Users className="h-4 w-4 text-brand-600" /> O'quvchilar
              {selectedGroup && <span className="font-normal text-slate-400">— {selectedGroup.name}</span>}
            </h2>
            {!groupId ? (
              <p className="py-6 text-center text-sm text-slate-400">Guruhni tanlang.</p>
            ) : membersLoading ? (
              <Loader label="Yuklanmoqda..." />
            ) : members.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">Guruhda o'quvchi yo'q.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>O'quvchi</th>
                      <th className="num">Balans (shu guruh)</th>
                      <th className="num">Amal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => {
                      const st = memberStatus(m)
                      return (
                        <tr key={m.studentId}>
                          <td className="font-medium text-slate-700">
                            {m.fullName}
                            {st && (
                              <Badge tone={st.tone} className="ml-2">
                                {st.label}
                              </Badge>
                            )}
                          </td>
                          <td className={cn('num', balanceClass(m.balance))}>{formatMoney(m.balance)}</td>
                          <td className="num">
                            {payButton(m.studentId)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      <PaymentModal student={payStudent} onClose={() => setPayStudent(null)} onSubmit={handlePayment} />

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
