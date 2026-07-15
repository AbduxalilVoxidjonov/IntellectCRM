import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, BarChart3, GraduationCap } from 'lucide-react'
import { getMyClasses, getTeacherGroupJournal } from '@/api/services/teacher'
import type { GroupJournal } from '@/api/services/journal'
import type { JournalEntry } from '@/types'
import { gradeTextCls } from '@/lib/utils'

/**
 * O'qituvchi — Ta'lim progresi. Har bir guruh uchun shu oydagi o'quvchilar natijasi:
 * o'rtacha baho, qo'yilgan baholar soni, o'quvchilar soni, davomatsizlik.
 */
interface GroupStat {
  classId: string
  className: string
  studentsCount: number
  gradesCount: number
  avgGrade: number
  absencesCount: number
}

export function TeacherLearningPage() {
  const nav = useNavigate()
  const [loading, setLoading] = useState(true)
  const [groups, setGroups] = useState<GroupStat[]>([])

  const now = new Date()
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const classes = await getMyClasses()
        const stats = await Promise.all(
          classes.map(async (c): Promise<GroupStat | null> => {
            try {
              const j: GroupJournal = await getTeacherGroupJournal(c.classId, ym)
              const entries: JournalEntry[] = j.entries ?? []
              const gradeEntries = entries.filter((e) => typeof e.grade === 'number')
              const gradesCount = gradeEntries.length
              const sum = gradeEntries.reduce((acc, e) => acc + (e.grade ?? 0), 0)
              const avgGrade = gradesCount ? sum / gradesCount : 0
              const absencesCount = entries.filter((e) => e.reasonId).length
              return {
                classId: c.classId,
                className: c.className,
                studentsCount: (j.students ?? []).length,
                gradesCount,
                avgGrade,
                absencesCount,
              }
            } catch {
              return null
            }
          }),
        )
        if (!alive) return
        setGroups(stats.filter((s): s is GroupStat => s !== null))
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [ym])

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
        <p className="text-[17px] font-extrabold text-ink">Ta'lim progresi</p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-2 py-20 text-mute">
          <BarChart3 className="h-7 w-7 animate-pulse text-faint" />
          <p className="text-[13px] font-semibold">Yuklanmoqda…</p>
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-[20px] border border-line bg-white py-16 text-center shadow-[var(--shadow-card)]">
          <GraduationCap className="h-8 w-8 text-faint" />
          <p className="text-[14px] font-bold text-ink">Guruhlar topilmadi</p>
          <p className="text-[12.5px] text-mute">Sizga biriktirilgan guruh yo'q</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <div
              key={g.classId}
              className="space-y-3 rounded-[20px] border border-line bg-white p-4 shadow-[var(--shadow-card)]"
            >
              {/* Guruh nomi + sarlavha */}
              <div className="flex items-start gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-tealsoft text-teal-700">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-bold text-ink">{g.className}</p>
                  <p className="text-xs text-mute">
                    {g.studentsCount} o'quvchi · {ym}
                  </p>
                </div>
              </div>

              {/* O'rtacha baho */}
              {g.gradesCount === 0 ? (
                <div className="rounded-[14px] bg-tealsoft px-4 py-4 text-center">
                  <p className="text-[13px] font-semibold text-mute">Bu oyda baho qo'yilmagan</p>
                </div>
              ) : (
                <div className="flex items-end justify-center gap-2 rounded-[14px] bg-tealsoft px-4 py-3">
                  <span className={`font-mono text-[40px] font-extrabold leading-none ${gradeTextCls(g.avgGrade)}`}>
                    {g.avgGrade.toFixed(1)}
                  </span>
                  <span className="pb-1.5 text-[12px] font-semibold text-mute">o'rtacha baho</span>
                </div>
              )}

              {/* Ikkilamchi statistika */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-[14px] border border-line px-3 py-2.5">
                  <p className="text-[11px] font-semibold text-mute">Baholar</p>
                  <p className="font-mono text-[18px] font-bold text-ink">{g.gradesCount}</p>
                </div>
                <div className="rounded-[14px] border border-line px-3 py-2.5">
                  <p className="text-[11px] font-semibold text-mute">Davomatsizlik</p>
                  <p className="font-mono text-[18px] font-bold text-ink">{g.absencesCount}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
