import type { ClassPerformance } from '@/types'
import { cn } from '@/lib/utils'

export type Metric = 'grade' | 'attendance'

interface Props {
  data: ClassPerformance[]
  metric: Metric
}

interface TeacherGroup {
  teacher: string
  groups: ClassPerformance[]
}

/**
 * Guruhlar statistikasi — HAR O'QITUVCHI ALOHIDA panel (yonma-yon kartalar). Har panelda
 * o'qituvchining guruhlari gorizontal ustun (bar) ko'rinishida. Tepadagi "O'rtacha baho / Davomat"
 * tanlovi (metric) hamma panelda bir vaqtda almashadi.
 */
export function ClassPerformanceChart({ data, metric }: Props) {
  const isGrade = metric === 'grade'
  const max = isGrade ? 5 : 100
  const unit = isGrade ? '' : '%'
  const barColor = isGrade ? 'bg-blue-500' : 'bg-emerald-500'
  const softColor = isGrade ? 'bg-blue-50' : 'bg-emerald-50'

  // O'qituvchi bo'yicha guruhlash (tartib: o'qituvchi nomi, keyin guruh nomi).
  const order: string[] = []
  const map = new Map<string, ClassPerformance[]>()
  for (const d of data) {
    const t = d.teacherName?.trim() || 'Biriktirilmagan'
    if (!map.has(t)) {
      map.set(t, [])
      order.push(t)
    }
    map.get(t)!.push(d)
  }
  const teachers: TeacherGroup[] = order
    .sort((a, b) => a.localeCompare(b))
    .map((teacher) => ({
      teacher,
      groups: map
        .get(teacher)!
        .slice()
        .sort((a, b) => a.className.localeCompare(b.className)),
    }))

  const valueOf = (g: ClassPerformance): number | null =>
    isGrade ? g.averageGrade : g.attendanceRate

  const fmt = (v: number | null) =>
    v == null ? '—' : `${isGrade ? v.toFixed(1) : Math.round(v)}${unit}`

  if (teachers.length === 0)
    return (
      <div className="state py-10 text-center text-sm text-slate-400">
        Hozircha ma'lumot yo'q
      </div>
    )

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {teachers.map((t) => {
        // O'qituvchining o'rtacha qiymati (panel sarlavhasi uchun).
        const vals = t.groups.map(valueOf).filter((v): v is number => v != null)
        const avg = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null
        return (
          <div
            key={t.teacher}
            className="rounded-xl border border-slate-200 bg-white p-3.5"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {t.teacher}
                </p>
                <p className="text-[11px] text-slate-400">
                  {t.groups.length} ta guruh
                </p>
              </div>
              <span
                className={cn(
                  'shrink-0 rounded-lg px-2 py-1 font-mono text-xs font-semibold',
                  softColor,
                  isGrade ? 'text-blue-700' : 'text-emerald-700',
                )}
              >
                {fmt(avg)}
              </span>
            </div>

            <div className="space-y-2.5">
              {t.groups.map((g) => {
                const v = valueOf(g)
                const pct = v == null ? 0 : Math.min(100, (v / max) * 100)
                return (
                  <div key={g.classId}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-slate-600">
                        {g.className}
                      </span>
                      <span className="shrink-0 font-mono text-xs font-medium text-slate-700">
                        {fmt(v)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={cn('h-full rounded-full transition-all', barColor)}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
