import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ChevronRight, ChevronUp, ChevronDown, Layers,
  FolderTree, Pencil, Trash2, Plus,
} from 'lucide-react'
import type { LmsModule, LmsSubject } from '@/types'
import {
  getLmsSubjects, getLmsModules, deleteLmsModule, reorderLmsModules,
} from '@/api/services/lms'
import { Loader } from '@/components/ui/Loader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { LmsModuleModal } from './LmsModuleModal'

export function LmsModulesPage() {
  const { classId, subjectId } = useParams<{ classId: string; subjectId: string }>()
  const navigate = useNavigate()

  const [subject, setSubject] = useState<LmsSubject | null>(null)
  const [modules, setModules] = useState<LmsModule[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ open: boolean; editing: LmsModule | null }>({ open: false, editing: null })

  const loadModules = () => {
    if (!subjectId) return Promise.resolve()
    return getLmsModules(subjectId).then(setModules)
  }

  useEffect(() => {
    if (!classId || !subjectId) return
    Promise.all([getLmsSubjects(classId), getLmsModules(subjectId)])
      .then(([subs, mods]) => {
        setSubject(subs.find((s) => s.id === subjectId) ?? null)
        setModules(mods)
      })
      .finally(() => setLoading(false))
  }, [classId, subjectId])

  const handleSaved = async () => {
    await loadModules()
    setModal({ open: false, editing: null })
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm("Modul va uning barcha mavzulari o'chiriladi. Davom etasizmi?")) return
    await deleteLmsModule(id)
    setModules((prev) => prev.filter((m) => m.id !== id))
  }

  const move = async (index: number, dir: -1 | 1) => {
    if (!subjectId) return
    const next = [...modules]
    const swap = index + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[index], next[swap]] = [next[swap], next[index]]
    setModules(next)
    await reorderLmsModules(subjectId, next.map((m) => m.id))
  }

  if (loading) return <Loader label="Yuklanmoqda..." />
  if (!subject) return <p className="py-12 text-center text-slate-400">Fan topilmadi</p>

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-3 flex flex-wrap items-center gap-1 text-sm text-slate-400">
        <button type="button" onClick={() => navigate('/admin/lms')} className="hover:text-brand-600">
          Ta'lim
        </button>
        <span>/</span>
        <button
          type="button"
          onClick={() => navigate(`/admin/lms/${classId}`)}
          className="hover:text-brand-600"
        >
          {subject.className}-guruh
        </button>
        <span>/</span>
        <span className="text-slate-700">{subject.title}</span>
      </div>

      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(`/admin/lms/${classId}`)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            {subject.title} — Modullar
          </span>
        }
        sub={subject.description || undefined}
        actions={
          <Button onClick={() => setModal({ open: true, editing: null })}>
            <Plus className="h-4 w-4" /> Yangi modul
          </Button>
        }
      />

      {/* Modullar ro'yxati */}
      {modules.length === 0 ? (
        <Card>
          <div className="state">
            <div className="state-icon">
              <FolderTree className="h-6 w-6" />
            </div>
            <h4>Modul qo'shilmagan</h4>
            <p>Bu fanda hali modul qo'shilmagan.</p>
            <button
              type="button"
              onClick={() => setModal({ open: true, editing: null })}
              className="mt-1 text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              Birinchi modulni qo'shing →
            </button>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {modules.map((m, i) => (
            <div
              key={m.id}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-[var(--shadow-1)] transition-shadow hover:shadow-[var(--shadow-2)]"
            >
              {/* Tartib raqami */}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 font-mono text-sm font-bold text-slate-600">
                {m.order}
              </div>

              {/* Asosiy info — bosish → mavzular */}
              <Link
                to={`/admin/lms/${classId}/${subjectId}/${m.id}`}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate font-medium text-slate-800">{m.title}</p>
                {m.description && (
                  <p className="truncate text-xs text-slate-400">{m.description}</p>
                )}
                <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                  <Layers className="h-3.5 w-3.5" />
                  <span className="font-mono">{m.topicsCount}</span> ta mavzu
                </div>
              </Link>

              {/* Amallar */}
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-25"
                  title="Yuqoriga"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === modules.length - 1}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-25"
                  title="Pastga"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setModal({ open: true, editing: m })}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-brand-50 hover:text-brand-600"
                  title="Tahrirlash"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(m.id)}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                  title="O'chirish"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/admin/lms/${classId}/${subjectId}/${m.id}`)}
                  className="ml-1 flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50 hover:text-brand-700"
                >
                  Mavzular <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <LmsModuleModal
        open={modal.open}
        module={modal.editing}
        subjectId={subjectId ?? ''}
        onClose={() => setModal({ open: false, editing: null })}
        onSaved={handleSaved}
      />
    </div>
  )
}
