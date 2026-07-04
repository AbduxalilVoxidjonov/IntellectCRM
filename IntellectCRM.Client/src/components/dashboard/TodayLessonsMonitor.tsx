import { useMemo } from 'react'
import { CalendarCheck, CheckCircle2, ClipboardList, Star, XCircle } from 'lucide-react'
import type { TodayLessonMonitor } from '@/types'
import { getTodayLessons } from '@/api/services/dashboard'
import { useAsync } from '@/hooks/useAsync'
import { Card } from '@/components/ui/Card'
import { Loader } from '@/components/ui/Loader'
import { cn } from '@/lib/utils'

const DAYS = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba']

/** Bajarilgan/bajarilmagan holat chipi (davomat yoki baho uchun). */
function StatusChip({ done, label }: { done: boolean; label: string }) {
  const Icon = done ? CheckCircle2 : XCircle
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap',
        done
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-red-200 bg-red-50 text-red-600',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  )
}

/**
 * Bosh sahifa "Bugungi darslar" monitoringi — bugun dars kuni bo'lgan har bir guruh bo'yicha
 * o'qituvchi davomat qilganmi va baho qo'yganmi ko'rsatadi. O'qituvchi bo'yicha guruhlangan.
 */
export function TodayLessonsMonitor() {
  const { data, loading, error } = useAsync(getTodayLessons, [])

  const { byTeacher, doneAtt, doneGrade, total } = useMemo(() => {
    const lessons = data?.lessons ?? []
    const map = new Map<string, { teacher: string; lessons: TodayLessonMonitor[] }>()
    for (const l of lessons) {
      const key = l.teacherId || 'none'
      if (!map.has(key)) map.set(key, { teacher: l.teacherName, lessons: [] })
      map.get(key)!.lessons.push(l)
    }
    const byTeacher = [...map.values()].sort((a, b) => a.teacher.localeCompare(b.teacher))
    return {
      byTeacher,
      doneAtt: lessons.filter((l) => l.attendanceDone).length,
      doneGrade: lessons.filter((l) => l.gradesDone).length,
      total: lessons.length,
    }
  }, [data])

  return (
    <Card
      title="Bugungi darslar"
      sub={
        data
          ? `${DAYS[data.dayIndex]} · ${data.date} — o'qituvchilar davomat qildimi va baho qo'ydimi`
          : "Bugungi darslar bo'yicha davomat/baho nazorati"
      }
      actions={
        total > 0 ? (
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
              <CalendarCheck className="h-3.5 w-3.5" />
              Davomat: {doneAtt}/{total}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">
              <Star className="h-3.5 w-3.5" />
              Baho: {doneGrade}/{total}
            </span>
          </div>
        ) : undefined
      }
    >
      {loading ? (
        <Loader label="Yuklanmoqda..." />
      ) : error ? (
        <p className="text-red-600">Xatolik: {error}</p>
      ) : total === 0 ? (
        <div className="state">
          <div className="state-icon">
            <ClipboardList className="h-6 w-6" />
          </div>
          <h4>Bugun dars yo'q</h4>
          <p>Bugun uchun rejalashtirilgan guruh darsi topilmadi.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {byTeacher.map((t) => (
            <div key={t.teacher}>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
                {t.teacher}
              </p>
              <div className="space-y-1.5">
                {t.lessons.map((l) => (
                  <div
                    key={l.groupId}
                    className={cn(
                      'flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5',
                      l.attendanceDone && l.gradesDone
                        ? 'border-emerald-100 bg-emerald-50/40'
                        : 'border-slate-100 bg-white',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {l.groupName}
                        {l.courseName && (
                          <span className="font-normal text-slate-400"> · {l.courseName}</span>
                        )}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {l.startTime}
                        {l.endTime ? `–${l.endTime}` : ''}
                        {l.room ? ` · ${l.room}` : ''}
                        {` · ${l.studentsCount} o'quvchi`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <StatusChip done={l.attendanceDone} label="Davomat" />
                      <StatusChip done={l.gradesDone} label="Baho" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
