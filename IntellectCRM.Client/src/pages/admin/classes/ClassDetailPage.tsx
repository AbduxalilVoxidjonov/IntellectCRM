import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '@/context/auth-context'
import {
  ArrowLeft, Users, BookOpen, User,
  CalendarDays, Clock, MapPin, Wallet, Snowflake, CheckCircle2,
  ListChecks, ChevronRight, ChevronDown, Plus, Minus, Repeat, CalendarClock, Flag, TrendingUp, Trophy,
  UserRound,
} from 'lucide-react'
import type { AbsenceReason, MasteryLevel } from '@/types'
import {
  getGroupJournal, setJournalEntry, clearJournalEntry, bulkAttendance,
  type GroupJournal,
} from '@/api/services/journal'
import {
  getGroupCurriculum, setGroupCover, changeGroupRevision,
  type GroupCurriculum,
} from '@/api/services/curriculum'
import { activateMember, freezeMember } from '@/api/services/classes'
import { getSettings } from '@/api/services/settings'
import { cn, formatMoney, formatDate } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { GradingSection } from '@/components/grading/GradingSection'
import {
  getGradingBoard, setGrade, bulkGrade,
  type GradingBoard, type GradingBoardCriterion,
} from '@/api/services/grading'
import { Loader } from '@/components/ui/Loader'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { JournalCellModal } from '../journal/JournalCellModal'
import { CompleteAndTransferModal } from './CompleteAndTransferModal'

const weekdayShort = ['Du', 'Se', 'Cho', 'Pa', 'Ju', 'Sha', 'Ya']
const uzMonths = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
]
const monthLabel = (m: string) =>
  m && m.length >= 7 ? `${uzMonths[Number(m.slice(5, 7)) - 1] ?? m} ${m.slice(0, 4)}` : m

/** Reyting tabidagi bitta oy uchun jurnal+baholash ma'lumoti. */
interface RatingMonthData {
  month: string
  journal: GroupJournal | null
  grading: GradingBoard | null
}

function statusBadge(status: string): { label: string; cls: string } {
  switch (status) {
    case 'active':
      return { label: 'Aktiv', cls: 'bg-emerald-50 text-emerald-700' }
    case 'frozen':
      return { label: 'Muzlatilgan', cls: 'bg-sky-50 text-sky-700' }
    default:
      return { label: 'Sinov', cls: 'bg-amber-50 text-amber-700' }
  }
}

/** Baho katakchasi to'liq rangi — bahoga qarab (5=yashil, 4=ko'k, 3=sariq, past=qizil). */
function gradeFill(g: number): string {
  return g >= 5
    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
    : g >= 4
      ? 'bg-brand-50 text-brand-700 hover:bg-brand-100'
      : g >= 3
        ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
        : 'bg-red-50 text-red-600 hover:bg-red-100'
}

