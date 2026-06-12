import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ChevronUp, ChevronDown, Video, FileText,
  Paperclip, Pencil, Trash2, Plus, Users,
} from 'lucide-react'
import type { LmsModule, LmsSubject, LmsTopic, LmsProgressReport } from '@/types'
import {
  getLmsSubjects, getLmsModules, getLmsTopics, createLmsTopic, updateLmsTopic,
  deleteLmsTopic, reorderLmsTopics, updateLmsSubject, getLmsProgress,
} from '@/api/services/lms'
import { Loader } from '@/components/ui/Loader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { LmsProgressMatrix } from '@/components/lms/LmsProgressMatrix'
import { cn } from '@/lib/utils'
import { LmsSubjectModal } from './LmsSubjectModal'
import { LmsTopicModal } from './LmsTopicModal'

const unlockLabels: Record<string, string> = {
  all: 'Hammasi ochiq',
  sequential: 'Ketma-ket ochiladi',
  batch: 'Guruhli ochiladi',
}

export function LmsTopicsPage() {
  const { classId, subjectId, moduleId } = useParams<{ classId: string; subjectId: string; moduleId: string }>()
  const navigate = useNavigate()

  const [subject, setSubject] = useState<LmsSubject | null>(null)
  const [module, setModule] = useState<LmsModule | null>(null)
  const [topics, setTopics] = useState<LmsTopic[]>([])
  const [loading, setLoading] = useState(true)

  const [subjectModal, setSubjectModal] = useState(false)
  const [topicModal, setTopicModal] = useState<{ open: boolean; editing?: LmsTopic }>({ open: false })
  const [saving, setSaving] = useState(false)

  const [tab, setTab] = useState<'topics' | 'progress'>('topics')
  const [progress, setProgress] = useState<LmsProgressReport | null>(null)
  const [progressLoading, setProgressLoading] = useState(false)

  // Progressni faqat tab ochilganda yuklaymiz; mavzu o'zgarsa keshni bekor qilamiz (ustunlar o'zgaradi).
  const loadProgress = () => {
    if (!subjectId || progress) return
    setProgressLoading(true)
    getLmsProgress(subjectId).then(setProgress).finally(() => setProgressLoading(false))
  }
  const switchTab = (t: 'topics' | 'progress') => {
    setTab(t)
    if (t === 'progress') loadProgress()
  }

  useEffect(() => {
    if (!classId || !subjectId || !moduleId) return
    Promise.all([
      getLmsSubjects(classId),
      getLmsModules(subjectId),
      getLmsTopics(moduleId),
    ])
      .then(([subs, mods, tops]) => {
        setSubject(subs.find((s) => s.id === subjectId) ?? null)
        setModule(mods.find((m) => m.id === moduleId) ?? null)
        setTopics(tops)
      })
      .finally(() => setLoading(false))
  }, [classId, subjectId, moduleId])

  /* ─── Subject settings ─── */
  const handleSubjectSave = async (payload: Parameters<typeof updateLmsSubject>[1]) => {
    if (!subjectId || !subject) return
    setSaving(true)
    try {
      await updateLmsSubject(subjectId, payload)
      setSubject({ ...subject, ...payload })
      setSubjectModal(false)
    } finally {
      setSaving(false)
    }
  }

  /* ─── Topic CRUD ─── */
  const handleTopicSave = async (payload: Parameters<typeof createLmsTopic>[1]) => {
    if (!moduleId) return
    setSaving(true)
    try {
      if (topicModal.editing) {
        await updateLmsTopic(topicModal.editing.id, payload)
        setTopics((prev) =>
          prev.map((t) =>
            t.id === topicModal.editing!.id
              ? { ...t, ...payload, materials: payload.materials as LmsTopic['materials'] }
              : t,
          ),
        )
      } else {
        const created = await createLmsTopic(moduleId, payload)
        setTopics((prev) => [...prev, created])
      }
      setTopicModal({ open: false })
      setProgress(null) // mavzular o'zgardi — progress keshini qayta yuklash kerak
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      alert(msg ?? "Mavzuni saqlab bo'lmadi")
    } finally {
      setSaving(false)
    }
  }

  const handleTopicDelete = async (id: string) => {
    if (!window.confirm("Mavzu va uning materiallari o'chiriladi. Davom etasizmi?")) return
    await deleteLmsTopic(id)
    setTopics((prev) => prev.filter((t) => t.id !== id))
    setProgress(null)
  }

  /* ─── Reorder ─── */
  const move = async (index: number, dir: -1 | 1) => {
    if (!moduleId) return
    const next = [...topics]
    const swap = index + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[index], next[swap]] = [next[swap], next[index]]
    setTopics(next)
    await reorderLmsTopics(moduleId, next.map((t) => t.id))
    setProgress(null)
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
        <button
          type="button"
          onClick={() => navigate(`/admin/lms/${classId}/${subjectId}`)}
          className="hover:text-brand-600"
        >
          {subject.title}
        </button>
        <span>/</span>
        <span className="text-slate-700">{module?.title ?? '...'}</span>
      </div>

      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(`/admin/lms/${classId}/${subjectId}`)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            {module?.title ?? subject.title}
          </span>
        }
        sub={module?.description || undefined}
        actions={
          <>
            <Button variant="secondary" onClick={() => setSubjectModal(true)}>
              Sozlamalar
            </Button>
            <Button onClick={() => setTopicModal({ open: true })}>
              <Plus className="h-4 w-4" /> Yangi mavzu
            </Button>
          </>
        }
      />

      {/* Fan sozlamalari banner */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <span className="flex items-center gap-2">
          <span className="font-medium">Ochilish:</span>
          <Badge tone="violet">
            {unlockLabels[subject.unlockMode] ?? subject.unlockMode}
            {subject.unlockMode === 'batch' && ` (${subject.batchSize} ta)`}
          </Badge>
        </span>
        <span className="text-slate-300">|</span>
        <span className="text-slate-400">
          <span className="font-mono">{topics.length}</span> ta mavzu
        </span>
      </div>

      {/* Tab: mavzular / o'quvchilar progressi */}
      <div className="tabs mb-4" role="tablist">
        <TabBtn active={tab === 'topics'} onClick={() => switchTab('topics')}>Mavzular</TabBtn>
        <TabBtn active={tab === 'progress'} onClick={() => switchTab('progress')}>
          <Users className="h-3.5 w-3.5" />
          O'quvchilar progressi
        </TabBtn>
      </div>

      {/* Mavzular ro'yxati */}
      {tab === 'topics' && (topics.length === 0 ? (
        <Card>
          <div className="state">
            <h4>Mavzu qo'shilmagan</h4>
            <p>Bu modulda hali mavzu qo'shilmagan.</p>
            <button
              type="button"
              onClick={() => setTopicModal({ open: true })}
              className="mt-1 text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              Birinchi mavzuni qo'shing →
            </button>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {topics.map((t, i) => (
            <div
              key={t.id}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-[var(--shadow-1)]"
            >
              {/* Tartib raqami */}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 font-mono text-sm font-bold text-slate-600">
                {t.order}
              </div>

              {/* Asosiy info */}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-800">{t.title}</p>
                {t.description && (
                  <p className="truncate text-xs text-slate-400">{t.description}</p>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-2.5">
                  {t.videoUrl && (
                    <span className="flex items-center gap-1 text-xs text-brand-600">
                      <Video className="h-3.5 w-3.5" />
                      Video
                    </span>
                  )}
                  {t.textContent && (
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <FileText className="h-3.5 w-3.5" />
                      Matn
                    </span>
                  )}
                  {t.materials.length > 0 && (
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <Paperclip className="h-3.5 w-3.5" />
                      <span className="font-mono">{t.materials.length}</span> ta material
                    </span>
                  )}
                  {t.completedCount > 0 && (
                    <span className="text-xs text-emerald-600">
                      ✓ <span className="font-mono">{t.completedCount}</span> o'quvchi
                    </span>
                  )}
                </div>
              </div>

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
                  disabled={i === topics.length - 1}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-25"
                  title="Pastga"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setTopicModal({ open: true, editing: t })}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-brand-50 hover:text-brand-600"
                  title="Tahrirlash"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleTopicDelete(t.id)}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                  title="O'chirish"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* O'quvchilar progressi */}
      {tab === 'progress' && (
        progressLoading ? (
          <Loader label="Progress yuklanmoqda..." />
        ) : !progress ? null : (
          <LmsProgressMatrix progress={progress} />
        )
      )}

      {/* Modals */}
      <LmsSubjectModal
        open={subjectModal}
        editing={subject}
        saving={saving}
        onClose={() => setSubjectModal(false)}
        onSave={handleSubjectSave}
      />
      <LmsTopicModal
        open={topicModal.open}
        editing={topicModal.editing}
        saving={saving}
        onClose={() => setTopicModal({ open: false })}
        onSave={handleTopicSave}
      />
    </div>
  )
}

function TabBtn({ active, onClick, children }: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('tab inline-flex items-center gap-1.5', active && 'active')}
    >
      {children}
    </button>
  )
}
