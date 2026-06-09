import { useEffect, useMemo, useRef, useState } from 'react'
import { NotebookText, Check, Download, Upload } from 'lucide-react'
import type {
  AbsenceReason,
  JournalColumn,
  JournalEntry,
  JournalTopic,
  Group,
  ScheduleTemplate,
  Student,
  Subject,
} from '@/types'
import { getClasses } from '@/api/services/classes'
import { getSubjects } from '@/api/services/subjects'
import { getStudents } from '@/api/services/students'
import { getTemplates } from '@/api/services/scheduleTemplates'
import { getSettings } from '@/api/services/settings'
import {
  getJournalColumns,
  getJournalEntries,
  setJournalEntry,
  clearJournalEntry,
  getLessonNotes,
  setLessonNote,
  downloadTopicsTemplate,
  importTopics,
  type TopicImportResult,
} from '@/api/services/journal'
import { getCurrentQuarterAndWeek } from '@/lib/weeks'
import { formatDate, cn } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Loader } from '@/components/ui/Loader'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { JournalCellModal } from './JournalCellModal'

const control =
  'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-brand-400'

const weekdayShort = (iso: string) =>
  ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'][new Date(iso).getDay()] ?? ''

function gradeColor(g: number): string {
  if (g >= 5) return 'text-emerald-600'
  if (g === 4) return 'text-brand-600'
  if (g === 3) return 'text-amber-600'
  return 'text-red-600'
}

function avgColor(g: number): string {
  if (g >= 4.5) return 'text-emerald-600'
  if (g >= 3.5) return 'text-brand-600'
  if (g >= 2.5) return 'text-amber-600'
  return 'text-red-600'
}

