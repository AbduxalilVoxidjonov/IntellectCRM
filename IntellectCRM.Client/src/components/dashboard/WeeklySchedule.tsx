import { useMemo } from 'react'
import { CalendarRange } from 'lucide-react'
import type { Group, Subject, Teacher } from '@/types'
import { getClasses } from '@/api/services/classes'
import { getTeachers } from '@/api/services/teachers'
import { getSubjects } from '@/api/services/subjects'
import { useAsync } from '@/hooks/useAsync'
import { Card } from '@/components/ui/Card'
import { Loader } from '@/components/ui/Loader'

/** Har bir guruhga beriladigan alohida (yumshoq) rang — bir o'qituvchining har guruhi turli rangda. */
const PALETTE = [
  { bg: '#EEF2FF', bd: '#C7D2FE', fg: '#4338CA' }, // indigo
  { bg: '#ECFDF5', bd: '#A7F3D0', fg: '#047857' }, // emerald
  { bg: '#FFF7ED', bd: '#FED7AA', fg: '#C2410C' }, // orange
  { bg: '#FDF2F8', bd: '#FBCFE8', fg: '#BE185D' }, // pink
  { bg: '#EFF6FF', bd: '#BFDBFE', fg: '#1D4ED8' }, // blue
  { bg: '#F0FDFA', bd: '#99F6E4', fg: '#0F766E' }, // teal
  { bg: '#FEFCE8', bd: '#FEF08A', fg: '#A16207' }, // yellow
  { bg: '#FAF5FF', bd: '#E9D5FF', fg: '#7E22CE' }, // purple
  { bg: '#FEF2F2', bd: '#FECACA', fg: '#B91C1C' }, // red
  { bg: '#F7FEE7', bd: '#D9F99D', fg: '#4D7C0F' }, // lime
  { bg: '#ECFEFF', bd: '#A5F3FC', fg: '#0E7490' }, // cyan
  { bg: '#FFF1F2', bd: '#FECDD3', fg: '#BE123C' }, // rose
]

const DAYS = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba']
const DAYS_SHORT = ['Du', 'Se', 'Cho', 'Pay', 'Jum', 'Shan', 'Yak']

/** JS getDay() (0=Yakshanba) -> bizning indeks (0=Dushanba). */
const todayIdx = (new Date().getDay() + 6) % 7

interface Block {
  groupId: string
  name: string
  course: string
  teacher: string
  room: string
  start: string
  end: string
  color: (typeof PALETTE)[number]
}

/**
 * Bosh sahifa "Dars jadvali" — yaratilgan guruhlarning haftalik jadvali (raspisaniye).
 * Har guruh o'z vaqti (kunlar + HH:mm) bo'yicha kun ustuniga joylashadi; har guruh alohida rangda,
 * legenda esa o'qituvchi bo'yicha guruhlanadi.
 */
