import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Video, FileText, Paperclip, Users, BookOpen,
} from 'lucide-react'
import type { LmsSubject, LmsTopic, LmsProgressReport } from '@/types'
import {
  getTeacherLmsSubjects,
  getTeacherLmsTopics,
  getTeacherLmsProgress,
} from '@/api/services/teacher'
import { Loader } from '@/components/ui/Loader'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { LmsProgressMatrix } from '@/components/lms/LmsProgressMatrix'
import { cn } from '@/lib/utils'

type Tab = 'topics' | 'progress'

export function TeacherLmsSubjectPage() {
  const { subjectId } = useParams<{ subjectId: string }>()
  const navigate = useNavigate()

  const [subject, setSubject] = useState<LmsSubject | null>(null)
  const [topics, setTopics] = useState<LmsTopic[]>([])
  const [progress, setProgress] = useState<LmsProgressReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [progressLoading, setProgressLoading] = useState(false)
  const [tab, setTab] = useState<Tab>('topics')

  useEffect(() => {
    if (!subjectId) return
    Promise.all([
      getTeacherLmsSubjects(),
      getTeacherLmsTopics(subjectId),
    ])
      .then(([subs, tops]) => {
        setSubject(subs.find((s) => s.id === subjectId) ?? null)
        setTopics(tops)
      })
      .finally(() => setLoading(false))
  }, [subjectId])

  const loadProgress = () => {
    if (!subjectId || progress) return
    setProgressLoading(true)
    getTeacherLmsProgress(subjectId)
      .then(setProgress)
      .finally(() => setProgressLoading(false))
  }

  const switchTab = (t: Tab) => {
    setTab(t)
    if (t === 'progress') loadProgress()
  }

  if (loading) return <Loader label="Yuklanmoqda..." />
  if (!subject) return <p className="px-4 py-12 text-center text-faint">Fan topilmadi</p>

  return (
    <div className="px-4 pt-3 pb-6">
      {/* Breadcrumb */}
      <div className="subnav">
        <button
          type="button"
          onClick={() => navigate('/teacher/lms')}
          className="subnav-tab"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Ta'lim
        </button>
        <span className="text-faint">/</span>
        <span className="subnav-tab">{subject.className}-guruh</span>
        <span className="text-faint">/</span>
        <span className="subnav-tab active">{subject.title}</span>
      </div>

      {/* Header */}
      <PageHeader
        title={subject.title}
        sub={subject.description || undefined}
        actions={
          <div className="flex items-center gap-2 rounded-xl bg-chip px-3 py-1.5 text-sm text-mute">
            <BookOpen className="h-4 w-4" />
            <span className="font-mono">{topics.length}</span> ta mavzu
          </div>
        }
      />

      {/* Tab */}
      <div className="tabs mb-5">
        <TabBtn active={tab === 'topics'} onClick={() => switchTab('topics')}>
          Mavzular
        </TabBtn>
        <TabBtn active={tab === 'progress'} onClick={() => switchTab('progress')}>
          <Users className="h-3.5 w-3.5" />
          O'quvchilar progressi
        </TabBtn>
      </div>

      {/* ─── MAVZULAR ─── */}
      {tab === 'topics' && (
        topics.length === 0 ? (
          <Card>
            <div className="state">
              <h4>Mavzular yo'q</h4>
            </div>
          </Card>
        ) : (
          <div className="space-y-2">
            {topics.map((t) => (
              <div
                key={t.id}
                className="flex items-start gap-4 rounded-[18px] border border-line bg-white px-4 py-3.5 shadow-[var(--shadow-card)]"
              >
                {/* Tartib */}
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-tealsoft font-mono text-sm font-bold text-teal-700">
                  {t.order}
                </div>

                {/* Asosiy ma'lumot */}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{t.title}</p>
                  {t.description && (
                    <p className="mt-0.5 text-xs text-faint">{t.description}</p>
                  )}

                  {/* Kontent indikatorlari */}
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    {t.videoUrl && (
                      <span className="flex items-center gap-1 text-xs font-medium text-teal-600">
                        <Video className="h-3.5 w-3.5" />
                        Video
                      </span>
                    )}
                    {t.textContent && (
                      <span className="flex items-center gap-1 text-xs text-mute">
                        <FileText className="h-3.5 w-3.5" />
                        Matn
                      </span>
                    )}
                    {t.materials.length > 0 && (
                      <span className="flex items-center gap-1 text-xs text-mute">
                        <Paperclip className="h-3.5 w-3.5" />
                        {t.materials.length} fayl
                      </span>
                    )}
                    {t.materials.map((m) => (
                      <a
                        key={m.id}
                        href={m.url}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-xs text-faint underline hover:text-teal-600"
                      >
                        {m.name}
                      </a>
                    ))}
                  </div>
                </div>

                {/* O'quvchilar tugatladi */}
                {t.completedCount > 0 && (
                  <div className="shrink-0 rounded-lg bg-emerald-50 px-2.5 py-1 text-center">
                    <p className="font-mono text-sm font-bold text-emerald-700">{t.completedCount}</p>
                    <p className="text-[10px] text-emerald-600">tugaldi</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {/* ─── PROGRESS MATRITSASI ─── */}
      {tab === 'progress' && (
        progressLoading ? (
          <Loader label="Progress yuklanmoqda..." />
        ) : !progress ? null : (
          <LmsProgressMatrix progress={progress} />
        )
      )}
    </div>
  )
}

function TabBtn({
  active,
  onClick,
  children,
}: {
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
