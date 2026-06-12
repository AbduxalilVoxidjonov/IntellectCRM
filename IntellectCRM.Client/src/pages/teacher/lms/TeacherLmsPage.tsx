import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, ChevronRight, Layers } from 'lucide-react'
import type { LmsSubject, LmsUnlockMode } from '@/types'
import { getTeacherLmsSubjects } from '@/api/services/teacher'
import { Loader } from '@/components/ui/Loader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { PageHeader } from '@/components/ui/PageHeader'
import type { BadgeTone } from '@/components/ui/Badge'

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

export function TeacherLmsPage() {
  const navigate = useNavigate()
  const [subjects, setSubjects] = useState<LmsSubject[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getTeacherLmsSubjects()
      .then(setSubjects)
      .finally(() => setLoading(false))
  }, [])

  // Sinf bo'yicha guruhlash
  const byClass = subjects.reduce<Record<string, { className: string; items: LmsSubject[] }>>(
    (acc, s) => {
      if (!acc[s.classId]) acc[s.classId] = { className: s.className, items: [] }
      acc[s.classId].items.push(s)
      return acc
    },
    {},
  )
  const groups = Object.values(byClass)

  return (
    <div>
      <PageHeader
        title="Ta'lim (LMS)"
        sub="Guruhlaringizdagi qo'shimcha ta'lim fanlari va o'quvchilar progressi"
      />

      {loading ? (
        <Card>
          <Loader label="Yuklanmoqda..." />
        </Card>
      ) : subjects.length === 0 ? (
        <Card>
          <div className="state">
            <div className="state-icon">
              <BookOpen className="h-6 w-6" />
            </div>
            <h4>Guruhlaringizda LMS fani yo'q</h4>
            <p>Administrator qo'shimcha ta'lim fanlarini qo'shganda bu yerda ko'rinadi</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-8">
          {groups.map(({ className, items }) => (
            <div key={className}>
              {/* Guruh sarlavhasi */}
              <div className="mb-3 flex items-center gap-2">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="rounded-full bg-slate-100 px-3 py-0.5 text-sm font-semibold text-slate-600">
                  {className}-guruh
                </span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              {/* Fanlar kartochalari */}
              <div className="entity-grid">
                {items.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => navigate(`/teacher/lms/${s.id}`)}
                    className="entity-card text-left"
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

                    <div className="min-w-0">
                      <p className="truncate ec-name">{s.title}</p>
                      {s.description && (
                        <p className="mt-0.5 line-clamp-1 ec-meta">{s.description}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <Layers className="h-3.5 w-3.5" />
                        <span className="font-mono">{s.topicsCount}</span> ta mavzu
                      </span>
                      <span className="flex items-center gap-1 text-xs font-medium text-brand-600">
                        Ko'rish <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
