import { useEffect, useState } from 'react'
import { ClipboardCheck } from 'lucide-react'
import type { GradingBoard, SetGrade } from '@/api/services/grading'
import { Loader } from '@/components/ui/Loader'

interface Props {
  groupId: string
  fetchBoard: (groupId: string) => Promise<GradingBoard>
  saveGrade: (req: SetGrade) => Promise<void>
}

/**
 * Guruh BAHOLASH grid'i (umumiy — admin va o'qituvchi guruh detalida ishlatiladi).
 * Qatorlar = faol o'quvchilar, ustunlar = guruhga biriktirilgan mezonlar; har katakka baho kiritiladi.
 */
export function GradingSection({ groupId, fetchBoard, saveGrade }: Props) {
  const [board, setBoard] = useState<GradingBoard | null>(null)
  const [loading, setLoading] = useState(true)
  const [scores, setScores] = useState<Record<string, string>>({})
  const [savingKey, setSavingKey] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetchBoard(groupId)
      .then((b) => {
        if (!alive) return
        setBoard(b)
        const init: Record<string, string> = {}
        b.students.forEach((s) =>
          b.criteria.forEach((c) => {
            const v = s.scores[c.id]
            init[`${s.studentId}|${c.id}`] = v != null ? String(v) : ''
          }),
        )
        setScores(init)
      })
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchBoard barqaror
  }, [groupId])

  const save = async (sid: string, cid: string, raw: string, max: number) => {
    const num = raw.trim() === '' ? 0 : Number(raw)
    if (Number.isNaN(num)) return
    const clamped = Math.max(0, Math.min(num, max))
    const key = `${sid}|${cid}`
    if (clamped !== num) setScores((s) => ({ ...s, [key]: String(clamped) }))
    setSavingKey(key)
    try {
      await saveGrade({ groupId, studentId: sid, criterionId: cid, score: clamped })
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

  if (board.students.length === 0)
    return <p className="py-8 text-center text-sm text-slate-400">Guruhda faol o'quvchi yo'q.</p>

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-left">
              O'quvchi
            </th>
            {board.criteria.map((c) => (
              <th key={c.id} className="min-w-[110px] border-b border-slate-200 px-3 py-2 text-center">
                <div className="font-semibold text-slate-700">{c.name}</div>
                <div className="font-normal normal-case text-slate-400">/{c.maxScore}</div>
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
                const key = `${s.studentId}|${c.id}`
                return (
                  <td key={c.id} className="border-b border-slate-100 px-2 py-1.5 text-center">
                    <input
                      type="number"
                      min={0}
                      max={c.maxScore}
                      step="0.5"
                      value={scores[key] ?? ''}
                      onChange={(e) => setScores((sc) => ({ ...sc, [key]: e.target.value }))}
                      onBlur={(e) => save(s.studentId, c.id, e.target.value, c.maxScore)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                      placeholder="—"
                      className={
                        'w-16 rounded-lg border px-2 py-1.5 text-center text-sm outline-none transition-colors ' +
                        (savingKey === key
                          ? 'border-emerald-300 bg-emerald-50'
                          : 'border-slate-200 focus:border-slate-400')
                      }
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
