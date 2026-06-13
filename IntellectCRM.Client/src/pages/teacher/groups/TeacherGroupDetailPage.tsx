import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, Users, BookOpen, User,
  CalendarDays, Clock, MapPin, CheckCircle2,
  ListChecks, ChevronRight, ChevronDown, Plus, Minus, Repeat, CalendarClock, Flag,
} from 'lucide-react'
import type { AbsenceReason } from '@/types'
import {
  getTeacherGroupJournal, setTeacherJournalEntry, clearTeacherJournalEntry, bulkTeacherAttendance,
  getTeacherGroupCurriculum, setTeacherGroupCover, changeTeacherGroupRevision,
  getTeacherMeta,
} from '@/api/services/teacher'
import type { GroupJournal } from '@/api/services/journal'
import type { GroupCurriculum } from '@/api/services/curriculum'
import { cn, formatDate } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Loader } from '@/components/ui/Loader'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { JournalCellModal } from '@/pages/admin/journal/JournalCellModal'

const weekdayShort = ['Du', 'Se', 'Cho', 'Pa', 'Ju', 'Sha', 'Ya']
const uzMonths = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
]
const monthLabel = (m: string) =>
  m && m.length >= 7 ? `${uzMonths[Number(m.slice(5, 7)) - 1] ?? m} ${m.slice(0, 4)}` : m

/** Baho katakchasi to'liq rangi — bahoga qarab (5=yashil, 4=ko'k, 3=sariq, past=qizil). */
function gradeFill(g: number): string {
  return g >= 5
    ? 'bg-emerald-50 text-emerald-700'
    : g >= 4
      ? 'bg-tealsoft text-teal-700'
      : g >= 3
        ? 'bg-amber-50 text-amber-700'
        : 'bg-red-50 text-red-600'
}