export function JournalPage() {
  const [classes, setClasses] = useState<Group[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([])
  const [reasons, setReasons] = useState<AbsenceReason[]>([])
  const [loading, setLoading] = useState(true)

  const [classId, setClassId] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [quarter, setQuarter] = useState(1)

  const [columns, setColumns] = useState<JournalColumn[]>([])
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [topics, setTopics] = useState<JournalTopic[]>([])
  const [dataLoading, setDataLoading] = useState(false)

  const [editing, setEditing] = useState<{ student: Student; date: string; period: number } | null>(
    null,
  )

  // Mavzularni Excel'dan yuklash.
  const fileRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<TopicImportResult | null>(null)

  const onDownloadTemplate = async () => {
    if (!classId || !subjectId) return
    try {
      await downloadTopicsTemplate(classId, subjectId, quarter)
    } catch {
      alert("Shablonni yuklab bo'lmadi")
    }
  }
  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f || !classId || !subjectId) return
    setImporting(true)
    try {
      const res = await importTopics(f, classId, subjectId, quarter)
      setImportResult(res)
      setTopics(await getLessonNotes(classId, subjectId, quarter))
    } catch (err) {
      alert((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Import xatosi')
    } finally {
      setImporting(false)
    }
  }

  useEffect(() => {
    Promise.all([getClasses(), getSubjects(), getStudents(), getSettings()])
      .then(([cl, subs, st, settings]) => {
        setClasses(cl)
        setSubjects(subs)
        setStudents(st)
        setReasons(settings.absenceReasons)
        setClassId(cl[0]?.id ?? '')
        const { quarter: q } = getCurrentQuarterAndWeek(settings.quarters)
        setQuarter(q)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!classId) return
    getTemplates(classId).then((tpls) => {
      setTemplates(tpls)
      const ids = [...new Set(tpls.flatMap((t) => t.lessons.map((l) => l.subjectId)))]
      setSubjectId(ids[0] ?? '')
    })
  }, [classId])

  useEffect(() => {
    if (!classId || !subjectId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- tanlov bo'sh bo'lganda jadvalni tozalaymiz (maqsadli)
      setColumns([])
      setEntries([])
      setTopics([])
      return
    }
    setDataLoading(true)
    Promise.all([
      getJournalColumns(classId, subjectId, quarter),
      getJournalEntries(classId, subjectId, quarter),
      getLessonNotes(classId, subjectId, quarter),
    ])
      .then(([cols, ents, tps]) => {
        setColumns(cols)
        setEntries(ents)
        setTopics(tps)
      })
      .finally(() => setDataLoading(false))
  }, [classId, subjectId, quarter])

  const selectedClass = classes.find((c) => c.id === classId) ?? null
  const classStudents = selectedClass
    ? students.filter((s) => s.className === selectedClass.name)
    : []

  const classSubjects = useMemo(() => {
    const ids = [...new Set(templates.flatMap((t) => t.lessons.map((l) => l.subjectId)))]
    return ids
      .map((id) => subjects.find((s) => s.id === id))
      .filter((s): s is Subject => Boolean(s))
  }, [templates, subjects])

  const entryFor = (studentId: string, date: string, period: number) =>
    entries.find((e) => e.studentId === studentId && e.date === date && e.period === period) ?? null
  const reasonShort = (rid: string) => reasons.find((r) => r.id === rid)?.short ?? '?'
  const reasonIsLate = (rid: string) => reasons.find((r) => r.id === rid)?.isLate ?? false
  const topicFor = (date: string, period: number) =>
    topics.find((t) => t.date === date && t.period === period)?.topic ?? ''
  const homeworkFor = (date: string, period: number) =>
    topics.find((t) => t.date === date && t.period === period)?.homework ?? ''
  const conductedFor = (date: string, period: number) =>
    topics.find((t) => t.date === date && t.period === period)?.conducted ?? false

  const studentAvg = (studentId: string): number | null => {
    const vals = columns
      .map((c) => entryFor(studentId, c.date, c.period)?.grade)
      .filter((g): g is number => g != null)
    if (!vals.length) return null
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
  }

  const upsertLocal = (
    studentId: string,
    date: string,
    period: number,
    payload: Partial<JournalEntry>,
  ) =>
    setEntries((prev) => [
      ...prev.filter((e) => !(e.studentId === studentId && e.date === date && e.period === period)),
      { studentId, date, period, ...payload },
    ])

  // Baho/davomat kiritilganda shu darsni "o'tildi" deb mahalliy belgilaymiz (backend ham auto-belgilaydi).
  const markConductedLocal = (date: string, period: number) =>
    setTopics((prev) => {
      const existing = prev.find((t) => t.date === date && t.period === period)
      if (existing?.conducted) return prev
      const merged: JournalTopic = {
        date,
        period,
        topic: existing?.topic ?? '',
        homework: existing?.homework ?? '',
        conducted: true,
      }
      return [...prev.filter((t) => !(t.date === date && t.period === period)), merged]
    })

  // Baho va davomat sababini birga saqlaymiz (ikkalasi ham bo'sh bo'lsa — katakni tozalaymiz).
  const handleSaveCell = (
    grade: number | null,
    reasonId: string | null,
    homework: number,
    behavior: number,
    mastery: number | null,
  ) => {
    if (!editing) return
    const { student, date, period } = editing
    if (grade == null && reasonId == null && homework === 0 && behavior === 0 && mastery == null) {
      setEntries((prev) =>
        prev.filter((e) => !(e.studentId === student.id && e.date === date && e.period === period)),
      )
      clearJournalEntry(classId, subjectId, quarter, student.id, date, period)
    } else {
      upsertLocal(student.id, date, period, {
        grade: grade ?? undefined,
        reasonId: reasonId ?? undefined,
        homework,
        behavior,
        mastery,
      })
      markConductedLocal(date, period)
      setJournalEntry(classId, subjectId, quarter, student.id, date, period, {
        grade,
        reasonId,
        homework,
        behavior,
        mastery,
      })
    }
    setEditing(null)
  }

  const handleClearCell = () => {
    if (!editing) return
    const { student, date, period } = editing
    setEntries((prev) =>
      prev.filter((e) => !(e.studentId === student.id && e.date === date && e.period === period)),
    )
    clearJournalEntry(classId, subjectId, quarter, student.id, date, period)
    setEditing(null)
  }

  const handleNoteChange = (
    date: string,
    period: number,
    field: 'topic' | 'homework',
    value: string,
  ) =>
    setTopics((prev) => {
      const existing = prev.find((t) => t.date === date && t.period === period)
      const merged: JournalTopic = {
        date,
        period,
        topic: existing?.topic ?? '',
        homework: existing?.homework ?? '',
        conducted: existing?.conducted ?? false,
        [field]: value,
      }
      return [...prev.filter((t) => !(t.date === date && t.period === period)), merged]
    })

  const handleNoteBlur = (date: string, period: number) =>
    setLessonNote(
      classId,
      subjectId,
      quarter,
      date,
      period,
      topicFor(date, period),
      homeworkFor(date, period),
      conductedFor(date, period),
    )

  // "Dars o'tildi" ptichkasini almashtirish (mavzu/uyga vazifa saqlanadi)
  const handleToggleConducted = (date: string, period: number) => {
    const next = !conductedFor(date, period)
    setTopics((prev) => {
      const existing = prev.find((t) => t.date === date && t.period === period)
      const merged: JournalTopic = {
        date,
        period,
        topic: existing?.topic ?? '',
        homework: existing?.homework ?? '',
        conducted: next,
      }
      return [...prev.filter((t) => !(t.date === date && t.period === period)), merged]
    })
    setLessonNote(
      classId,
      subjectId,
      quarter,
      date,
      period,
      topicFor(date, period),
      homeworkFor(date, period),
      next,
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Jurnal</h1>
        <p className="text-sm text-slate-400">Baholar, davomat va mavzular</p>
      </div>

      {loading ? (
        <Loader label="Yuklanmoqda..." />
      ) : (
        <>
          {/* Tanlovlar */}
          <div className="flex flex-wrap items-center gap-3">
            <select value={classId} onChange={(e) => setClassId(e.target.value)} className={control}>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}-guruh
                </option>
              ))}
            </select>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className={control}
              disabled={classSubjects.length === 0}
            >
              {classSubjects.length === 0 ? (
                <option value="">Fan yo'q</option>
              ) : (
                classSubjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))
              )}
            </select>
            {reasons.length > 0 && (
              <div className="ml-auto flex flex-wrap items-center gap-2 text-xs text-slate-400">
                {reasons.map((r) => (
                  <span key={r.id}>
                    <b className="text-slate-600">{r.short}</b> — {r.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Mavzularni Excel'dan ommaviy yuklash — guruh+fan tanlangan bo'lsa */}
          {classSubjects.length > 0 && subjectId && (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" onClick={onDownloadTemplate}>
                <Download className="h-4 w-4" /> Mavzular shabloni
              </Button>
              <Button onClick={() => fileRef.current?.click()} disabled={importing}>
                <Upload className="h-4 w-4" /> {importing ? 'Yuklanmoqda...' : "Excel'dan yuklash"}
              </Button>
              <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={onImportFile} />
              <span className="text-xs text-slate-400">
                Mavzu va uy vazifani to'ldiradi — darsni "o'tilgan" qilmaydi.
              </span>
            </div>
          )}

          {dataLoading ? (
            <Loader label="Yuklanmoqda..." />
          ) : classSubjects.length === 0 ? (
            <Card>
              <p className="py-8 text-center text-slate-400">
                Bu guruhda fanlar yo'q — avval dars jadvali yarating
              </p>
            </Card>
          ) : columns.length === 0 ? (
            <Card>
              <p className="py-8 text-center text-slate-400">
                Bu fan uchun dars sanalari yo'q — haftalarga jadval biriktiring
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:items-start">
              {/* Baholar jadvali (2/3) */}
              <Card className="min-w-0 p-0 xl:col-span-2">
                <div className="overflow-x-auto">
                  <table className="w-full border-separate border-spacing-0 text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-slate-400">
                        <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left text-xs font-medium uppercase">
                          F.I.SH
                        </th>
                        {columns.map((c) => (
                          <th key={`${c.date}-${c.period}`} className="px-1 py-2 text-center">
                            <div className="text-[10px] font-normal text-slate-400">
                              {weekdayShort(c.date)}
                            </div>
                            <div className="text-xs font-medium text-slate-500">
                              {formatDate(c.date).slice(0, 5)}
                            </div>
                            <div className="text-[10px] text-slate-400">{c.period}-dars</div>
                            <button
                              type="button"
                              onClick={() => handleToggleConducted(c.date, c.period)}
                              title={conductedFor(c.date, c.period) ? "Dars o'tildi" : "Dars o'tilmadi"}
                              className={cn(
                                'mx-auto mt-1 flex h-5 w-5 items-center justify-center rounded transition-colors',
                                conductedFor(c.date, c.period)
                                  ? 'bg-emerald-100 text-emerald-600'
                                  : 'bg-slate-100 text-slate-300 hover:text-slate-400',
                              )}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          </th>
                        ))}
                        <th className="px-3 py-2 text-center text-xs font-medium uppercase">
                          O'rtacha
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {classStudents.map((s) => {
                        const avg = studentAvg(s.id)
                        return (
                          <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50/40">
                            <td className="sticky left-0 z-10 bg-white px-3 py-1.5 font-medium text-slate-800">
                              {s.fullName}
                            </td>
                            {columns.map((c) => {
                              const entry = entryFor(s.id, c.date, c.period)
                              return (
                                <td key={`${c.date}-${c.period}`} className="px-1 py-1 text-center">
                                  {(() => {
                                    const late = entry?.reasonId ? reasonIsLate(entry.reasonId) : false
                                    return (
                                      <button
                                        type="button"
                                        onClick={() => setEditing({ student: s, date: c.date, period: c.period })}
                                        className={cn(
                                          'relative flex h-9 w-11 items-center justify-center rounded-md border text-sm font-semibold transition-colors',
                                          entry?.grade != null
                                            ? late
                                              ? 'border-amber-300 bg-amber-50'
                                              : 'border-slate-200 bg-white'
                                            : entry?.reasonId
                                              ? late
                                                ? 'border-amber-200 bg-amber-50'
                                                : 'border-red-200 bg-red-50'
                                              : 'border-slate-200 bg-slate-50 hover:border-brand-300 hover:bg-brand-50',
                                        )}
                                        title={entry?.reasonId ? reasonShort(entry.reasonId) : undefined}
                                      >
                                        {entry?.grade != null ? (
                                          <span className={gradeColor(entry.grade)}>{entry.grade}</span>
                                        ) : entry?.reasonId ? (
                                          <span
                                            className={cn(
                                              'text-xs font-medium',
                                              late ? 'text-amber-600' : 'text-red-600',
                                            )}
                                          >
                                            {reasonShort(entry.reasonId)}
                                          </span>
                                        ) : null}
                                        {/* Baho + kech kelgan bo'lsa — kichik sariq belgi */}
                                        {entry?.grade != null && late && (
                                          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-400" />
                                        )}
                                        {/* Uyga vazifa: chap-past (yashil=qildi, qizil=qilmadi) */}
                                        {entry?.homework ? (
                                          <span
                                            title={entry.homework === 1 ? 'Uy vazifa: qildi' : 'Uy vazifa: qilmadi'}
                                            className={cn(
                                              'absolute -bottom-0.5 -left-0.5 h-2 w-2 rounded-sm',
                                              entry.homework === 1 ? 'bg-emerald-500' : 'bg-red-500',
                                            )}
                                          />
                                        ) : null}
                                        {/* Xulq: o'ng-past (yashil=yaxshi, qizil=yomon) */}
                                        {entry?.behavior ? (
                                          <span
                                            title={entry.behavior === 1 ? 'Xulq: yaxshi' : 'Xulq: yomon'}
                                            className={cn(
                                              'absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full',
                                              entry.behavior === 1 ? 'bg-emerald-500' : 'bg-red-500',
                                            )}
                                          />
                                        ) : null}
                                        {/* O'zlashtirish foizi — katak ichida pastda */}
                                        {entry?.mastery != null && (
                                          <span
                                            title={`O'zlashtirish: ${entry.mastery}%`}
                                            className="absolute inset-x-0 bottom-0 text-center text-[8px] font-semibold leading-none text-brand-600"
                                          >
                                            {entry.mastery}%
                                          </span>
                                        )}
                                      </button>
                                    )
                                  })()}
                                </td>
                              )
                            })}
                            <td className="px-3 py-1.5 text-center">
                              {avg != null ? (
                                <span className={cn('text-sm font-semibold', avgColor(avg))}>
                                  {avg.toFixed(1)}
                                </span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                      {classStudents.length === 0 && (
                        <tr>
                          <td
                            colSpan={columns.length + 2}
                            className="px-4 py-10 text-center text-slate-400"
                          >
                            Bu guruhda o'quvchilar yo'q
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Mavzu va uyga vazifa (1/3) */}
              <Card className="xl:col-span-1">
                <div className="mb-3 flex items-center gap-2">
                  <NotebookText className="h-4 w-4 text-brand-600" />
                  <h2 className="font-semibold text-slate-800">Mavzu va uyga vazifa</h2>
                </div>
                <div className="max-h-[34rem] space-y-3 overflow-y-auto pr-1">
                  {columns.map((c) => (
                    <div key={`${c.date}-${c.period}`} className="rounded-xl border border-slate-100 p-2.5">
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-500">
                          {weekdayShort(c.date)}, {formatDate(c.date).slice(0, 5)} · {c.period}-dars
                        </span>
                        <label
                          className={cn(
                            'flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium',
                            conductedFor(c.date, c.period) ? 'text-emerald-600' : 'text-slate-400',
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={conductedFor(c.date, c.period)}
                            onChange={() => handleToggleConducted(c.date, c.period)}
                            className="h-3.5 w-3.5 accent-emerald-600"
                          />
                          {conductedFor(c.date, c.period) ? "Dars o'tildi" : "Dars o'tilmadi"}
                        </label>
                      </div>
                      <input
                        value={topicFor(c.date, c.period)}
                        onChange={(e) => handleNoteChange(c.date, c.period, 'topic', e.target.value)}
                        onBlur={() => handleNoteBlur(c.date, c.period)}
                        placeholder="Mavzu..."
                        className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-400"
                      />
                      <input
                        value={homeworkFor(c.date, c.period)}
                        onChange={(e) => handleNoteChange(c.date, c.period, 'homework', e.target.value)}
                        onBlur={() => handleNoteBlur(c.date, c.period)}
                        placeholder="Uyga vazifa..."
                        className="mt-1.5 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-400"
                      />
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </>
      )}

      <JournalCellModal
        open={!!editing}
        studentName={editing?.student.fullName ?? ''}
        dateLabel={editing ? `${formatDate(editing.date)} · ${editing.period}-dars` : ''}
        entry={editing ? entryFor(editing.student.id, editing.date, editing.period) : null}
        reasons={reasons}
        onClose={() => setEditing(null)}
        onSave={handleSaveCell}
        onClear={handleClearCell}
      />

      <Modal
        open={!!importResult}
        onClose={() => setImportResult(null)}
        title="Mavzular import natijasi"
        footer={<Button onClick={() => setImportResult(null)}>Yopish</Button>}
      >
        {importResult && (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-4">
              <span className="font-semibold text-emerald-600">{importResult.imported} ta to'ldirildi</span>
              <span className="text-slate-400">{importResult.skipped} ta bo'sh (o'tkazib yuborildi)</span>
              {importResult.errors > 0 && (
                <span className="font-semibold text-red-600">{importResult.errors} ta xato</span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Eslatma: import faqat mavzu va uy vazifani to'ldirdi — darslar "o'tilgan" deb belgilanmadi.
            </p>
            {importResult.rowErrors.length > 0 && (
              <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-100">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-400">
                    <tr>
                      <th className="px-3 py-1.5">Qator</th>
                      <th className="px-3 py-1.5">Sabab</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {importResult.rowErrors.map((er) => (
                      <tr key={er.row}>
                        <td className="px-3 py-1.5 text-slate-500">{er.row}</td>
                        <td className="px-3 py-1.5 text-red-600">{er.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
