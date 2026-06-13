import { useEffect, useMemo, useState } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  ClipboardCheck,
  Paperclip,
  ListChecks,
  Users,
  Clock,
  FileText,
  Video,
} from 'lucide-react'
import type { Assignment, AssignmentFormat, Subject, TeacherClass } from '@/types'
import {
  getMyClasses,
  getTeacherAssignments,
  createTeacherAssignment,
  updateTeacherAssignment,
  uploadTeacherFile,
  deleteTeacherAssignment,
  getTeacherAssignmentResults,
  setTeacherSubmission,
} from '@/api/services/teacher'
import { formatDateTime } from '@/lib/utils'
import { Loader } from '@/components/ui/Loader'
import { SubmissionsModal } from '@/components/assignments/SubmissionsModal'
import { AssignmentWizard } from '@/components/assignments/AssignmentWizard'

const formatLabel: Record<AssignmentFormat, string> = {
  written: 'Yozma',
  file: 'Fayl',
  test: 'Test',
  video: 'Video',
}

// Har bir format uchun ikona + rang (teal dizayn — teacher.html dagi kabi).
const formatMeta: Record<AssignmentFormat, { icon: typeof ClipboardCheck; color: string; soft: string }> = {
  test: { icon: ClipboardCheck, color: 'text-teal-600', soft: 'bg-tealsoft' },
  written: { icon: Pencil, color: 'text-sky-500', soft: 'bg-sky-50' },
  file: { icon: Paperclip, color: 'text-violet-600', soft: 'bg-violet-50' },
  video: { icon: Video, color: 'text-pink-600', soft: 'bg-pink-50' },
}