/** Mastery darajasi — rangi va yorlig'i */
function masteryDisplay(m: MasteryLevel | undefined): { label: string; cls: string } {
  switch (m) {
    case 0:
      return { label: '😴', cls: 'bg-slate-50 text-slate-600 hover:bg-slate-100' }
    case 1:
      return { label: '👂', cls: 'bg-blue-50 text-blue-600 hover:bg-blue-100' }
    case 2:
      return { label: '🙋', cls: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' }
    case 3:
      return { label: '⭐', cls: 'bg-amber-50 text-amber-600 hover:bg-amber-100' }
    default:
      return { label: '', cls: '' }
  }
}

export function ClassDetailPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const [journal, setJournal] = useState<GroupJournal | null>(null)
  const [reasons, setReasons] = useState<AbsenceReason[]>([])
  const [loading, setLoading] = useState(true)
  const [cell, setCell] = useState<{ studentId: string; studentName: string; date: string } | null>(null)
  const [saving, setSaving] = useState(false)
  /** Sarlavhadagi sana bosilganda — shu kun uchun hammaga davomat modali. */
  const [bulkDate, setBulkDate] = useState<string | null>(null)
  const [bulkSaving, setBulkSaving] = useState(false)
  /** O'quvchi nomi bosilganda — aktivlashtirish/muzlatish modali. */
  const [memberModal, setMemberModal] = useState<{ studentId: string; fullName: string; status: string } | null>(null)
  const [memberDate, setMemberDate] = useState('')
  const [memberSaving, setMemberSaving] = useState(false)

  // ---- Guruh o'quv dasturi (darsda o'tilgan) ----
  const [groupView, setGroupView] = useState<'jurnal' | 'baholash' | 'reyting'>('jurnal')
  const [grading, setGrading] = useState<GradingBoard | null>(null)
  const [curr, setCurr] = useState<GroupCurriculum | null>(null)
  // ---- Reyting — ko'p-oylik filtr ----
  const [ratingMonths, setRatingMonths] = useState<string[]>([])
  const [ratingData, setRatingData] = useState<RatingMonthData[]>([])
  const [ratingLoading, setRatingLoading] = useState(false)
  const ratingCache = useRef(new Map<string, { journal: GroupJournal | null; grading: GradingBoard | null }>())
  const [currLoading, setCurrLoading] = useState(true)
  const [currExpanded, setCurrExpanded] = useState<Set<string>>(new Set())
  const [revSaving, setRevSaving] = useState(false)

  // ---- "Guruhni tugatish" modali ----
  const [showCompleteModal, setShowCompleteModal] = useState(false)

  const openCompleteModal = () => setShowCompleteModal(true)

  const loadCurr = useCallback(() => {
    if (!id) return
    setCurrLoading(true)
    getGroupCurriculum(id)
      .then(setCurr)
      .catch(() => setCurr(null))
      .finally(() => setCurrLoading(false))
  }, [id])

  useEffect(() => {
    loadCurr()
  }, [loadCurr])

  const load = useCallback(
    (month?: string) => {
      if (!id) return
      setLoading(true)
      getGroupJournal(id, month)
        .then(setJournal)
        .finally(() => setLoading(false))
    },
    [id],
  )

  const loadGrading = useCallback(
    (month?: string) => {
      if (!id) return
      getGradingBoard(id, month)
        .then(setGrading)
        .catch(() => setGrading(null))
    },
    [id],
  )

  useEffect(() => {
    load()
    getSettings()
      .then((s) => setReasons(s.absenceReasons))
      .catch(() => {})
  }, [load])

  useEffect(() => {
    if (groupView === 'reyting' && journal?.month) {
      loadGrading(journal.month)
    }
  }, [groupView, journal?.month, loadGrading])

  // Guruh o'zgarsa — reyting keshi va tanlovi tozalanadi.
  useEffect(() => {
    ratingCache.current.clear()
    setRatingMonths([])
    setRatingData([])
  }, [id])

  // Reyting tab birinchi ochilganda default — joriy jurnal oyi.
  useEffect(() => {
    if (groupView === 'reyting' && ratingMonths.length === 0 && journal?.month) {
      setRatingMonths([journal.month])
    }
  }, [groupView, journal?.month, ratingMonths.length])

  // Tanlangan oylar bo'yicha jurnal+baholash — keshlangan holda yuklanadi.
  useEffect(() => {
    if (groupView !== 'reyting' || !id || ratingMonths.length === 0) return
    let cancelled = false
    setRatingLoading(true)
    Promise.all(
      ratingMonths.map(async (m): Promise<RatingMonthData> => {
        const cached = ratingCache.current.get(m)
        if (cached) return { month: m, journal: cached.journal, grading: cached.grading }
        try {
          const [j, gr] = await Promise.all([getGroupJournal(id, m), getGradingBoard(id, m)])
          ratingCache.current.set(m, { journal: j, grading: gr })
          return { month: m, journal: j, grading: gr }
        } catch {
          ratingCache.current.set(m, { journal: null, grading: null })
          return { month: m, journal: null, grading: null }
        }
      }),
    )
      .then((results) => {
        if (!cancelled) setRatingData(results)
      })
      .finally(() => {
        if (!cancelled) setRatingLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [groupView, ratingMonths, id])

  // Reyting oy chipini bosish — toggle, lekin kamida 1 oy tanlangan qoladi.
  const toggleRatingMonth = (m: string) => {
    setRatingMonths((prev) => {
      if (prev.includes(m)) {
        if (prev.length === 1) return prev
        return prev.filter((x) => x !== m)
      }
      return [...prev, m].sort()
    })
  }

  const reasonById = useMemo(
    () => new Map(reasons.map((r) => [r.id, r])),
    [reasons],
  )
  const entryMap = useMemo(
    () => new Map((journal?.entries ?? []).map((e) => [`${e.studentId}|${e.date}`, e])),
    [journal],
  )
  // "O'tildi" deb belgilangan darslar — sababsiz o'quvchi shu kunda KELDI (yashil) deb ko'rsatiladi.
  const conductedSet = useMemo(() => new Set(journal?.conductedDates ?? []), [journal])
  // Muzlatilganlar jurnalga QO'SHILMAYDI — grid'da faqat faol/sinov o'quvchilar, muzlatilganlar pastda alohida.
  // O'quvchilari jurnalga kiritilgan va baholashga kiritilgan baholarning yig'indisi bo'yicha saralash.
  // Agar baholash ma'lumoti bo'lsa, unga bog'langan kombindan yig'indi; aks holda faqat jurnal baholari.
  const sortedAndScoredStudents = useMemo(() => {
    const students = (journal?.students ?? []).filter((s) => s.status !== 'frozen')
    if (!grading || grading.students.length === 0) {
      // Faqat jurnal bahosi
      return students.map((s, idx) => {
        const totalGrade = journal!.columns.reduce((sum, c) => {
          const e = entryMap.get(`${s.studentId}|${c.date}`)
          return sum + (e?.grade ?? 0)
        }, 0)
        return { ...s, journalTotal: totalGrade, gradingTotal: 0, combinedTotal: totalGrade, originalIndex: idx }
      })
        .sort((a, b) => b.combinedTotal - a.combinedTotal || a.originalIndex - b.originalIndex)
    }
    // Baholash va jurnal baholarini birlashtirish
    const gradingStudentMap = new Map(grading.students.map((gs) => [gs.studentId, gs]))
    return students.map((s, idx) => {
      const journalTotal = journal!.columns.reduce((sum, c) => {
        const e = entryMap.get(`${s.studentId}|${c.date}`)
        return sum + (e?.grade ?? 0)
      }, 0)
      const gs = gradingStudentMap.get(s.studentId)
      const doneKeys = new Set(gs?.doneKeys ?? [])
      const gradingTotal = doneKeys.size
      return {
        ...s,
        journalTotal,
        gradingTotal,
        combinedTotal: journalTotal + gradingTotal,
        originalIndex: idx,
      }
    })
      .sort((a, b) => b.combinedTotal - a.combinedTotal || a.originalIndex - b.originalIndex)
  }, [journal, grading, entryMap])

  const journalStudents = useMemo(
    () => sortedAndScoredStudents,
    [sortedAndScoredStudents],
  )
  const frozenStudents = useMemo(
    () => (journal?.students ?? []).filter((s) => s.status === 'frozen'),
    [journal],
  )

  const g = journal?.group
  const today = new Date().toISOString().slice(0, 10)

  const handleSave = async (
    grade: number | null,
    reasonId: string | null,
    homework: number,
    behavior: number,
    mastery: MasteryLevel | null,
  ) => {
    if (!journal || !cell) return
    setSaving(true)
    try {
      await setJournalEntry(journal.group.id, journal.group.courseId, 1, cell.studentId, cell.date, 1, {
        grade, reasonId, homework, behavior, mastery,
      })
      setCell(null)
      load(journal.month)
    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : (err as any)?.response?.data?.message ?? 'Saqlab bo\'lmadi'
      alert(message)
    } finally {
      setSaving(false)
    }
  }

  const handleClear = async () => {
    if (!journal || !cell) return
    setSaving(true)
    try {
      await clearJournalEntry(journal.group.id, journal.group.courseId, 1, cell.studentId, cell.date, 1)
      setCell(null)
      load(journal.month)
    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : (err as any)?.response?.data?.message ?? 'Tozalab bo\'lmadi'
      alert(message)
    } finally {
      setSaving(false)
    }
  }

  // O'quvchi nomi bosilganda — aktivlashtirish/muzlatish (sana bilan).
  const openMember = (st: { studentId: string; fullName: string; status: string }) => {
    setMemberDate(today)
    setMemberModal({ studentId: st.studentId, fullName: st.fullName, status: st.status })
  }
  const doMember = async (kind: 'activate' | 'freeze') => {
    if (!journal || !memberModal) return
    setMemberSaving(true)
    try {
      if (kind === 'activate') await activateMember(journal.group.id, memberModal.studentId, memberDate)
      else await freezeMember(journal.group.id, memberModal.studentId, memberDate)
      setMemberModal(null)
      load(journal.month)
    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : (err as any)?.response?.data?.message ?? 'Amal bajarilmadi'
      alert(message)
    } finally {
      setMemberSaving(false)
    }
  }

  const absentReasons = useMemo(() => reasons.filter((r) => !r.isLate), [reasons])

  // Daraja yoyish/yig'ish (default — yopiq)
  const toggleLevel = (levelId: string) =>
    setCurrExpanded((s) => {
      const next = new Set(s)
      if (next.has(levelId)) next.delete(levelId)
      else next.add(levelId)
      return next
    })

  // Birinchi o'tilmagan band — "keyingi" maslahati uchun
  const nextItemId = useMemo(() => {
    if (!curr) return null
    for (const lv of curr.levels)
      for (const tp of lv.topics)
        for (const it of tp.items) if (!it.covered) return it.id
    return null
  }, [curr])

  // Band belgilash — optimistik (mahalliy holatni darhol yangilaymiz), so'ng refetch (prognoz aniq qolishi uchun)
  const toggleCover = async (itemId: string, covered: boolean) => {
    if (!curr) return
    const prev = curr
    setCurr({
      ...curr,
      coveredCount: curr.coveredCount + (covered ? 1 : -1),
      levels: curr.levels.map((lv) => ({
        ...lv,
        topics: lv.topics.map((tp) => ({
          ...tp,
          items: tp.items.map((it) => (it.id === itemId ? { ...it, covered } : it)),
        })),
      })),
    })
    try {
      await setGroupCover(id, itemId, covered)
      loadCurr()
    } catch {
      setCurr(prev)
      alert('Saqlab bo\'lmadi')
    }
  }

  // Takrorlash darsi +1 / -1
  const changeRevision = async (delta: number) => {
    if (!curr || revSaving) return
    setRevSaving(true)
    try {
      await changeGroupRevision(id, delta)
      loadCurr()
    } catch {
      alert('Saqlab bo\'lmadi')
    } finally {
      setRevSaving(false)
    }
  }

  // Sarlavhadagi sana bosilganda — shu darsdagi BARCHA o'quvchiga birdan davomat.
  // absent=false → hammasi keldi; true → hammasi kelmadi (reasonId berilsa shu sabab, aks holda standart).
  const doBulk = async (absent: boolean, reasonId: string | null) => {
    if (!journal || !bulkDate) return
    setBulkSaving(true)
    try {
      await bulkAttendance(
        journal.group.id,
        journal.group.courseId,
        bulkDate,
        1,
        journalStudents.map((s) => s.studentId),
        { absent, reasonId },
      )
      setBulkDate(null)
      load(journal.month)
    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : (err as any)?.response?.data?.message ?? 'Saqlab bo\'lmadi'
      alert(message)
    } finally {
      setBulkSaving(false)
    }
  }

  const cellEntry = cell ? entryMap.get(`${cell.studentId}|${cell.date}`) ?? null : null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/admin/classes"
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">{g ? g.name : 'Guruh'}</h1>
            {g && (
              <p className="mt-0.5 text-sm text-slate-400">
                {g.courseName || 'Kurs biriktirilmagan'}
                {g.teacherName ? ` · ${g.teacherName}` : ''}
              </p>
            )}
          </div>
        </div>
        {g && user?.role === 'superadmin' && (
          <button
            onClick={openCompleteModal}
            className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-amber-700 transition-colors hover:bg-amber-100"
            title="Guruhni tugatish va sertifikat berish (SuperAdmin faqat)"
          >
            <Trophy className="h-4 w-4" />
            <span className="text-sm font-medium">Tugatish</span>
          </button>
        )}
      </div>

      {loading && !journal ? (
        <Loader label="Yuklanmoqda..." />
      ) : !g ? (
        <Card className="py-16 text-center text-slate-400">Guruh topilmadi</Card>
      ) : (
        <>
          {/* Guruh ma'lumotlari */}
          <Card>
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              <Info icon={BookOpen} label="Kurs" value={g.courseName || '—'} />
              <Info icon={User} label="O'qituvchi" value={g.teacherName || '—'} />
              <Info icon={Wallet} label="Oylik to'lov" value={formatMoney(g.monthlyFee)} mono />
              <Info
                icon={CalendarDays}
                label="Dars kunlari"
                value={g.days.length ? g.days.map((d) => weekdayShort[d] ?? d).join(', ') : '—'}
              />
              <Info
                icon={Clock}
                label="Dars vaqti"
                value={g.startTime || g.endTime ? `${g.startTime || '—'}${g.endTime ? ` – ${g.endTime}` : ''}` : '—'}
                mono
              />
              <Info icon={MapPin} label="Xona" value={g.room || '—'} />
            </div>
          </Card>

          {/* Jurnal / Baholash toggle */}
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => { setGroupView('jurnal'); load(journal?.month) }}
              className={
                'rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ' +
                (groupView === 'jurnal' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700')
              }
            >
              Jurnal
            </button>
            <button
              type="button"
              onClick={() => setGroupView('baholash')}
              className={
                'rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ' +
                (groupView === 'baholash' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700')
              }
            >
              Baholash
            </button>
            <button
              type="button"
              onClick={() => setGroupView('reyting')}
              className={
                'rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ' +
                (groupView === 'reyting' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700')
              }
            >
              Reyting
            </button>
          </div>

          {/* Oylik jurnal */}
          {groupView === 'jurnal' && (
          <Card className="p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-brand-600" />
                <h2 className="font-semibold text-slate-800">Jurnal (oylik)</h2>
                <span className="inline-flex items-center gap-1 text-sm text-slate-400">
                  <Users className="h-4 w-4" /> {journalStudents.length} o'quvchi
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {journal?.months.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => load(m)}
                    title={monthLabel(m)}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                      journal.month === m
                        ? 'bg-brand-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                    )}
                  >
                    {monthLabel(m)}
                  </button>
                ))}
              </div>
            </div>

            {!g.courseId ? (
              <p className="px-4 py-12 text-center text-sm text-slate-400">
                Guruhga kurs biriktirilmagan — jurnal yuritib bo'lmaydi.
              </p>
            ) : journalStudents.length === 0 && frozenStudents.length === 0 ? (
              <p className="px-4 py-12 text-center text-sm text-slate-400">
                Bu guruhda o'quvchi yo'q.
              </p>
            ) : (journal?.columns.length ?? 0) === 0 ? (
              <p className="px-4 py-12 text-center text-sm text-slate-400">
                {monthLabel(journal?.month ?? '')} oyida bu guruh kunlariga dars to'g'ri kelmadi.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-100 text-xs text-slate-500">
                      <th className="border-b-2 border-r border-slate-200 bg-slate-100 px-2 py-2.5 text-center font-semibold w-8">
                        №
                      </th>
                      <th className="sticky left-0 z-20 border-b-2 border-r-2 border-slate-200 bg-slate-100 px-4 py-2.5 text-left font-semibold">
                        O'quvchi
                      </th>
                      {journal!.columns.map((c) => {
                        const dt = new Date(c.date)
                        const wd = (dt.getDay() + 6) % 7
                        const isToday = c.date === today
                        const isBeforeStart = !!g.startDate && c.date < g.startDate
                        return (
                          <th
                            key={c.date}
                            className={cn(
                              'border-b-2 border-r border-slate-200 p-0 text-center font-semibold',
                              isBeforeStart ? 'bg-slate-50 text-slate-300' : isToday ? 'bg-brand-100 text-brand-700' : 'text-slate-500',
                            )}
                          >
                            <button
                              type="button"
                              disabled={isBeforeStart}
                              onClick={() => setBulkDate(c.date)}
                              title={isBeforeStart ? 'Sana guruh yaratilishidan oldin' : 'Shu kun uchun hammaga davomat (keldi / kelmadi)'}
                              className={cn(
                                'w-full px-2 py-1.5 transition-colors',
                                isBeforeStart ? 'cursor-not-allowed opacity-50' : 'hover:bg-brand-200/40',
                              )}
                            >
                              <div className="text-sm">{c.date.slice(8, 10)}</div>
                              <div
                                className={cn(
                                  'text-[10px] font-medium',
                                  isBeforeStart ? 'text-slate-300' : isToday ? 'text-brand-500' : 'text-slate-400',
                                )}
                              >
                                {weekdayShort[wd]}
                              </div>
                            </button>
                          </th>
                        )
                      })}
                      <th className="sticky right-0 z-20 border-b-2 border-l-2 border-slate-200 bg-slate-100 px-4 py-2.5 text-center font-semibold text-slate-600">
                        Jami
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {journalStudents.map((st, idx) => {
                      const sb = statusBadge(st.status)
                      return (
                        <tr key={st.studentId} className="bg-white even:bg-slate-50 hover:bg-brand-50">
                          <td className="border-b border-r border-slate-200 bg-inherit px-2 py-1 text-center">
                            <span className="text-xs font-medium text-slate-500">{idx + 1}</span>
                          </td>
                          <td className="sticky left-0 z-10 border-b border-r-2 border-slate-200 bg-inherit px-2 py-1">
                            <button
                              type="button"
                              onClick={() => openMember(st)}
                              title="Aktivlashtirish / Muzlatish"
                              className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left transition-colors hover:bg-slate-100"
                            >
                              <span
                                className={cn(
                                  'h-2 w-2 shrink-0 rounded-full',
                                  st.balance < 0 ? 'bg-red-500' : 'bg-emerald-500',
                                )}
                                title={st.balance < 0 ? `Qarz: ${formatMoney(st.balance)}` : 'Qarzi yo\'q'}
                              />
                              <span className={cn('font-medium', st.balance < 0 ? 'text-red-600' : 'text-emerald-700')}>
                                {st.fullName}
                              </span>
                              <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', sb.cls)}>
                                {sb.label}
                              </span>
                            </button>
                          </td>
                          {journal!.columns.map((c) => {
                            const e = entryMap.get(`${st.studentId}|${c.date}`)
                            const reason = e?.reasonId ? reasonById.get(e.reasonId) : undefined
                            const isToday = c.date === today
                            const isBeforeStart = !!g.startDate && c.date < g.startDate
                            // Keldi (yashil): dars o'tildi + baho yo'q + sabab yo'q.
                            const present = e?.grade == null && !reason && conductedSet.has(c.date)
                            const masteryInfo = e?.mastery != null ? masteryDisplay(e.mastery) : { label: '', cls: '' }
                            return (
                              <td
                                key={c.date}
                                className={cn(
                                  'border-b border-r border-slate-100 p-1 text-center',
                                  isBeforeStart ? 'bg-slate-50' : isToday && 'bg-brand-50/30',
                                )}
                              >
                                <button
                                  type="button"
                                  disabled={isBeforeStart}
                                  onClick={() =>
                                    setCell({ studentId: st.studentId, studentName: st.fullName, date: c.date })
                                  }
                                  className={cn(
                                    'flex h-9 w-full min-w-9 items-center justify-center rounded-md text-sm font-semibold transition-colors',
                                    isBeforeStart
                                      ? 'cursor-not-allowed text-slate-200'
                                      : e?.grade != null
                                        ? gradeFill(e.grade)
                                        : e?.mastery != null
                                          ? masteryInfo.cls
                                          : reason
                                            ? reason.isLate
                                              ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                              : 'bg-red-50 text-red-600 hover:bg-red-100'
                                            : present
                                              ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                                              : 'text-slate-300 hover:bg-brand-50',
                                  )}
                                  title={isBeforeStart ? 'Sana guruh yaratilishidan oldin' : `${st.fullName} — ${formatDate(c.date)}`}
                                >
                                  {e?.grade != null
                                    ? e.grade
                                    : e?.mastery != null
                                      ? masteryInfo.label
                                      : reason
                                        ? reason.short || reason.name.slice(0, 2)
                                        : present
                                          ? '✓'
                                          : '·'}
                                </button>
                              </td>
                            )
                          })}
                          <td className="sticky right-0 z-10 border-b border-l-2 border-slate-200 bg-inherit px-4 py-1 text-center">
                            <span className={cn('inline-flex h-8 w-8 items-center justify-center rounded-md font-semibold text-slate-600', st.combinedTotal > 0 ? 'bg-violet-100 text-violet-700' : 'text-slate-400')}>
                              {st.combinedTotal || '—'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}

                    {/* Muzlatilganlar — jurnalga qo'shilmaydi, lekin baho/davomati SAQLANADI va ko'rinadi (faqat o'qish) */}
                    {frozenStudents.length > 0 && (
                      <>
                        <tr>
                          <td
                            colSpan={2 + journal!.columns.length}
                            className="border-b border-t-2 border-slate-200 bg-slate-50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400"
                          >
                            Muzlatilgan (faqat ko'rish — baho/davomat saqlanadi)
                          </td>
                        </tr>
                        {frozenStudents.map((st) => {
                          const totalGrade = journal!.columns.reduce((sum, c) => {
                            const e = entryMap.get(`${st.studentId}|${c.date}`)
                            return sum + (e?.grade ?? 0)
                          }, 0)
                          return (
                            <tr key={st.studentId} className="bg-slate-50 text-slate-400">
                              <td className="sticky left-0 z-10 border-b border-r-2 border-slate-200 bg-inherit px-2 py-1">
                                <button
                                  type="button"
                                  onClick={() => openMember(st)}
                                  title="Aktivlashtirish"
                                  className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left transition-colors hover:bg-slate-100"
                                >
                                  <Snowflake className="h-3.5 w-3.5 shrink-0 text-sky-500" />
                                  <span className={cn('font-medium', st.balance < 0 ? 'text-red-600' : 'text-slate-500')}>
                                    {st.fullName}
                                  </span>
                                </button>
                              </td>
                              {journal!.columns.map((c) => {
                                const e = entryMap.get(`${st.studentId}|${c.date}`)
                                const reason = e?.reasonId ? reasonById.get(e.reasonId) : undefined
                                return (
                                  <td key={c.date} className="border-b border-r border-slate-100 p-1 text-center">
                                    <span
                                      className={cn(
                                        'inline-flex h-7 min-w-7 items-center justify-center rounded px-1 text-sm font-semibold',
                                        e?.grade != null
                                          ? gradeFill(e.grade)
                                          : reason
                                            ? reason.isLate
                                              ? 'bg-amber-50 text-amber-700'
                                              : 'bg-red-50 text-red-600'
                                            : 'text-slate-300',
                                      )}
                                    >
                                      {e?.grade != null
                                        ? e.grade
                                        : reason
                                          ? reason.short || reason.name.slice(0, 2)
                                          : '·'}
                                    </span>
                                  </td>
                                )
                              })}
                              <td className="sticky right-0 z-10 border-b border-l-2 border-slate-200 bg-inherit px-4 py-1 text-center">
                                <span className={cn('inline-flex h-8 w-8 items-center justify-center rounded-md font-semibold text-slate-400', totalGrade > 0 ? 'bg-slate-200 text-slate-600' : '')}>
                                  {totalGrade || '—'}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          )}

          {/* Baholash — har darsga mezonlar bo'yicha bajardi/bajarmadi */}
          {groupView === 'baholash' && (
            <Card title="Baholash" sub="Har darsga mezonlar bo'yicha o'quvchini belgilang (bajardi / bajarmadi)">
              <GradingSection groupId={id} fetchBoard={getGradingBoard} saveGrade={setGrade} bulkGrade={bulkGrade} />
            </Card>
          )}

          {/* Reyting — o'quvchilarning o'rtacha bahosi va baholash statistikasi (bir yoki bir nechta oy yig'indisi) */}
          {groupView === 'reyting' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-[var(--shadow-1)]">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-brand-600" />
                  <h2 className="font-semibold text-slate-800">Reyting oylari</h2>
                  {ratingMonths.length > 1 && (
                    <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
                      {ratingMonths.length} oy yig'indisi
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(journal?.months ?? []).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => toggleRatingMonth(m)}
                      title={monthLabel(m)}
                      className={cn(
                        'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                        ratingMonths.includes(m)
                          ? 'bg-brand-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                      )}
                    >
                      {monthLabel(m)}
                    </button>
                  ))}
                </div>
              </div>
              <RatingsTab data={ratingData} loading={ratingLoading} />
            </div>
          )}

          {/* O'quv dasturi — darsda o'tilgan bandlar + tugatish prognozi */}
          <CurriculumSection
            curr={curr}
            loading={currLoading}
            expanded={currExpanded}
            onToggleLevel={toggleLevel}
            onToggleCover={toggleCover}
            onChangeRevision={changeRevision}
            revSaving={revSaving}
            nextItemId={nextItemId}
          />
        </>
      )}

      <JournalCellModal
        open={!!cell}
        studentName={cell?.studentName ?? ''}
        dateLabel={cell ? formatDate(cell.date) : ''}
        date={cell?.date}
        startDate={g?.startDate}
        entry={cellEntry}
        reasons={reasons}
        onClose={() => !saving && setCell(null)}
        onSave={handleSave}
        onClear={handleClear}
      />

      {/* Sarlavha sanasi bosilganda — shu kun uchun hammaga birdan davomat */}
      <Modal
        open={!!bulkDate}
        onClose={() => !bulkSaving && setBulkDate(null)}
        size="sm"
        title={bulkDate ? `${formatDate(bulkDate)} — davomat` : 'Davomat'}
        footer={
          <Button variant="secondary" onClick={() => setBulkDate(null)} disabled={bulkSaving}>
            Yopish
          </Button>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Shu darsdagi <span className="font-semibold text-slate-700">{journalStudents.length}</span> o'quvchiga
            birdan qo'llanadi.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => doBulk(false, null)}
              disabled={bulkSaving}
              className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
              ✓ Hammasi keldi
            </button>
            <button
              type="button"
              onClick={() => doBulk(true, null)}
              disabled={bulkSaving}
              className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              ✗ Hammasi kelmadi
            </button>
          </div>
          {absentReasons.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-slate-600">Yoki sabab bilan kelmadi:</p>
              <div className="flex flex-wrap gap-2">
                {absentReasons.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    disabled={bulkSaving}
                    onClick={() => doBulk(true, r.id)}
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
                  >
                    {r.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* O'quvchi nomi bosilganda — aktivlashtirish / muzlatish */}
      <Modal
        open={!!memberModal}
        onClose={() => !memberSaving && setMemberModal(null)}
        size="sm"
        title={memberModal?.fullName ?? "A'zolik"}
        footer={
          <Button variant="secondary" onClick={() => setMemberModal(null)} disabled={memberSaving}>
            Yopish
          </Button>
        }
      >
        {memberModal && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-500">Holat:</span>
              <span className={cn('rounded-md px-2 py-0.5 text-xs font-medium', statusBadge(memberModal.status).cls)}>
                {statusBadge(memberModal.status).label}
              </span>
            </div>
            {/* O'quvchi shaxsiy profiliga o'tish */}
            <Link
              to={'/admin/students/' + memberModal.studentId}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <UserRound className="h-4 w-4" /> Profilga o'tish
            </Link>
            <div>
              <span className="mb-1 block text-sm font-medium text-slate-600">Sana</span>
              <input
                type="date"
                value={memberDate}
                onChange={(e) => setMemberDate(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-400"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={memberSaving || memberModal.status === 'active'}
                onClick={() => doMember('activate')}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-40"
              >
                <CheckCircle2 className="h-4 w-4" /> Aktivlashtirish
              </button>
              <button
                type="button"
                disabled={memberSaving || memberModal.status !== 'active'}
                onClick={() => doMember('freeze')}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-700 disabled:opacity-40"
              >
                <Snowflake className="h-4 w-4" /> Muzlatish
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Aktivlashtirilganda shu sanadan qisman oylik hisoblanadi; muzlatilganda shu sanadan to'lov to'xtaydi.
            </p>
          </div>
        )}
      </Modal>

      {/* Guruhni yakunlash modali (Hybrid: arxivlash + maqsad kursga yangi guruh) */}
      <CompleteAndTransferModal
        open={showCompleteModal}
        onClose={() => setShowCompleteModal(false)}
        groupId={id}
        currentGroupName={journal?.group?.name ?? ''}
        currentCourseId={journal?.group?.courseId ?? ''}
        onSuccess={(result) => {
          const coursePart = result.targetCourseName ? ` (${result.targetCourseName} kursi)` : ''
          alert(
            `Tugatildi!\n• ${result.certificatesGenerated} ta sertifikat yaratildi\n• Yangi guruh ochildi${coursePart}\n• ${result.enrolledInNew} o'quvchi yangi guruhga qo'shildi`,
          )
          window.location.href = `/admin/classes/${result.newGroupId}`
        }}
      />
    </div>
  )
}

function Info({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: typeof BookOpen
  label: string
  value: string
  /** Raqam/pul/vaqt qiymatlari uchun mono shrift */
  mono?: boolean
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-50 text-slate-400">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <p className={cn('break-words text-sm font-semibold text-slate-700', mono && 'font-mono')}>
          {value}
        </p>
      </div>
    </div>
  )
}

// ============================ O'quv dasturi bo'limi ============================

function CurriculumSection({
  curr, loading, expanded, onToggleLevel, onToggleCover, onChangeRevision, revSaving, nextItemId,
}: {
  curr: GroupCurriculum | null
  loading: boolean
  expanded: Set<string>
  onToggleLevel: (levelId: string) => void
  onToggleCover: (itemId: string, covered: boolean) => void
  onChangeRevision: (delta: number) => void
  revSaving: boolean
  nextItemId: string | null
}) {
  if (loading && !curr) {
    return (
      <Card>
        <Loader label="O'quv dasturi yuklanmoqda..." />
      </Card>
    )
  }
  if (!curr || curr.totalItems === 0 || curr.levels.length === 0) {
    return (
      <Card className="py-10 text-center text-sm text-slate-400">
        Bu guruh kursida o'quv dasturi yo'q.
      </Card>
    )
  }

  const pct = curr.totalItems > 0 ? Math.round((curr.coveredCount / curr.totalItems) * 100) : 0

  return (
    <Card className="p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-brand-600" />
          <h2 className="font-semibold text-slate-800">O'quv dasturi (darsda o'tilgan)</h2>
        </div>
      </div>

      {/* PROGNOZ KARTASI */}
      <div className="border-b border-slate-100 px-4 py-4">
        {/* Progress bar */}
        <div className="mb-4">
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="font-medium text-slate-600">Bajarildi</span>
            <span className="font-mono font-semibold text-brand-700">
              {curr.coveredCount}/{curr.totalItems} · {pct}%
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-brand-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Stat plitalar */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ForecastTile icon={CheckCircle2} label="O'tilgan">
            <span className="font-mono">{curr.coveredCount}</span>
            <span className="text-slate-400">/{curr.totalItems}</span>
          </ForecastTile>
          <ForecastTile icon={Repeat} label="Takrorlash darslari">
            <span className="font-mono">{curr.revisionLessons}</span>
          </ForecastTile>
          <ForecastTile icon={Flag} label="Qolgan">
            <span className="font-mono">{curr.remainingItems}</span> band
          </ForecastTile>
          <ForecastTile icon={CalendarClock} label="Tugatishga">
            <span className="text-slate-500">~</span>
            <span className="font-mono">{curr.estLessonsLeft}</span> dars
            {curr.estFinishDate && (
              <span className="mt-0.5 block text-xs font-normal text-slate-400">
                ≈ {formatDate(curr.estFinishDate)} da tugaydi
              </span>
            )}
          </ForecastTile>
        </div>

        {/* Takrorlash darsi tugmalari */}
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            disabled={revSaving}
            onClick={() => onChangeRevision(1)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-100 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Takrorlash darsi
          </button>
          <button
            type="button"
            disabled={revSaving || curr.revisionLessons <= 0}
            onClick={() => onChangeRevision(-1)}
            title="Oxirgi takrorlash darsini olib tashlash"
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-40"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="text-xs text-slate-400">
            Jami darslar: <span className="font-mono">{curr.totalLessons}</span>
            {curr.lessonsPerWeek > 0 && (
              <> · haftasiga <span className="font-mono">{curr.lessonsPerWeek}</span> dars</>
            )}
          </span>
        </div>
      </div>

      {/* DASTUR DARAXTI — darajalar (default yopiq) */}
      <div className="space-y-3 p-4">
        {curr.levels.map((level) => {
          const levelTotal = level.topics.reduce((s, t) => s + t.items.length, 0)
          const levelCovered = level.topics.reduce(
            (s, t) => s + t.items.filter((it) => it.covered).length,
            0,
          )
          const open = expanded.has(level.id)
          return (
            <div
              key={level.id}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[var(--shadow-1)]"
            >
              {/* Daraja sarlavhasi */}
              <button
                type="button"
                onClick={() => onToggleLevel(level.id)}
                className="flex w-full items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-3 py-2.5 text-left transition-colors hover:bg-slate-100/60"
              >
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-slate-400">
                  {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </span>
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <BookOpen className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">
                  {level.name}
                </span>
                <span
                  className={cn(
                    'flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-medium',
                    levelTotal > 0 && levelCovered === levelTotal
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-slate-100 text-slate-500',
                  )}
                >
                  <span className="font-mono">{levelCovered}/{levelTotal}</span>
                </span>
              </button>

              {open && (
                <div className="p-3">
                  {level.note && <p className="mb-2 px-1 text-xs text-slate-400">{level.note}</p>}
                  {level.topics.length === 0 ? (
                    <p className="px-1 text-xs text-slate-400">Mavzu yo'q.</p>
                  ) : (
                    <div className="grid grid-cols-2 items-start gap-4">
                      {level.topics.map((topic) => {
                        const tCovered = topic.items.filter((it) => it.covered).length
                        return (
                          <div
                            key={topic.id}
                            className="h-full rounded-xl border border-slate-200 bg-white p-3 shadow-[var(--shadow-1)]"
                          >
                            <div className="flex items-center gap-2">
                              <h4 className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">
                                {topic.title}
                              </h4>
                              <span className="flex-shrink-0 text-xs text-slate-400">
                                <span className="font-mono">{tCovered}/{topic.items.length}</span> band
                              </span>
                            </div>
                            {topic.note && (
                              <p className="mt-1 text-xs text-slate-400">{topic.note}</p>
                            )}
                            {topic.items.length > 0 && (
                              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                                {topic.items.map((item) => {
                                  const isNext = item.id === nextItemId
                                  return (
                                    <label
                                      key={item.id}
                                      className={cn(
                                        'flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 transition-colors',
                                        item.covered
                                          ? 'bg-emerald-50/50'
                                          : isNext
                                            ? 'bg-brand-50/60 ring-1 ring-brand-200'
                                            : 'hover:bg-slate-50',
                                      )}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={item.covered}
                                        onChange={() => onToggleCover(item.id, !item.covered)}
                                        className="mt-0.5 h-4 w-4 flex-shrink-0 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-400"
                                      />
                                      <span
                                        className={cn(
                                          'min-w-0 flex-1 text-sm',
                                          item.covered
                                            ? 'text-slate-400 line-through'
                                            : 'text-slate-700',
                                        )}
                                      >
                                        {item.text}
                                        {isNext && (
                                          <span className="ml-2 rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-medium text-brand-700 no-underline">
                                            keyingi
                                          </span>
                                        )}
                                      </span>
                                      {item.covered && item.coveredDate && (
                                        <span className="ml-auto flex-shrink-0 self-center whitespace-nowrap rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-mono text-slate-400 no-underline">
                                          {formatDate(item.coveredDate)}
                                        </span>
                                      )}
                                    </label>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function ForecastTile({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof BookOpen
  label: string
  children: ReactNode
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="text-sm font-semibold text-slate-700">{children}</div>
    </div>
  )
}

// ============================ Reyting bo'limi ============================

function RatingsTab({ data, loading }: { data: RatingMonthData[]; loading: boolean }) {
  if (loading) {
    return <Loader label="Reyting yuklanmoqda..." />
  }

  // Faqat baholash ma'lumoti bor va o'quvchisi bor oylar hisobga olinadi.
  const validEntries = data.filter((d) => d.grading && d.grading.students.length > 0)

  if (validEntries.length === 0) {
    return (
      <Card className="rounded-lg border border-slate-200 bg-white py-12 px-4 text-center text-slate-400">
        <TrendingUp className="mx-auto mb-3 h-8 w-8 opacity-40" />
        <p>Baholash mezonlari topilmadi yoki o'quvchi yo'q.</p>
      </Card>
    )
  }

  // O'quvchilar — tanlangan oylardagi grading.students UNIONi (fullName oxirgi uchragan qiymat).
  const studentNames = new Map<string, string>()
  for (const { grading } of validEntries) {
    for (const s of grading!.students) studentNames.set(s.studentId, s.fullName)
  }

  // Mezonlar — tanlangan oylar criteria UNIONi (order bo'yicha saralab).
  const criteriaById = new Map<string, GradingBoardCriterion>()
  for (const { grading } of validEntries) {
    for (const c of grading!.criteria) if (!criteriaById.has(c.id)) criteriaById.set(c.id, c)
  }
  const criteria = Array.from(criteriaById.values()).sort((a, b) => a.order - b.order)

  // Umumiy imkoniyat — barcha o'quvchiga bir xil, tanlangan oylar (dates × criteria) yig'indisi.
  let totalPossible = 0
  for (const { grading } of validEntries) {
    if (grading) totalPossible += grading.dates.length * grading.criteria.length
  }

  // Har o'quvchi uchun statistikani hisoblash — tanlangan OYLAR bo'yicha yig'indi (agregat).
  const studentStats = Array.from(studentNames.entries())
    .map(([studentId, fullName]) => {
      let journalTotal = 0
      let done = 0
      const criteriaDoneMap = new Map<string, number>()

      for (const { journal, grading } of validEntries) {
        if (journal) {
          const entryMap = new Map((journal.entries ?? []).map((e) => [`${e.studentId}|${e.date}`, e]))
          for (const col of journal.columns) {
            const e = entryMap.get(`${studentId}|${col.date}`)
            if (e?.grade) journalTotal += e.grade
          }
        }
        if (grading) {
          const gs = grading.students.find((s) => s.studentId === studentId)
          const doneKeys = gs?.doneKeys ?? []
          done += doneKeys.length
          for (const key of doneKeys) {
            const [critId] = key.split('|')
            criteriaDoneMap.set(critId, (criteriaDoneMap.get(critId) ?? 0) + 1)
          }
        }
      }

      const percentage = totalPossible > 0 ? Math.round((done / totalPossible) * 100) : 0
      const criteriaStats = criteria.map((crit) => ({
        criterion: crit,
        done: criteriaDoneMap.get(crit.id) ?? 0,
        total: totalCriterionDates(validEntries, crit.id),
      }))

      // Kombindan reyting = jurnal baho + baholash mezonlari yig'indisi
      const combinedRating = journalTotal + done

      return { studentId, fullName, done, totalPossible, percentage, criteriaStats, journalTotal, combinedRating }
    })
    // Kombindan reyting bo'yicha saralash (katta → kichik)
    .sort((a, b) => b.combinedRating - a.combinedRating)

  // O'rtacha bahoni hisoblash
  const avgPercentage =
    studentStats.length > 0
      ? Math.round(studentStats.reduce((s, st) => s + st.percentage, 0) / studentStats.length)
      : 0

  return (
    <div className="space-y-4">
      {/* KPI kartalar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <RatingKpi label="O'rtacha" value={`${avgPercentage}%`} icon={TrendingUp} />
        <RatingKpi
          label="Jami o'quvchi"
          value={String(studentStats.length)}
          icon={Users}
        />
        <RatingKpi
          label="To'liq bajarildi"
          value={String(studentStats.filter((s) => s.percentage === 100).length)}
          icon={CheckCircle2}
        />
        <RatingKpi
          label="Bo'sh"
          value={String(studentStats.filter((s) => s.percentage === 0).length)}
          icon={Flag}
        />
      </div>

      {/* O'quvchilar jadvali */}
      <Card className="rounded-lg border border-slate-200 bg-white p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-slate-100">
                <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                  O'quvchi
                </th>
                <th className="border-b border-slate-200 px-3 py-3 text-center text-xs font-semibold uppercase text-slate-500">
                  Jurnal
                </th>
                <th className="border-b border-slate-200 px-3 py-3 text-center text-xs font-semibold uppercase text-slate-500">
                  Bajarildi
                </th>
                <th className="border-b border-slate-200 px-3 py-3 text-center text-xs font-semibold uppercase text-slate-500">
                  Jami
                </th>
                {criteria.slice(0, 3).map((crit) => (
                  <th
                    key={crit.id}
                    className="border-b border-slate-200 px-3 py-3 text-center text-xs font-semibold uppercase text-slate-500"
                    title={crit.name}
                  >
                    <span className="block max-w-[60px] truncate">{crit.name}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {studentStats.map((stat) => (
                <tr key={stat.studentId} className="border-b border-slate-200 hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-800">
                    {stat.fullName}
                  </td>
                  <td className="px-3 py-3 text-center text-sm font-semibold text-slate-800">
                    <span className="font-mono">{stat.journalTotal}</span>
                  </td>
                  <td className="px-3 py-3 text-center text-sm font-semibold text-slate-800">
                    <span className="font-mono">{stat.done}</span>
                    <span className="text-slate-400">/{stat.totalPossible}</span>
                  </td>
                  <td className="px-3 py-3 text-center text-sm font-bold text-slate-800">
                    <span className={cn('inline-flex h-8 w-8 items-center justify-center rounded-md font-semibold', stat.combinedRating > 0 ? 'bg-violet-100 text-violet-700' : 'text-slate-400')}>
                      {stat.combinedRating || '—'}
                    </span>
                  </td>
                  {stat.criteriaStats.slice(0, 3).map((cs) => (
                    <td
                      key={cs.criterion.id}
                      className="px-3 py-3 text-center text-sm font-semibold text-slate-800"
                    >
                      <span className="font-mono text-brand-600">{cs.done}</span>
                      <span className="text-slate-400">/{cs.total}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Mezonlar bo'yicha detallar (agar ko'p bo'lsa) — tanlangan oylar bo'yicha agregat */}
      {criteria.length > 3 && (
        <Card className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="mb-4 font-semibold text-slate-800">Mezonlar bo'yicha tahlil</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {criteria.map((crit) => {
              let totalDone = 0
              let denom = 0
              for (const { grading } of validEntries) {
                if (!grading || !grading.criteria.some((c) => c.id === crit.id)) continue
                for (const student of grading.students) {
                  for (const key of student.doneKeys) {
                    const [critId] = key.split('|')
                    if (critId === crit.id) totalDone++
                  }
                }
                denom += grading.students.length * grading.dates.length
              }
              const pct = denom > 0 ? Math.round((totalDone / denom) * 100) : 0
              return (
                <div key={crit.id} className="rounded-lg bg-slate-50 p-3">
                  <p className="mb-2 text-sm font-semibold text-slate-800">{crit.name}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-brand-500 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <span className="font-mono text-xs font-semibold text-slate-800 w-10 text-right">{pct}%</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    <span className="font-mono font-semibold">{totalDone}</span> /{" "}
                    {denom}
                  </p>
                </div>
              )
            })}
          </div>
        </Card>
      )}

    </div>
  )
}

/** Bitta mezon bo'yicha — tanlangan oylardagi jami dars sanalari (mezon mavjud bo'lgan oylar bo'yicha). */
function totalCriterionDates(entries: RatingMonthData[], criterionId: string): number {
  let total = 0
  for (const { grading } of entries) {
    if (grading && grading.criteria.some((c) => c.id === criterionId)) total += grading.dates.length
  }
  return total
}

function RatingKpi({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: typeof Users
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="text-lg font-semibold text-slate-800">{value}</div>
    </div>
  )
}