export function TeacherGroupDetailPage() {
  const { id = '' } = useParams()
  const [journal, setJournal] = useState<GroupJournal | null>(null)
  const [reasons, setReasons] = useState<AbsenceReason[]>([])
  const [loading, setLoading] = useState(true)
  const [cell, setCell] = useState<{ studentId: string; studentName: string; date: string } | null>(null)
  const [saving, setSaving] = useState(false)
  /** Sarlavhadagi sana bosilganda — shu kun uchun hammaga davomat modali. */
  const [bulkDate, setBulkDate] = useState<string | null>(null)
  const [bulkSaving, setBulkSaving] = useState(false)

  // ---- Guruh o'quv dasturi (darsda o'tilgan) ----
  const [curr, setCurr] = useState<GroupCurriculum | null>(null)
  const [currLoading, setCurrLoading] = useState(true)
  const [currOpen, setCurrOpen] = useState(false)
  const [currExpanded, setCurrExpanded] = useState<Set<string>>(new Set())
  const [revSaving, setRevSaving] = useState(false)

  const loadCurr = useCallback(() => {
    if (!id) return
    setCurrLoading(true)
    getTeacherGroupCurriculum(id)
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
      getTeacherGroupJournal(id, month)
        .then(setJournal)
        .finally(() => setLoading(false))
    },
    [id],
  )

  useEffect(() => {
    load()
    getTeacherMeta()
      .then((m) => setReasons(m?.absenceReasons ?? []))
      .catch(() => {})
  }, [load])

  const reasonById = useMemo(
    () => new Map(reasons.map((r) => [r.id, r])),
    [reasons],
  )
  const entryMap = useMemo(
    () => new Map((journal?.entries ?? []).map((e) => [`${e.studentId}|${e.date}`, e])),
    [journal],
  )
  const conductedSet = useMemo(() => new Set(journal?.conductedDates ?? []), [journal])
  // Muzlatilganlar jurnalga QO'SHILMAYDI — grid'da faqat faol/sinov o'quvchilar.
  const journalStudents = useMemo(
    () => (journal?.students ?? []).filter((s) => s.status !== 'frozen'),
    [journal],
  )

  const g = journal?.group
  const today = new Date().toISOString().slice(0, 10)
  const absentReasons = useMemo(() => reasons.filter((r) => !r.isLate), [reasons])

  const handleSave = async (
    grade: number | null,
    reasonId: string | null,
    homework: number,
    behavior: number,
    mastery: number | null,
  ) => {
    if (!journal || !cell) return
    setSaving(true)
    try {
      await setTeacherJournalEntry(journal.group.id, journal.group.courseId, cell.studentId, cell.date, {
        grade, reasonId, homework, behavior, mastery,
      })
      setCell(null)
      load(journal.month)
    } catch (e: any) {
      alert(e?.response?.data?.message ?? "Saqlab bo'lmadi")
    } finally {
      setSaving(false)
    }
  }

  const handleClear = async () => {
    if (!journal || !cell) return
    setSaving(true)
    try {
      await clearTeacherJournalEntry(journal.group.id, journal.group.courseId, cell.studentId, cell.date)
      setCell(null)
      load(journal.month)
    } catch (e: any) {
      alert(e?.response?.data?.message ?? "Tozalab bo'lmadi")
    } finally {
      setSaving(false)
    }
  }

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

  // Band belgilash — optimistik, so'ng refetch (prognoz aniq qolishi uchun)
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
      await setTeacherGroupCover(id, itemId, covered)
      loadCurr()
    } catch {
      setCurr(prev)
      alert("Saqlab bo'lmadi")
    }
  }

  const changeRevision = async (delta: number) => {
    if (!curr || revSaving) return
    setRevSaving(true)
    try {
      await changeTeacherGroupRevision(id, delta)
      loadCurr()
    } catch {
      alert("Saqlab bo'lmadi")
    } finally {
      setRevSaving(false)
    }
  }

  // Sarlavhadagi sana bosilganda — shu darsdagi BARCHA o'quvchiga birdan davomat.
  const doBulk = async (absent: boolean, reasonId: string | null) => {
    if (!journal || !bulkDate) return
    setBulkSaving(true)
    try {
      await bulkTeacherAttendance(journal.group.id, bulkDate, absent, reasonId)
      setBulkDate(null)
      load(journal.month)
    } catch (e: any) {
      alert(e?.response?.data?.message ?? "Saqlab bo'lmadi")
    } finally {
      setBulkSaving(false)
    }
  }

  const cellEntry = cell ? entryMap.get(`${cell.studentId}|${cell.date}`) ?? null : null

  return (
    <div className="space-y-5 px-4 pt-3 pb-6">
      {/* Sarlavha */}
      <div className="flex items-center gap-3">
        <Link
          to="/teacher"
          className="rounded-[14px] border border-line bg-white p-2 text-mute transition-colors hover:bg-tealsoft hover:text-teal-700"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-extrabold tracking-tight text-ink">{g ? g.name : 'Guruh'}</h1>
          {g && (
            <p className="mt-0.5 truncate text-sm text-faint">
              {g.courseName || 'Kurs biriktirilmagan'}
            </p>
          )}
        </div>
      </div>

      {loading && !journal ? (
        <Loader label="Yuklanmoqda..." />
      ) : !g ? (
        <Card className="rounded-[20px] border border-line bg-white py-16 text-center text-faint shadow-[var(--shadow-card)]">Guruh topilmadi</Card>
      ) : (
        <>
          {/* Guruh ma'lumotlari */}
          <Card className="rounded-[20px] border border-line bg-white shadow-[var(--shadow-card)]">
            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              <Info icon={BookOpen} label="Kurs" value={g.courseName || '—'} />
              <Info icon={User} label="O'qituvchi" value={g.teacherName || '—'} />
              <Info
                icon={CalendarDays}
                label="Kunlar"
                value={g.days.length ? g.days.map((d) => weekdayShort[d] ?? d).join(', ') : '—'}
              />
              <Info
                icon={Clock}
                label="Vaqt"
                value={g.startTime || g.endTime ? `${g.startTime || '—'}${g.endTime ? ` – ${g.endTime}` : ''}` : '—'}
                mono
              />
              <Info icon={MapPin} label="Xona" value={g.room || '—'} />
              <Info icon={Users} label="O'quvchilar" value={String(journalStudents.length)} mono />
            </div>
          </Card>

          {/* Oylik jurnal */}
          <Card className="rounded-[20px] border border-line bg-white p-0 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-2 border-b border-line-soft px-4 py-3">
              <BookOpen className="h-5 w-5 text-teal-600" />
              <h2 className="font-semibold text-ink">Jurnal</h2>
              <span className="inline-flex items-center gap-1 text-sm text-faint">
                <Users className="h-4 w-4" /> {journalStudents.length}
              </span>
            </div>

            {/* Oy navigatsiyasi — gorizontal skroll */}
            {journal && journal.months.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto border-b border-line-soft px-4 py-2.5">
                {journal.months.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => load(m)}
                    title={monthLabel(m)}
                    className={cn(
                      'shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                      journal.month === m
                        ? 'bg-teal-600 text-white'
                        : 'bg-panel3 text-mute hover:bg-tealsoft',
                    )}
                  >
                    {uzMonths[Number(m.slice(5, 7)) - 1] ?? m}
                  </button>
                ))}
              </div>
            )}

            {!g.courseId ? (
              <p className="px-4 py-12 text-center text-sm text-faint">
                Guruhga kurs biriktirilmagan — jurnal yuritib bo'lmaydi.
              </p>
            ) : journalStudents.length === 0 ? (
              <p className="px-4 py-12 text-center text-sm text-faint">
                Bu guruhda faol o'quvchi yo'q.
              </p>
            ) : (journal?.columns.length ?? 0) === 0 ? (
              <p className="px-4 py-12 text-center text-sm text-faint">
                {monthLabel(journal?.month ?? '')} oyida bu guruh kunlariga dars to'g'ri kelmadi.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-panel3 text-xs text-mute">
                      <th className="sticky left-0 z-20 border-b-2 border-r-2 border-line bg-panel3 px-3 py-2.5 text-left font-semibold">
                        O'quvchi
                      </th>
                      {journal!.columns.map((c) => {
                        const dt = new Date(c.date)
                        const wd = (dt.getDay() + 6) % 7
                        const isToday = c.date === today
                        return (
                          <th
                            key={c.date}
                            className={cn(
                              'border-b-2 border-r border-line p-0 text-center font-semibold',
                              isToday ? 'bg-tealsoft text-teal-700' : 'text-mute',
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => setBulkDate(c.date)}
                              title="Shu kun uchun hammaga davomat"
                              className="w-full px-2 py-1.5 transition-colors hover:bg-tealsoft"
                            >
                              <div className="text-sm">{c.date.slice(8, 10)}</div>
                              <div
                                className={cn(
                                  'text-[10px] font-medium',
                                  isToday ? 'text-teal-500' : 'text-faint',
                                )}
                              >
                                {weekdayShort[wd]}
                              </div>
                            </button>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {journalStudents.map((st) => (
                      <tr key={st.studentId} className="bg-white even:bg-panel2">
                        <td className="sticky left-0 z-10 border-b border-r-2 border-line bg-inherit px-3 py-2">
                          <span className="block max-w-[8rem] truncate text-sm font-medium text-ink">
                            {st.fullName}
                          </span>
                        </td>
                        {journal!.columns.map((c) => {
                          const e = entryMap.get(`${st.studentId}|${c.date}`)
                          const reason = e?.reasonId ? reasonById.get(e.reasonId) : undefined
                          const isToday = c.date === today
                          // Keldi (yashil): dars o'tildi + baho yo'q + sabab yo'q.
                          const present = e?.grade == null && !reason && conductedSet.has(c.date)
                          return (
                            <td
                              key={c.date}
                              className={cn(
                                'border-b border-r border-line-soft p-1 text-center',
                                isToday && 'bg-tealsoft',
                              )}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setCell({ studentId: st.studentId, studentName: st.fullName, date: c.date })
                                }
                                className={cn(
                                  'flex h-9 w-full min-w-9 items-center justify-center rounded-md text-sm font-semibold transition-colors',
                                  e?.grade != null
                                    ? gradeFill(e.grade)
                                    : reason
                                      ? reason.isLate
                                        ? 'bg-amber-50 text-amber-700'
                                        : 'bg-red-50 text-red-600'
                                      : present
                                        ? 'bg-emerald-50 text-emerald-600'
                                        : 'text-faint',
                                )}
                                title={`${st.fullName} — ${formatDate(c.date)}`}
                              >
                                {e?.grade != null
                                  ? e.grade
                                  : reason
                                    ? reason.short || reason.name.slice(0, 2)
                                    : present
                                      ? '✓'
                                      : '·'}
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* O'quv dasturi — yig'iladigan (default yopiq) */}
          <CurriculumSection
            curr={curr}
            loading={currLoading}
            open={currOpen}
            onToggleOpen={() => setCurrOpen((v) => !v)}
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
          <p className="text-sm text-mute">
            Shu darsdagi <span className="font-semibold text-ink">{journalStudents.length}</span> o'quvchiga
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
              <p className="mb-2 text-sm font-medium text-mute">Yoki sabab bilan kelmadi:</p>
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
  mono?: boolean
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-tealsoft text-teal-600">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">{label}</p>
        <p className={cn('break-words text-sm font-semibold text-ink', mono && 'font-mono')}>
          {value}
        </p>
      </div>
    </div>
  )
}

// ============================ O'quv dasturi bo'limi ============================

function CurriculumSection({
  curr, loading, open, onToggleOpen, expanded, onToggleLevel, onToggleCover, onChangeRevision, revSaving, nextItemId,
}: {
  curr: GroupCurriculum | null
  loading: boolean
  open: boolean
  onToggleOpen: () => void
  expanded: Set<string>
  onToggleLevel: (levelId: string) => void
  onToggleCover: (itemId: string, covered: boolean) => void
  onChangeRevision: (delta: number) => void
  revSaving: boolean
  nextItemId: string | null
}) {
  const pct =
    curr && curr.totalItems > 0 ? Math.round((curr.coveredCount / curr.totalItems) * 100) : 0

  return (
    <Card className="rounded-[20px] border border-line bg-white p-0 shadow-[var(--shadow-card)]">
      <button
        type="button"
        onClick={onToggleOpen}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <ListChecks className="h-5 w-5 text-teal-600" />
        <h2 className="flex-1 font-semibold text-ink">O'quv dasturi (darsda o'tilgan)</h2>
        {curr && curr.totalItems > 0 && (
          <span className="font-mono text-sm font-semibold text-teal-700">
            {curr.coveredCount}/{curr.totalItems}
          </span>
        )}
        {open ? (
          <ChevronDown className="h-4 w-4 text-faint" />
        ) : (
          <ChevronRight className="h-4 w-4 text-faint" />
        )}
      </button>

      {open && (
        <div className="border-t border-line-soft">
          {loading && !curr ? (
            <div className="px-4 py-6">
              <Loader label="O'quv dasturi yuklanmoqda..." />
            </div>
          ) : !curr || curr.totalItems === 0 || curr.levels.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-faint">
              Bu guruh kursida o'quv dasturi yo'q.
            </p>
          ) : (
            <>
              {/* PROGNOZ KARTASI */}
              <div className="border-b border-line-soft px-4 py-4">
                <div className="mb-4">
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-medium text-mute">Bajarildi</span>
                    <span className="font-mono font-semibold text-teal-700">
                      {curr.coveredCount}/{curr.totalItems} · {pct}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-panel3">
                    <div
                      className="h-full rounded-full bg-teal-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <ForecastTile icon={CheckCircle2} label="O'tilgan">
                    <span className="font-mono">{curr.coveredCount}</span>
                    <span className="text-faint">/{curr.totalItems}</span>
                  </ForecastTile>
                  <ForecastTile icon={Repeat} label="Takrorlash">
                    <span className="font-mono">{curr.revisionLessons}</span>
                  </ForecastTile>
                  <ForecastTile icon={Flag} label="Qolgan">
                    <span className="font-mono">{curr.remainingItems}</span> band
                  </ForecastTile>
                  <ForecastTile icon={CalendarClock} label="Tugatishga">
                    <span className="text-mute">~</span>
                    <span className="font-mono">{curr.estLessonsLeft}</span> dars
                    {curr.estFinishDate && (
                      <span className="mt-0.5 block text-xs font-normal text-faint">
                        ≈ {formatDate(curr.estFinishDate)} da
                      </span>
                    )}
                  </ForecastTile>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={revSaving}
                    onClick={() => onChangeRevision(1)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-tealsoft px-3 py-2 text-sm font-medium text-teal-700 transition-colors hover:bg-teal-100 disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" /> Takrorlash darsi
                  </button>
                  <button
                    type="button"
                    disabled={revSaving || curr.revisionLessons <= 0}
                    onClick={() => onChangeRevision(-1)}
                    title="Oxirgi takrorlash darsini olib tashlash"
                    className="inline-flex items-center justify-center rounded-lg border border-line bg-white p-2 text-mute transition-colors hover:bg-panel2 disabled:opacity-40"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* DASTUR DARAXTI — tekis (ichma-ich kartasiz, to'liq kenglik) */}
              <div className="divide-y divide-line-soft">
                {curr.levels.map((level) => {
                  const levelTotal = level.topics.reduce((s, t) => s + t.items.length, 0)
                  const levelCovered = level.topics.reduce(
                    (s, t) => s + t.items.filter((it) => it.covered).length,
                    0,
                  )
                  const lvOpen = expanded.has(level.id)
                  const complete = levelTotal > 0 && levelCovered === levelTotal
                  return (
                    <div key={level.id}>
                      <button
                        type="button"
                        onClick={() => onToggleLevel(level.id)}
                        className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-panel2"
                      >
                        <span className="shrink-0 text-faint">
                          {lvOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </span>
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-tealsoft text-teal-600">
                          <BookOpen className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                          {level.name}
                        </span>
                        <span
                          className={cn(
                            'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium',
                            complete ? 'bg-emerald-50 text-emerald-700' : 'bg-panel3 text-mute',
                          )}
                        >
                          <span className="font-mono">{levelCovered}/{levelTotal}</span>
                        </span>
                      </button>

                      {lvOpen && (
                        <div className="bg-panel2 pb-1.5">
                          {level.note && <p className="px-4 pb-1 text-xs text-faint">{level.note}</p>}
                          {level.topics.length === 0 ? (
                            <p className="px-4 py-2 text-xs text-faint">Mavzu yo'q.</p>
                          ) : (
                            level.topics.map((topic) => {
                              const tCovered = topic.items.filter((it) => it.covered).length
                              return (
                                <div key={topic.id} className="pt-2">
                                  <div className="flex items-center gap-2 px-4 pb-0.5">
                                    <h4 className="min-w-0 flex-1 truncate text-[11px] font-bold uppercase tracking-wide text-faint">
                                      {topic.title}
                                    </h4>
                                    <span className="shrink-0 text-[11px] text-faint">
                                      <span className="font-mono">{tCovered}/{topic.items.length}</span>
                                    </span>
                                  </div>
                                  {topic.items.map((item) => {
                                    const isNext = item.id === nextItemId
                                    return (
                                      <label
                                        key={item.id}
                                        className={cn(
                                          'flex cursor-pointer items-center gap-2.5 px-4 py-2 transition-colors',
                                          item.covered
                                            ? 'bg-emerald-50/40'
                                            : isNext
                                              ? 'bg-tealsoft'
                                              : 'hover:bg-white',
                                        )}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={item.covered}
                                          onChange={() => onToggleCover(item.id, !item.covered)}
                                          className="h-4 w-4 shrink-0 cursor-pointer rounded border-line text-teal-600 focus:ring-teal-400"
                                        />
                                        <span
                                          className={cn(
                                            'min-w-0 flex-1 text-sm',
                                            item.covered ? 'text-faint line-through' : 'text-ink',
                                          )}
                                        >
                                          {item.text}
                                          {isNext && (
                                            <span className="ml-2 rounded bg-tealsoft px-1.5 py-0.5 text-[10px] font-medium text-teal-700 no-underline">
                                              keyingi
                                            </span>
                                          )}
                                        </span>
                                        {item.covered && item.coveredDate && (
                                          <span className="shrink-0 self-center whitespace-nowrap rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-faint no-underline">
                                            {formatDate(item.coveredDate)}
                                          </span>
                                        )}
                                      </label>
                                    )
                                  })}
                                </div>
                              )
                            })
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}
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
    <div className="rounded-[18px] border border-line bg-white p-3 shadow-[var(--shadow-card)]">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="text-sm font-semibold text-ink">{children}</div>
    </div>
  )
}
