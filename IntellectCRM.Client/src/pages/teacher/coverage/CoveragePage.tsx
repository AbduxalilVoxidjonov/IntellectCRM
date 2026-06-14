import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, BookOpen, Clock, CheckCircle2 } from 'lucide-react'
import { getMyClasses, getTeacherGroupCurriculum } from '@/api/services/teacher'
import type { GroupCurriculum } from '@/api/services/curriculum'
import { Loader } from '@/components/ui/Loader'
import { formatDate } from '@/lib/utils'

/**
 * O'qituvchi — "Dars o'tilishi". Har bir guruh uchun kurs o'quv dasturining qancha
 * qismi o'tilgani (foiz + progress bar) va tugatish prognozi ko'rsatiladi.
 */
interface CoverageRow {
  classId: string
  className: string
  curriculum: GroupCurriculum
}

export function TeacherCoveragePage() {
  const nav = useNavigate()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<CoverageRow[]>([])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const classes = await getMyClasses()
        const results = await Promise.all(
          classes.map(async (c) => {
            try {
              const curriculum = await getTeacherGroupCurriculum(c.classId)
              return { classId: c.classId, className: c.className, curriculum } as CoverageRow
            } catch {
              return null
            }
          }),
        )
        if (alive) setRows(results.filter((r): r is CoverageRow => r !== null))
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="px-4 pt-3 pb-6">
      {/* Sarlavha */}
      <div className="mb-4 flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => nav(-1)}
          className="tap-scale flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-mute shadow-[var(--shadow-card)]"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <p className="text-[17px] font-extrabold text-ink">Dars o'tilishi</p>
      </div>

      {loading ? (
        <Loader />
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[20px] border border-line bg-white p-8 text-center shadow-[var(--shadow-card)]">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-tealsoft text-teal-700">
            <BookOpen className="h-6 w-6" />
          </div>
          <p className="text-[14px] font-semibold text-mute">Guruhlar topilmadi</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const c = row.curriculum
            const pct = c.totalItems > 0 ? Math.round((c.coveredCount / c.totalItems) * 100) : 0
            const done = c.remainingItems <= 0
            return (
              <div
                key={row.classId}
                className="space-y-3 rounded-[20px] border border-line bg-white p-4 shadow-[var(--shadow-card)]"
              >
                {/* Guruh + kurs */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-bold text-ink">{row.className}</p>
                    <p className="truncate text-xs text-mute">{c.courseName || 'Dastur biriktirilmagan'}</p>
                  </div>
                  <p className="shrink-0 font-mono text-[22px] font-extrabold text-teal-700">{pct}%</p>
                </div>

                {/* Progress bar */}
                <div className="h-2 w-full rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-teal-600" style={{ width: `${pct}%` }} />
                </div>

                {/* O'tildi */}
                <p className="text-[13px] text-mute">
                  O'tildi{' '}
                  <span className="font-mono font-semibold text-ink">
                    {c.coveredCount}/{c.totalItems}
                  </span>
                </p>

                {/* Prognoz */}
                {done ? (
                  <div className="flex items-center gap-1.5 text-[13px] font-bold text-teal-700">
                    <CheckCircle2 className="h-4 w-4" />
                    Kurs tugatildi!
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-[13px] text-faint">
                    <Clock className="h-4 w-4 shrink-0" />
                    <span>
                      <span className="font-mono">~{c.estLessonsLeft}</span> dars qoldi
                      {c.estFinishDate ? <> · ≈ {formatDate(c.estFinishDate)}</> : null}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
