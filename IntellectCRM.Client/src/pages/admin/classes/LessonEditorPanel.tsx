import { useEffect, useState } from 'react'
import { Trash2, CalendarClock, AlertTriangle } from 'lucide-react'
import type { ScheduleLesson, Subject, Teacher } from '@/types'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Input'
import { weekDays } from '@/config/constants'

export interface SlotTarget {
  day: number
  period: number
  /** Ushbu (day, period) dagi MAVJUD dars (0 yoki 1 ta). */
  lessons: ScheduleLesson[]
}

/** O'qituvchi → band soatlar. ScheduleBoard tomonidan uzatiladi. */
export type OccupiedSlots = Record<
  string,
  { day: number; period: number; className: string; templateName: string }[]
>

interface Props {
  slot: SlotTarget | null
  subjects: Subject[]
  teachers: Teacher[]
  /** Boshqa template'lardagi o'qituvchi band soatlari — ziddiyat aniqlash uchun. */
  occupiedSlots: OccupiedSlots
  /** Yangi to'liq holatni saqlash. */
  onSave: (day: number, period: number, lessons: ScheduleLesson[]) => void
  onClear: (day: number, period: number) => void
}

interface Row {
  subjectId: string
  teacherId: string
}

const emptyRow: Row = { subjectId: '', teacherId: '' }

/**
 * Jadval yonidagi inline tahrir paneli.
 * Fan + o'qituvchi tanlanadi. Tanlangan o'qituvchi shu soatda boshqa sinfda
 * band bo'lsa — ogohlantirish ko'rsatiladi va saqlash bloklanadi.
 */
export function LessonEditorPanel({ slot, subjects, teachers, occupiedSlots, onSave, onClear }: Props) {
  const [whole, setWhole] = useState<Row>(emptyRow)

  useEffect(() => {
    if (!slot) return
    const lesson = slot.lessons[0]
    // eslint-disable-next-line react-hooks/set-state-in-effect -- katak o'zgarganda formani sinxronlash (maqsadli)
    setWhole(lesson ? { subjectId: lesson.subjectId, teacherId: lesson.teacherId } : emptyRow)
  }, [slot])

  if (!slot) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
        <CalendarClock className="mx-auto mb-2 h-6 w-6 text-slate-300" />
        Soatni tanlash uchun jadvaldagi katakni bosing.
      </div>
    )
  }

  const teachersFor = (subjectId: string) =>
    subjectId ? teachers.filter((t) => t.subjectIds.includes(subjectId)) : []

  /** Berilgan o'qituvchi joriy (day, period) da boshqa template'da band ekanligini aniqlaydi. */
  const conflictOf = (teacherId: string) => {
    if (!teacherId) return null
    return (
      occupiedSlots[teacherId]?.find((s) => s.day === slot.day && s.period === slot.period) ?? null
    )
  }

  const updateRow = (key: 'subjectId' | 'teacherId', val: string) => {
    if (key === 'subjectId') {
      const next: Row = { subjectId: val, teacherId: '' }
      if (val && whole.teacherId && teachersFor(val).some((t) => t.id === whole.teacherId))
        next.teacherId = whole.teacherId
      setWhole(next)
    } else {
      setWhole({ ...whole, [key]: val })
    }
  }

  const wholeConflict = conflictOf(whole.teacherId)

  const handleSave = () => {
    if (wholeConflict || !whole.subjectId) return
    onSave(slot.day, slot.period, [
      { day: slot.day, period: slot.period, subjectId: whole.subjectId, teacherId: whole.teacherId },
    ])
  }

  const hasLesson = slot.lessons.length > 0
  const canSave = !wholeConflict && !!whole.subjectId

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      {/* Qaysi soat yaratilayotgani */}
      <div className="mb-4 rounded-xl bg-brand-50 px-4 py-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-brand-500">
          {hasLesson ? 'Tahrirlanmoqda' : 'Yaratilmoqda'}
        </p>
        <p className="text-base font-semibold text-brand-700">
          {weekDays[slot.day]} · {slot.period}-dars
        </p>
      </div>

      <div className="space-y-4">
        <RowFields
          subjects={subjects}
          row={whole}
          onChange={updateRow}
          teachersFor={teachersFor}
          conflict={wholeConflict}
        />

        <div className="flex flex-col gap-2">
          <Button onClick={handleSave} disabled={!canSave} className="w-full">
            {hasLesson ? 'Saqlash' : 'Yaratish'}
          </Button>
          {hasLesson && (
            <Button variant="danger" onClick={() => onClear(slot.day, slot.period)} className="w-full">
              <Trash2 className="h-4 w-4" /> Tozalash
            </Button>
          )}
        </div>

        <p className="text-xs text-slate-400">
          Saqlagandan so'ng boshqa katakni bosib keyingi soatni yarataverasiz — panel ochiqligicha
          qoladi.
        </p>
      </div>
    </div>
  )
}

interface ConflictInfo {
  className: string
  templateName: string
}

function RowFields({
  subjects,
  row,
  onChange,
  teachersFor,
  conflict,
}: {
  subjects: Subject[]
  row: Row
  onChange: (key: 'subjectId' | 'teacherId', value: string) => void
  teachersFor: (subjectId: string) => Teacher[]
  conflict: ConflictInfo | null
}) {
  const avail = teachersFor(row.subjectId)
  return (
    <div className="space-y-3">
      <Select label="Fan" value={row.subjectId} onChange={(e) => onChange('subjectId', e.target.value)}>
        <option value="">Tanlanmagan</option>
        {subjects.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>

      <Select
        label="O'qituvchi"
        value={row.teacherId}
        disabled={!row.subjectId}
        onChange={(e) => onChange('teacherId', e.target.value)}
      >
        <option value="">Tanlanmagan</option>
        {avail.map((t) => (
          <option key={t.id} value={t.id}>
            {t.fullName}
          </option>
        ))}
      </Select>

      {row.subjectId && avail.length === 0 && (
        <p className="text-xs text-amber-600">Bu fanga biriktirilgan o'qituvchi yo'q.</p>
      )}

      {/* Ziddiyat ogohlantirilmasi */}
      {conflict && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <div className="text-xs text-red-700">
            <p className="font-semibold">Ziddiyat topildi!</p>
            <p className="mt-0.5">
              Bu o'qituvchi{' '}
              <span className="font-semibold">{conflict.className}-guruh</span>
              {' '}da shu soatda allaqachon dars bor{' '}
              <span className="text-red-500">({conflict.templateName})</span>.
            </p>
            <p className="mt-1 font-medium">Boshqa o'qituvchi tanlang.</p>
          </div>
        </div>
      )}
    </div>
  )
}
