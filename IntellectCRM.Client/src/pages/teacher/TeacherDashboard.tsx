import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { GraduationCap, ClipboardCheck, Crown, BookOpen, Users } from 'lucide-react'
import type { TeacherClass } from '@/types'
import { getMyClasses } from '@/api/services/teacher'
import { useAuth } from '@/context/auth-context'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Loader } from '@/components/ui/Loader'

export function TeacherDashboard() {
  const { user } = useAuth()
  const [classes, setClasses] = useState<TeacherClass[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMyClasses()
      .then(setClasses)
      .finally(() => setLoading(false))
  }, [])

  // Faqat allaqachon yuklangan ma'lumotdan hisoblanadi
  const homeroomCount = classes.filter((c) => c.isHomeroom).length
  const subjectCount = classes.reduce((acc, c) => acc + c.subjects.length, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Assalomu alaykum${user?.fullName ? `, ${user.fullName}` : ''}!`}
        sub="O'qituvchi paneli"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Guruhlar"
          value={classes.length}
          icon={GraduationCap}
          iconBg="bg-brand-50"
          iconColor="text-brand-600"
          hint="Dars beradigan guruhlar"
        />
        <StatCard
          label="Fanlar"
          value={subjectCount}
          icon={BookOpen}
          iconBg="bg-sky-50"
          iconColor="text-sky-600"
          hint="Jami biriktirilgan fanlar"
        />
        <StatCard
          label="Rahbarlik"
          value={homeroomCount}
          icon={Crown}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
          hint="Guruh rahbari"
        />
      </div>

      <Link
        to="/teacher/assignments"
        className="flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4 text-brand-700 shadow-[var(--shadow-1)] transition-colors hover:bg-brand-100"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-brand-600">
          <ClipboardCheck className="h-5 w-5" />
        </div>
        <div>
          <p className="font-bold tracking-tight">Topshiriqlar</p>
          <p className="text-sm text-brand-600/80">Guruhlaringizga qo'shimcha topshiriq yarating</p>
        </div>
      </Link>

      <Card title="Dars beradigan guruhlar" tight>
        {loading ? (
          <div className="p-5">
            <Loader label="Yuklanmoqda..." />
          </div>
        ) : classes.length === 0 ? (
          <div className="state px-5 py-10 text-center text-sm text-slate-400">
            Sizga biriktirilgan guruh/fan yo'q. Markaz ma'muriyatiga murojaat qiling.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 p-[18px] sm:grid-cols-2 lg:grid-cols-3">
            {classes.map((c) => (
              <div
                key={c.classId}
                className="space-y-2.5 rounded-xl border border-slate-200 bg-white p-4 shadow-[var(--shadow-1)]"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                      <GraduationCap className="h-5 w-5" />
                    </div>
                    <p className="font-bold tracking-tight text-slate-800">{c.className}</p>
                  </div>
                  {c.isHomeroom && (
                    <Badge tone="amber">
                      <Crown className="h-3 w-3" /> Guruh rahbari
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {c.subjects.length === 0 ? (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                      <Users className="h-3.5 w-3.5" /> Dars beradigan fan yo'q
                    </span>
                  ) : (
                    c.subjects.map((s) => (
                      <span
                        key={s.id}
                        className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
                      >
                        {s.name}
                      </span>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
