import { useCallback, useEffect, useState } from 'react'
import { Check, ClipboardCheck, ChevronLeft, ChevronRight } from 'lucide-react'
import type { GradingBoard, SetGrade } from '@/api/services/grading'
import { Loader } from '@/components/ui/Loader'
import { cn } from '@/lib/utils'

interface Props {
  groupId: string
  fetchBoard: (groupId: string, month?: string) => Promise<GradingBoard>
  saveGrade: (req: SetGrade) => Promise<void>
}

const MONTHS = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
]
function monthLabel(m: string) {
  const [y, mm] = m.split('-')
  return `${MONTHS[Number(mm) - 1] ?? mm} ${y}`
}

/**
 * Guruh BAHOLASH grid'i (umumiy — admin va o'qituvchi guruh detalida).
 * Mezonlar bo'yicha HAR DARSGA "bajardi/bajarmadi" belgilanadi: oy → dars sanasi tanlanadi,
 * keyin o'quvchilar × mezonlar grid'ida har katak ✓ qilinadi.
 */
export function GradingSection({ groupId, fetchBoard, saveGrade }: Props) {
  const [board, setBoard] = useState<GradingBoard | null>(null)
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState('')
  const [done, setDone] = useState<Set<string>>(new Set()) // "studentId|criterionId|date"
  const [savingKey, setSavingKey] = useState<string | null>(null)

  const load = useCallback(
    (month?: string) => {
      setLoading(true)
      fetchBoard(groupId, month)
        .then((b) => {
          setBoard(b)
          const today = new Date().toISOString().slice(0, 10)
          setDate((d) =>
            b.dates.includes(d) ? d : b.dates.includes(today) ? today : b.dates[b.dates.length - 1] ?? '',
          )
          const s = new Set<string>()
          b.students.forEach((st) => st.doneKeys.forEach((k) => s.add(`${st.studentId}|${k}`)))
          setDone(s)
        })
        .finally(() => setLoading(false))
    },
    [groupId, fetchBoard],
  )

  // eslint-disable-next-line react-hooks/exhaustive-deps -- guruh almashganda qayta yuklash
  useEffect(() => load(undefined), [groupId])

  const toggle = async (sid: string, cid: string) => {
    if (!date) return
    const key = `${sid}|${cid}|${date}`
    const next = !done.has(key)
    setDone((s) => {
      const n = new Set(s)
      if (next) n.add(key)
      else n.delete(key)
      return n
    })
    setSavingKey(key)
    try {
      await saveGrade({ groupId, studentId: sid, criterionId: cid, date, done: next })
    } finally {
      setSavingKey(null)
    }
  }

  if (loading) return <Loader label="Yuklanmoqda..." />
  if (!board || board.criteria.length === 0)
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <ClipboardCheck className="h-7 w-7 text-slate-300" />
        <p className="text-sm font-medium text-slate-500">Baholash mezoni biriktirilmagan</p>
        <p className="text-xs text-slate-400">
          O'quv bo'limi → Baholash mezonlari bo'limidan bu guruhga mezon biriktiring.
        </p>
      </div>
    )

  const idx = board.months.indexOf(board.month)
  const gotoMonth = (i: number) => {
    if (i >= 0 && i < board.months.length) load(board.months[i])
  }

  return (
    <div className="space-y-3">
      {/* Oy navigatsiyasi */}
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => gotoMonth(idx - 1)}
          disabled={idx <= 0}
          className="rounded-lg border border-slate-200 p-1.5 text-slate-500 disabled:opacity-40 hover:bg-slate-50"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-[120px] text-center text-sm font-semibold text-slate-700">
          {monthLabel(board.month)}
        </span>
        <button
          type="button"
          onClick={() => gotoMonth(idx + 1)}
          disabled={idx >= board.months.length - 1}
          className="rounded-lg border border-slate-200 p-1.5 text-slate-500 disabled:opacity-40 hover:bg-slate-50"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {board.dates.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">Bu oyda dars kuni yo'q.</p>
      ) : (
        <>
          {/* Dars sanasi tanlash */}
          <div className="flex flex-wrap justify-center gap-1.5">
            {board.dates.map((d) => {
              const day = Number(d.slice(8, 10))
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDate(d)}
                  className={cn(
                    'h-8 w-8 rounded-lg text-sm font-semibold transition-colors',
                    d === date ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                  )}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {board.students.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Guruhda faol o'quvchi yo'q.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-left">
                      O'quvchi
                    </th>
                    {board.criteria.map((c) => (
                      <th key={c.id} className="min-w-[90px] border-b border-slate-200 px-2 py-2 text-center font-semibold text-slate-700">
                        {c.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {board.students.map((s, i) => (
                    <tr key={s.studentId} className={i % 2 ? 'bg-slate-50/40' : ''}>
                      <td className="sticky left-0 z-10 border-b border-r border-slate-200 bg-inherit px-3 py-2 font-medium text-slate-700">
                        {s.fullName}
                      </td>
                      {board.criteria.map((c) => {
                        const key = `${s.studentId}|${c.id}|${date}`
                        const isDone = done.has(key)
                        return (
                          <td key={c.id} className="border-b border-slate-100 px-2 py-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => toggle(s.studentId, c.id)}
                              title={isDone ? 'Bajardi' : 'Belgilash'}
                              className={cn(
                                'mx-auto flex h-7 w-7 items-center justify-center rounded-lg border transition-colors',
                                isDone
                                  ? 'border-emerald-500 bg-emerald-500 text-white'
                                  : 'border-slate-300 bg-white text-transparent hover:border-emerald-400',
                                savingKey === key && 'ring-2 ring-emerald-200',
                              )}
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