export function WeeklySchedule() {
  const { data, loading, error } = useAsync(
    () => Promise.all([getClasses(), getTeachers(), getSubjects()]),
    [],
  )

  const { byDay, byTeacher, hasAny } = useMemo(() => {
    const [classes, teachers, subjects] = data ?? [[], [], []]
    const tName = new Map<string, string>(
      (teachers as Teacher[]).map((t) => [t.id, t.fullName]),
    )
    const cName = new Map<string, string>(
      (subjects as Subject[]).map((s) => [s.id, s.name]),
    )

    // Faqat arxivlanmagan, vaqti belgilangan guruhlar; har biriga barqaror rang (indeks bo'yicha).
    const active = (classes as Group[]).filter(
      (g) => !g.isArchived && (g.days?.length ?? 0) > 0 && g.startTime,
    )

    const byDay: Block[][] = [[], [], [], [], [], [], []]
    const byTeacher = new Map<string, { teacher: string; groups: Block[] }>()

    active.forEach((g, i) => {
      const color = PALETTE[i % PALETTE.length]
      const teacher = (g.teacherId && tName.get(g.teacherId)) || 'Biriktirilmagan'
      const block: Block = {
        groupId: g.id,
        name: g.name,
        course: (g.courseId && cName.get(g.courseId)) || '',
        teacher,
        room: g.room ?? '',
        start: g.startTime ?? '',
        end: g.endTime ?? '',
        color,
      }
      for (const d of g.days ?? []) if (d >= 0 && d <= 6) byDay[d].push(block)

      const key = g.teacherId || 'none'
      if (!byTeacher.has(key)) byTeacher.set(key, { teacher, groups: [] })
      byTeacher.get(key)!.groups.push(block)
    })

    // Har kun ustunini boshlanish vaqti bo'yicha saralash.
    for (const col of byDay) col.sort((a, b) => a.start.localeCompare(b.start))

    return { byDay, byTeacher: [...byTeacher.values()], hasAny: active.length > 0 }
  }, [data])

  return (
    <Card
      title="Dars jadvali"
      sub="Guruhlarning haftalik jadvali — har o'qituvchi guruhlari alohida rangda"
    >
      {loading ? (
        <Loader label="Yuklanmoqda..." />
      ) : error ? (
        <p className="text-red-600">Xatolik: {error}</p>
      ) : !hasAny ? (
        <div className="state">
          <div className="state-icon">
            <CalendarRange className="h-6 w-6" />
          </div>
          <h4>Jadval bo'sh</h4>
          <p>Guruh yaratishda hafta kunlari va vaqtni belgilang — jadval shu yerda chiqadi.</p>
        </div>
      ) : (
        <>
          {/* Haftalik grid: 7 kun ustuni (kichik ekranda gorizontal scroll) */}
          <div className="overflow-x-auto">
            <div className="grid min-w-[840px] grid-cols-7 gap-2">
              {DAYS.map((day, d) => (
                <div key={day} className="flex flex-col gap-2">
                  <div
                    className={
                      'rounded-lg px-2 py-1.5 text-center text-xs font-semibold ' +
                      (d === todayIdx
                        ? 'bg-brand-600 text-white'
                        : 'bg-slate-100 text-slate-500')
                    }
                  >
                    <span className="hidden sm:inline">{day}</span>
                    <span className="sm:hidden">{DAYS_SHORT[d]}</span>
                  </div>
                  {byDay[d].length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-100 py-3 text-center text-[11px] text-slate-300">
                      —
                    </div>
                  ) : (
                    byDay[d].map((b) => (
                      <div
                        key={b.groupId}
                        className="rounded-lg border p-2"
                        style={{
                          background: b.color.bg,
                          borderColor: b.color.bd,
                          color: b.color.fg,
                        }}
                        title={`${b.name}${b.course ? ' · ' + b.course : ''} · ${b.teacher}`}
                      >
                        <p className="truncate text-xs font-bold">{b.name}</p>
                        {b.course && <p className="truncate text-[11px] opacity-80">{b.course}</p>}
                        <p className="mt-0.5 font-mono text-[11px] font-semibold">
                          {b.start}{b.end ? `–${b.end}` : ''}
                        </p>
                        <p className="truncate text-[11px] opacity-70">
                          {b.teacher}
                          {b.room ? ` · ${b.room}` : ''}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Legenda: o'qituvchi -> guruhlari (rangli chiplar) */}
          <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
            {byTeacher.map((t) => (
              <div key={t.teacher} className="flex flex-wrap items-center gap-2">
                <span className="min-w-[120px] text-xs font-semibold text-slate-600">
                  {t.teacher}
                </span>
                {t.groups.map((g) => (
                  <span
                    key={g.groupId}
                    className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium"
                    style={{ background: g.color.bg, borderColor: g.color.bd, color: g.color.fg }}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: g.color.fg }}
                    />
                    {g.name}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  )
}
