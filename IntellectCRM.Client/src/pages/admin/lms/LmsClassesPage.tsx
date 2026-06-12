import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { GraduationCap, ChevronRight, BookOpen } from 'lucide-react'
import type { LmsSubject, Group } from '@/types'
import { getClasses } from '@/api/services/classes'
import { getLmsSubjects } from '@/api/services/lms'
import { languageLabels } from '@/config/constants'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { PageHeader } from '@/components/ui/PageHeader'
import { Loader } from '@/components/ui/Loader'

export function LmsClassesPage() {
  const [classes, setClasses] = useState<Group[]>([])
  const [subjects, setSubjects] = useState<LmsSubject[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getClasses(), getLmsSubjects()])
      .then(([cls, subs]) => {
        setClasses(cls)
        setSubjects(subs)
      })
      .finally(() => setLoading(false))
  }, [])

  const countFor = (classId: string) => subjects.filter((s) => s.classId === classId).length

  return (
    <div>
      <PageHeader
        title="Ta'lim (LMS)"
        sub="Guruh tanlang — uning fanlar va dars materiallarini boshqaring"
      />

      {loading ? (
        <Card>
          <Loader label="Yuklanmoqda..." />
        </Card>
      ) : classes.length === 0 ? (
        <Card>
          <div className="state">
            <h4>Guruhlar yo'q</h4>
            <p>Avval guruh yarating.</p>
          </div>
        </Card>
      ) : (
        <div className="entity-grid">
          {classes.map((c) => {
            const cnt = countFor(c.id)
            return (
              <Link
                key={c.id}
                to={`/admin/lms/${c.id}`}
                className="entity-card text-left"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                      <GraduationCap className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="ec-name truncate">{c.name}-guruh</div>
                      <div className="ec-meta">
                        {languageLabels[c.language]}
                        {c.room ? ` · ${c.room}-xona` : ''}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {cnt > 0 && (
                      <Badge tone="violet">
                        <BookOpen className="h-3.5 w-3.5" />
                        {cnt} ta fan
                      </Badge>
                    )}
                    <ChevronRight className="h-5 w-5 text-slate-300" />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
