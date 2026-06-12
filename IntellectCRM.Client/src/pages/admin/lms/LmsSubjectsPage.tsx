import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, BookOpen, ChevronRight, Layers, Pencil, Trash2, Plus } from 'lucide-react'
import type { LmsSubject, LmsUnlockMode, Group } from '@/types'
import {
  getLmsSubjects, createLmsSubject, updateLmsSubject, deleteLmsSubject,
} from '@/api/services/lms'
import { getClasses } from '@/api/services/classes'
import { Loader } from '@/components/ui/Loader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import type { BadgeTone } from '@/components/ui/Badge'
import { LmsSubjectModal } from './LmsSubjectModal'

const unlockLabel: Record<LmsUnlockMode, string> = {
  all: 'Hammasi ochiq',
  sequential: 'Ketma-ket',
  batch: 'Guruhli',
}

const unlockTone: Record<LmsUnlockMode, BadgeTone> = {
  all: 'green',
  sequential: 'amber',
  batch: 'violet',
}

export function LmsSubjectsPage() {
  const { classId } = useParams<{ classId: string }>()
  const navigate = useNavigate()

  const [schoolClass, setSchoolClass] = useState<Group | null>(null)
  const [subjects, setSubjects] = useState<LmsSubject[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ open: boolean; editing?: LmsSubject }>({ open: false })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!classId) return
    Promise.all([getClasses(), getLmsSubjects(classId)])
      .then(([cls, subs]) => {
        setSchoolClass(cls.find((c) => c.id === classId) ?? null)
        setSubjects(subs)
      })
      .finally(() => setLoading(false))
  }, [classId])

  const handleSave = async (payload: Parameters<typeof createLmsSubject>[0]) => {
    if (!classId) return
    setSaving(true)
    try {
      if (modal.editing) {
        await updateLmsSubject(modal.editing.id, {
          title: payload.title,
          description: payload.description,
          unlockMode: payload.unlockMode,
          batchSize: payload.batchSize,
        })
        setSubjects((prev) =>
          prev.map((s) =>
            s.id === modal.editing!.id ? { ...s, ...payload } : s,
          ),
        )
      } else {
        const created = await createLmsSubject({ ...payload, classId })
        setSubjects((prev) => [...prev, created])
      }
      setModal({ open: false })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm("Fan va uning barcha mavzulari o'chiriladi. Davom etasizmi?")) return
    await deleteLmsSubject(id)
    setSubjects((prev) => prev.filter((s) => s.id !== id))
  }

  if (loading) return <Loader label="Yuklanmoqda..." />

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-3 flex items-center gap-1 text-sm text-slate-400">
        <button type="button" onClick={() => navigate('/admin/lms')} className="hover:text-brand-600">
          Ta'lim
        </button>
        <span>/</span>
        <span className="text-slate-700">{schoolClass ? `${schoolClass.name}-guruh` : '...'}</span>
      </div>

      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/admin/lms')}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              title="Guruhlar"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            {schoolClass ? `${schoolClass.name}-guruh` : '...'} — Fanlar
          </span>
        }
        sub="Guruhga fan qo'shing, mavzularni boshqaring"
        actions={
          <Button onClick={() => setModal({ open: true })}>
            <Plus className="h-4 w-4" /> Yangi fan
          </Button>
        }
      />

      {/* Fanlar */}
      {subjects.length === 0 ? (
        <Card>
          <div className="state">
            <div className="state-icon">
              <BookOpen className="h-6 w-6" />
            </div>
            <h4>Fan qo'shilmagan</h4>
            <p>Bu guruhda hali fan qo'shilmagan.</p>
            <button
              type="button"
              onClick={() => setModal({ open: true })}
              className="mt-1 text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              Birinchi fanni qo'shing →
            </button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {subjects.map((s) => (
            <div
              key={s.id}
              className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-[var(--shadow-1)] transition-shadow hover:shadow-[var(--shadow-2)]"
            >
              {/* Asosiy qism — bosish → mavzular */}
              <Link
                to={`/admin/lms/${classId}/${s.id}`}
                className="flex flex-1 flex-col gap-2 rounded-t-xl p-4 text-left"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <Badge tone={unlockTone[s.unlockMode]}>
                    {unlockLabel[s.unlockMode]}
                    {s.unlockMode === 'batch' && ` (${s.batchSize})`}
                  </Badge>
                </div>

                <div>
                  <p className="font-semibold text-slate-800">{s.title}</p>
                  {s.description && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">{s.description}</p>
                  )}
                </div>

                <div className="mt-auto flex items-center gap-1 text-xs text-slate-500">
                  <Layers className="h-3.5 w-3.5" />
                  <span className="font-mono">{s.topicsCount}</span> ta mavzu
                </div>
              </Link>

              {/* Tugmalar */}
              <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setModal({ open: true, editing: s })}
                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                    title="Tahrirlash"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(s.id)}
                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                    title="O'chirish"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/admin/lms/${classId}/${s.id}`)}
                  className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
                >
                  Modullar <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <LmsSubjectModal
        open={modal.open}
        editing={modal.editing}
        saving={saving}
        onClose={() => setModal({ open: false })}
        onSave={handleSave}
      />
    </div>
  )
}
