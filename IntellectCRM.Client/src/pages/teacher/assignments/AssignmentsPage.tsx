import { useEffect, useMemo, useState } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  ClipboardCheck,
  CalendarClock,
  Paperclip,
  ListChecks,
  Users,
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
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Loader } from '@/components/ui/Loader'
import { PageHeader } from '@/components/ui/PageHeader'
import { SubmissionsModal } from '@/components/assignments/SubmissionsModal'
import { AssignmentWizard } from '@/components/assignments/AssignmentWizard'

const formatLabel: Record<AssignmentFormat, string> = {
  written: 'Yozma',
  file: 'Fayl',
  test: 'Test',
  video: 'Video',
}

export function TeacherAssignmentsPage() {
  const [classes, setClasses] = useState<TeacherClass[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [editing, setEditing] = useState<Assignment | null>(null)
  const [resultsFor, setResultsFor] = useState<Assignment | null>(null)

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

  return (
    <div>
      <PageHeader
        title="Topshiriqlar"
        sub="O'zingiz yaratgan topshiriq va testlar"
        actions={
          <Button onClick={openNew} disabled={classes.length === 0}>
            <Plus className="h-4 w-4" /> Yangi topshiriq
          </Button>
        }
      />

      {loading ? (
        <Card>
          <Loader label="Yuklanmoqda..." />
        </Card>
      ) : classes.length === 0 ? (
        <Card>
          <div className="state">
            <h4>Guruh/fan yo'q</h4>
            <p>Sizga biriktirilgan guruh/fan yo'q.</p>
          </div>
        </Card>
      ) : assignments.length === 0 ? (
        <Card>
          <div className="state">
            <div className="state-icon">
              <ClipboardCheck className="h-6 w-6" />
            </div>
            <h4>Hali topshiriq yo'q</h4>
            <p>"Yangi topshiriq" tugmasi orqali yarating.</p>
          </div>
        </Card>
      ) : (
        <div className="entity-grid">
          {assignments.map((a) => (
            <div key={a.id} className="entity-card">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 shrink-0 text-brand-600" />
                  <p className="ec-name">{a.title}</p>
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
                <p className="line-clamp-2 whitespace-pre-wrap text-sm text-slate-600">{a.description}</p>
              )}

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                {a.dueDate && (
                  <span className="inline-flex items-center gap-1 text-amber-600">
                    <CalendarClock className="h-3.5 w-3.5" />
                    <span className="font-mono">{formatDateTime(a.dueDate)}</span>
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
                  Maks: <span className="font-mono text-slate-500">{a.maxScore}</span> ball
                </span>
              </div>

              <button
                type="button"
                onClick={() => setResultsFor(a)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
              >
                <Users className="h-4 w-4" /> Kim bajardi
              </button>
            </div>
          ))}
        </div>
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
