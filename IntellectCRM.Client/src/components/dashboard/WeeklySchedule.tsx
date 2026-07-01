import { useMemo, useState } from 'react'
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
  teacherKey: string
  room: string
  start: string
  end: string
  color: (typeof PALETTE)[number]
  days: number[]
}

const selectClass =
  'rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-100'

/**
 * Bosh sahifa "Dars jadvali" — yaratilgan guruhlarning haftalik jadvali (raspisaniye).
 * Yuqorida o'qituvchi tanlash mumkin: tanlansa FAQAT shu o'qituvchining guruhlari ko'rsatiladi
 * ("Barcha o'qituvchilar" — hammasi). Yonida kun tanlash mumkin: tanlansa FAQAT shu kungi
 * jadval (bitta ustunli ro'yxat) ko'rsatiladi ("Barcha kunlar" — haftalik grid). Har guruh
 * alohida rangda; legenda o'qituvchi bo'yicha.
 */
export function WeeklySchedule() {
  const { data, loading, error } = useAsync(
    () => Promise.all([getClasses(), getTeachers(), getSubjects()]),
    [],
  )
  const [teacherFilter, setTeacherFilter] = useState<string>('all')
  const [dayFilter, setDayFilter] = useState<'all' | number>('all')

  // Faqat ma'lumotga bog'liq: barcha bloklar (barqaror rang bilan) + o'qituvchi ro'yxati.
  const { blocks, teacherOptions } = useMemo(() => {
    const [classes, teachers, subjects] = data ?? [[], [], []]
    const tName = new Map<string, string>((teachers as Teacher[]).map((t) => [t.id, t.fullName]))
    const cName = new Map<string, string>((subjects as Subject[]).map((s) => [s.id, s.name]))

    // Faqat arxivlanmagan, vaqti belgilangan guruhlar.
    const active = (classes as Group[]).filter(
      (g) => !g.isArchived && (g.days?.length ?? 0) > 0 && g.startTime,
    )

    // O'qituvchiga barqaror indeks (rang uchun) — barcha guruhlar bo'yicha bir marta.
    const teacherIndices = new Map<string, number>()
    let nextTeacherIdx = 0

    const blocks: Block[] = active.map((g) => {
      const teacherKey = g.teacherId || 'none'
      const teacher = (g.teacherId && tName.get(g.teacherId)) || 'Biriktirilmagan'
      if (!teacherIndices.has(teacherKey)) teacherIndices.set(teacherKey, nextTeacherIdx++)
      const teacherIdx = teacherIndices.get(teacherKey)!
      const groupsOfTeacher = active.filter((x) => (x.teacherId || 'none') === teacherKey)
      const groupIdx = groupsOfTeacher.indexOf(g)
      const color = PALETTE[(teacherIdx * 4 + groupIdx) % PALETTE.length]
      return {
        groupId: g.id,
        name: g.name,
        course: (g.courseId && cName.get(g.courseId)) || '',
        teacher,
        teacherKey,
        room: g.room ?? '',
        start: g.startTime ?? '',
        end: g.endTime ?? '',
        color,
        days: (g.days ?? []).filter((d) => d >= 0 && d <= 6),
      }
    })

    // O'qituvchi ro'yxati (jadvali bor bo'lganlar), nom bo'yicha saralangan.
    const optMap = new Map<string, string>()
    for (const b of blocks) optMap.set(b.teacherKey, b.teacher)
    const teacherOptions = [...optMap.entries()]
      .map(([key, name]) => ({ key, name }))
      .sort((a, b) => a.name.localeCompare(b.name))

    return { blocks, teacherOptions }
  }, [data])

  // Tanlangan o'qituvchi bo'yicha filtrlangan ko'rinish.
  const { byDay, byTeacher, hasAny } = useMemo(() => {
    const shown =
      teacherFilter === 'all' ? blocks : blocks.filter((b) => b.teacherKey === teacherFilter)
    const byDay: Block[][] = [[], [], [], [], [], [], []]
    const byTeacher = new Map<string, { teacher: string; groups: Block[] }>()
    for (const b of shown) {
      for (const d of b.days) byDay[d].push(b)
      if (!byTeacher.has(b.teacherKey)) byTeacher.set(b.teacherKey, { teacher: b.teacher, groups: [] })
      byTeacher.get(b.teacherKey)!.groups.push(b)
    }
    for (const col of byDay) col.sort((a, b) => a.start.localeCompare(b.start))
    return { byDay, byTeacher: [...byTeacher.values()], hasAny: shown.length > 0 }
  }, [blocks, teacherFilter])

  // Kun tanlangan bo'lsa — shu kunning bloklari (allaqachon boshlanish vaqti bo'yicha saralangan).
  const dayBlocks = dayFilter === 'all' ? null : byDay[dayFilter]

  return (
    <Card
      title="Dars jadvali"
      sub="Guruhlarning haftalik jadvali — o'qituvchi va kunni tanlab, faqat kerakli jadvalni ko'rish mumkin"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {teacherOptions.length > 0 && (
            <select
              value={teacherFilter}
              onChange={(e) => setTeacherFilter(e.target.value)}
              className={selectClass}
              aria-label="O'qituvchini tanlang"
            >
              <option value="all">Barcha o'qituvchilar</option>
              {teacherOptions.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.name}
                </option>
              ))}
            </select>
          )}
          <select
            value={dayFilter}
            onChange={(e) => setDayFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className={selectClass}
            aria-label="Kunni tanlang"
          >
            <option value="all">Barcha kunlar</option>
            {DAYS.map((day, d) => (
              <option key={day} value={d}>
                {day}
              </option>
            ))}
          </select>
        </div>
      }
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
          <p>
            {teacherFilter === 'all'
              ? "Guruh yaratishda hafta kunlari va vaqtni belgilang — jadval shu yerda chiqadi."
              : "Bu o'qituvchining vaqti belgilangan guruhi yo'q."}
          </p>
        </div>
      ) : dayFilter !== 'all' && (dayBlocks?.length ?? 0) === 0 ? (
        <div className="state">
          <div className="state-icon">
            <CalendarRange className="h-6 w-6" />
          </div>
          <h4>Bu kunda dars yo'q</h4>
          <p>
            {teacherFilter === 'all'
              ? `${DAYS[dayFilter]} kuni uchun rejalashtirilgan guruh yo'q.`
              : `${DAYS[dayFilter]} kuni bu o'qituvchining darsi yo'q.`}
          </p>
        </div>
      ) : dayFilter !== 'all' ? (
        <>
          {/* Bitta kunlik ro'yxat: tanlangan kunning darslari, boshlanish vaqti bo'yicha saralangan */}
          <div className="space-y-2">
            <div
              className={
                'inline-block rounded-lg px-3 py-1.5 text-sm font-semibold ' +
                (dayFilter === todayIdx ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600')
              }
            >
              {DAYS[dayFilter]}
            </div>
            {(dayBlocks ?? []).map((b) => (
              <div
                key={b.groupId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                style={{ background: b.color.bg, borderColor: b.color.bd, color: b.color.fg }}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{b.name}</p>
                  <p className="truncate text-xs opacity-80">
                    {b.teacher}
                    {b.course ? ` · ${b.course}` : ''}
                    {b.room ? ` · ${b.room}` : ''}
                  </p>
                </div>
                <p className="whitespace-nowrap font-mono text-sm font-semibold">
                  {b.start}
                  {b.end ? `–${b.end}` : ''}
                </p>
              </div>
            ))}
          </div>
        </>
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
                    <span className="h-2 w-2 rounded-full" style={{ background: g.color.fg }} />
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
