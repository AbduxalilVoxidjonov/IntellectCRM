import { useEffect, useMemo, useState } from 'react'
import {
  ClipboardCheck,
  CalendarClock,
  Paperclip,
  ListChecks,
  Users,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react'
import type { Assignment, AssignmentFormat, Group, Subject } from '@/types'
import { getClasses } from '@/api/services/classes'
import { getSubjects } from '@/api/services/subjects'
import {
  getAssignments,
  getAssignmentResults,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  uploadAdminFile,
  setAdminSubmission,
} from '@/api/services/assignments'
import { formatDate } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { PageHeader } from '@/components/ui/PageHeader'
import { Loader } from '@/components/ui/Loader'
import { Select } from '@/components/ui/Input'
import { SubmissionsModal } from '@/components/assignments/SubmissionsModal'
import { AssignmentWizard } from '@/components/assignments/AssignmentWizard'

const formatLabel: Record<AssignmentFormat, string> = {
  written: 'Yozma',
  file: 'Fayl',
  test: 'Test',
  video: 'Video',
  speaking: 'Speaking',
}

/** Admin "Topshiriqlar" — o'qituvchidek topshiriq yaratadi/tahrirlaydi va BARCHA topshiriqlarni boshqaradi. */
export function AssignmentsPage() {
  const [classes, setClasses] = useState<Group[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [classId, setClassId] = useState('')
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [resultsFor, setResultsFor] = useState<Assignment | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [editing, setEditing] = useState<Assignment | null>(null)

  useEffect(() => {
    Promise.all([getClasses(), getSubjects()]).then(([cl, sb]) => {
      setClasses(cl)
      setSubjects(sb)
    })
  }, [])

  const reload = () =>
    getAssignments(classId || undefined)
      .then(setAssignments)
      .finally(() => setLoading(false))

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- guruh filtri o'zgarganda qayta yuklash (maqsadli)
    setLoading(true)
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- faqat classId o'zgarganda
  }, [classId])

  const wizardClasses = useMemo(() => classes.map((c) => ({ id: c.id, name: c.name })), [classes])

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
    await deleteAssignment(a.id)
    setAssignments((prev) => prev.filter((x) => x.id !== a.id))
  }

  return (
    <div>
      <PageHeader
        title="Topshiriqlar"
        sub="Topshiriq va testlar — yaratish va barchasini boshqarish"
        actions={
          <Button onClick={openNew} disabled={classes.length === 0}>
            <Plus className="h-4 w-4" /> Yangi topshiriq
          </Button>
        }
      />

      <div className="toolbar">
        <div className="left">
          <Select
            className="min-w-[200px]"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
          >
            <option value="">Barcha guruhlar</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {loading ? (
        <Card>
          <Loader label="Yuklanmoqda..." />
        </Card>
      ) : assignments.length === 0 ? (
        <Card>
          <div className="state">
            <div className="state-icon">
              <ClipboardCheck className="h-6 w-6" />
            </div>
            <h4>Topshiriq yo'q</h4>
            <p>Yangi topshiriq qo'shing yoki boshqa guruhni tanlang.</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {assignments.map((a) => (
            <Card key={a.id} className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 shrink-0 text-brand-600" />
                  <p className="font-semibold text-slate-800">{a.title}</p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    title="Tahrirlash"
                    onClick={() => openEdit(a)}
                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title="O'chirish"
                    onClick={() => handleDelete(a)}
                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone="violet">{formatLabel[a.format]}</Badge>
                {a.subjectName && <Badge>{a.subjectName}</Badge>}
                {a.classNames.map((n) => (
                  <Badge key={n}>{n}</Badge>
                ))}
              </div>

              {a.description.trim() && (
                <p className="line-clamp-3 whitespace-pre-wrap text-sm text-slate-600">{a.description}</p>
              )}

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                {a.dueDate && (
                  <span className="inline-flex items-center gap-1 text-amber-600">
                    <CalendarClock className="h-3.5 w-3.5" />
                    <span className="font-mono">{formatDate(a.dueDate)}</span>
                  </span>
                )}
                {a.materials.length > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Paperclip className="h-3.5 w-3.5" />
                    <span className="font-mono">{a.materials.length}</span> material
                  </span>
                )}
                {a.format === 'test' && (
                  <span className="inline-flex items-center gap-1">
                    <ListChecks className="h-3.5 w-3.5" />
                    <span className="font-mono">{a.questions.length}</span> savol
                  </span>
                )}
                <span>
                  Maks: <span className="font-mono text-slate-600">{a.maxScore}</span> ball
                </span>
              </div>

              <button
                type="button"
                onClick={() => setResultsFor(a)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
              >
                <Users className="h-4 w-4" /> Kim bajardi
              </button>
            </Card>
          ))}
        </div>
      )}

      <AssignmentWizard
        open={wizardOpen}
        onClose={() => {
          setWizardOpen(false)
          setEditing(null)
        }}
        onSaved={reload}
        classes={wizardClasses}
        subjects={subjects}
        initial={editing}
        onSubmit={async (input, id) => {
          if (id) await updateAssignment(id, input)
          else await createAssignment(input)
        }}
        onUpload={uploadAdminFile}
      />

      <SubmissionsModal
        open={!!resultsFor}
        onClose={() => setResultsFor(null)}
        title={resultsFor ? `${resultsFor.title} — kim bajardi` : ''}
        fetchResult={() => getAssignmentResults(resultsFor!.id)}
        onSave={(studentId, completed, score) =>
          setAdminSubmission(resultsFor!.id, studentId, completed, score)
        }
      />
    </div>
  )
}