export function TeacherAssignmentsPage() {
  const [classes, setClasses] = useState<TeacherClass[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [editing, setEditing] = useState<Assignment | null>(null)
  const [resultsFor, setResultsFor] = useState<Assignment | null>(null)
  // Format filtri (faqat ko'rinishni filtrlaydi — API/logikaga tegmaydi)
  const [fmtFilter, setFmtFilter] = useState<AssignmentFormat | 'all'>('all')

  const load = () => getTeacherAssignments().then(setAssignments)

  useEffect(() => {
    Promise.all([getMyClasses(), getTeacherAssignments()])
      .then(([cl, asg]) => {
        setClasses(cl)
        setAssignments(asg)
      })
      .finally(() => setLoading(false))
  }, [])

  // Fanlar — dars beradigan sinflardagi fanlar birlashmasi (takrorsiz).
  const subjects = useMemo<Subject[]>(() => {
    const map = new Map<string, Subject>()
    classes.forEach((c) => c.subjects.forEach((s) => map.set(s.id, s)))
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [classes])

  // Format bo'yicha sanoq (chip badge uchun) + filtrlangan ro'yxat.
  const fmtCounts = useMemo(() => {
    const c: Record<AssignmentFormat, number> = { written: 0, file: 0, test: 0, video: 0 }
    assignments.forEach((a) => {
      c[a.format] += 1
    })
    return c
  }, [assignments])

  const visible = useMemo(
    () => (fmtFilter === 'all' ? assignments : assignments.filter((a) => a.format === fmtFilter)),
    [assignments, fmtFilter],
  )

  const openNew = () => {
    setEditing(null)
    setWizardOpen(true)
  }
  const openEdit = (a: Assignment) => {
    setEditing(a)
    setWizardOpen(true)
  }
  const handleDelete = async (a: Assignment) => {
    if (!confirm(`"${a.title}" topshirig'ini o'chirasizmi?`)) return
    await deleteTeacherAssignment(a.id)
    setAssignments((prev) => prev.filter((x) => x.id !== a.id))
  }

  const chips: { key: AssignmentFormat | 'all'; label: string; count: number }[] = [
    { key: 'all', label: 'Hammasi', count: assignments.length },
    { key: 'test', label: 'Test', count: fmtCounts.test },
    { key: 'written', label: 'Yozma', count: fmtCounts.written },
    { key: 'file', label: 'Fayl', count: fmtCounts.file },
    { key: 'video', label: 'Video', count: fmtCounts.video },
  ]

  return (
    <div className="relative min-h-full bg-paper">
      {/* Ekran sarlavhasi (shell global headeri olib tashlangan) */}
      <div className="px-4 pt-3">
        <p className="text-[22px] font-extrabold tracking-tight text-ink">Topshiriqlar</p>
        <p className="text-[12px] text-mute">
          <span className="font-mono">{assignments.length}</span> ta faol
        </p>
      </div>

      {/* Format chiplari */}
      {!loading && classes.length > 0 && assignments.length > 0 && (
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 py-3">
          {chips.map((ch) => {
            const active = fmtFilter === ch.key
            return (
              <button
                key={ch.key}
                type="button"
                onClick={() => setFmtFilter(ch.key)}
                className={
                  active
                    ? 'tap-scale flex shrink-0 items-center gap-1.5 rounded-full bg-teal-600 px-3 py-2 text-[13px] font-semibold text-white'
                    : 'tap-scale flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-white px-3 py-2 text-[13px] font-semibold text-ink'
                }
              >
                {ch.label}
                <span
                  className={
                    active
                      ? 'rounded-lg bg-white/25 px-1.5 font-mono text-[10px] font-extrabold text-white'
                      : 'rounded-lg bg-panel3 px-1.5 font-mono text-[10px] font-extrabold text-mute'
                  }
                >
                  {ch.count}
                </span>
              </button>
            )
          })}
        </div>
      )}

      <div className="px-4 pb-24 pt-1">
        {loading ? (
          <div className="rounded-[20px] border border-line bg-white p-6 shadow-[var(--shadow-card)]">
            <Loader label="Yuklanmoqda..." />
          </div>
        ) : classes.length === 0 ? (
          <div className="rounded-[20px] border border-line bg-white p-8 text-center shadow-[var(--shadow-card)]">
            <h4 className="text-[15px] font-bold text-ink">Guruh/fan yo'q</h4>
            <p className="mt-1 text-[13px] text-mute">Sizga biriktirilgan guruh/fan yo'q.</p>
          </div>
        ) : assignments.length === 0 ? (
          <div className="rounded-[20px] border border-line bg-white p-8 text-center shadow-[var(--shadow-card)]">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-tealsoft text-teal-600">
              <ClipboardCheck className="h-6 w-6" />
            </div>
            <h4 className="text-[15px] font-bold text-ink">Hali topshiriq yo'q</h4>
            <p className="mt-1 text-[13px] text-mute">"+" tugmasi orqali yarating.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map((a) => {
              const meta = formatMeta[a.format]
              const Icon = meta.icon
              const overdue = a.dueDate ? new Date(a.dueDate).getTime() < Date.now() : false
              return (
                <div
                  key={a.id}
                  className="rounded-[20px] border border-line bg-white p-4 shadow-[var(--shadow-card)]"
                >
                  {/* Yuqori qator: format ikonasi + sarlavha + amallar */}
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${meta.soft} ${meta.color}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 text-[10px] font-bold tracking-wide">
                        <span className={`uppercase ${meta.color}`}>{formatLabel[a.format]}</span>
                        {a.subjectName && (
                          <>
                            <span className="text-faint">·</span>
                            <span className="text-[11px] font-semibold text-mute">{a.subjectName}</span>
                          </>
                        )}
                      </div>
                      <p className="mt-0.5 text-[15px] font-bold leading-snug text-ink">{a.title}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        title="Tahrirlash"
                        onClick={() => openEdit(a)}
                        className="rounded-lg p-1.5 text-faint transition-colors hover:bg-panel3 hover:text-ink"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="O'chirish"
                        onClick={() => handleDelete(a)}
                        className="rounded-lg p-1.5 text-faint transition-colors hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Sinf chiplari */}
                  {a.classNames.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {a.classNames.map((n) => (
                        <span
                          key={n}
                          className="rounded-lg bg-chip px-2.5 py-1 text-[12px] font-semibold text-ink"
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                  )}

                  {a.description.trim() && (
                    <p className="mt-3 line-clamp-2 whitespace-pre-wrap text-[13px] text-mute">
                      {a.description}
                    </p>
                  )}

                  {/* Ma'lumot qutisi (soft panel) — material/savol/maks ball */}
                  <div className="mt-3 rounded-xl border border-line bg-panel2 p-3">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-mute">
                      {a.format === 'test' && (
                        <span className="inline-flex items-center gap-1">
                          <ListChecks className="h-3.5 w-3.5" />
                          <span className="font-mono font-bold text-ink">{a.questions.length}</span> savol
                        </span>
                      )}
                      {a.materials.length > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <FileText className="h-3.5 w-3.5" />
                          <span className="font-mono font-bold text-ink">{a.materials.length}</span> material
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        Maks: <span className="font-mono font-bold text-ink">{a.maxScore}</span> ball
                      </span>
                    </div>
                  </div>

                  {/* Pastki qator: muddat + "kim bajardi" */}
                  <div className="mt-3 flex items-center gap-2 border-t border-line-soft pt-3">
                    <div className="flex flex-1 items-center gap-1.5">
                      <Clock className={`h-3.5 w-3.5 ${overdue ? 'text-red-500' : 'text-mute'}`} />
                      <span
                        className={`text-[11px] font-semibold ${overdue ? 'text-red-500' : 'text-mute'}`}
                      >
                        {a.dueDate ? (
                          <span className="font-mono">{formatDateTime(a.dueDate)}</span>
                        ) : (
                          "Muddat yo'q"
                        )}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setResultsFor(a)}
                      className="tap-scale inline-flex items-center gap-1.5 rounded-lg bg-tealsoft px-3 py-1.5 text-[13px] font-semibold text-teal-700"
                    >
                      <Users className="h-4 w-4" /> Kim bajardi
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Yangi topshiriq — FAB */}
      {!loading && classes.length > 0 && (
        <button
          type="button"
          onClick={openNew}
          title="Yangi topshiriq"
          className="tap-scale fixed bottom-6 right-5 z-20 flex h-[60px] w-[60px] items-center justify-center rounded-3xl bg-teal-600 text-white shadow-[var(--shadow-fab)]"
        >
          <Plus className="h-7 w-7" />
        </button>
      )}

      <AssignmentWizard
        open={wizardOpen}
        onClose={() => {
          setWizardOpen(false)
          setEditing(null)
        }}
        onSaved={load}
        classes={classes.map((c) => ({ id: c.classId, name: c.className }))}
        subjects={subjects}
        initial={editing}
        onSubmit={async (input, id) => {
          if (id) await updateTeacherAssignment(id, input)
          else await createTeacherAssignment(input)
        }}
        onUpload={uploadTeacherFile}
      />

      <SubmissionsModal
        open={!!resultsFor}
        onClose={() => setResultsFor(null)}
        title={resultsFor ? `${resultsFor.title} — kim bajardi` : ''}
        fetchResult={() => getTeacherAssignmentResults(resultsFor!.id)}
        onSave={(studentId, completed, score) =>
          setTeacherSubmission(resultsFor!.id, studentId, completed, score)
        }
      />
    </div>
  )
}
