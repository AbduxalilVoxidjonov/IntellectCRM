import { useEffect, useMemo, useState } from 'react'
import { Trophy, CalendarClock } from 'lucide-react'
import type {
  AssignmentScoreboard,
  AssignmentScoreColumn,
  AssignmentScoreRow,
  AssignmentFormat,
  Group,
} from '@/types'
import { getClasses } from '@/api/services/classes'
import { getAssignmentScoreboard } from '@/api/services/assignments'
import { formatDate } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { PageHeader } from '@/components/ui/PageHeader'
import { Loader } from '@/components/ui/Loader'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Input'

const formatLabel: Record<AssignmentFormat, string> = {
  written: 'Yozma',
  file: 'Fayl',
  test: 'Test',
  video: 'Video',
  speaking: 'Speaking',
}

/** Ball nisbatiga qarab rang (yashil = yaxshi, sariq = o'rta, qizil = past). */
function scoreColor(score: number, max: number): string {
  if (max <= 0) return 'text-slate-700'
  const r = score / max
  if (r >= 0.85) return 'text-emerald-600'
  if (r >= 0.5) return 'text-amber-600'
  return 'text-red-500'
}

/**
 * Admin "Topshiriqlar bali" — asosiy jadval qisqa (№ / F.I.Sh. / Sinf / Jami ball).
 * O'quvchi bosilganda uning barcha topshiriqlari vertikal ro'yxat (modal) bo'lib ochiladi —
 * shuning uchun topshiriq ko'paysa ham jadval enga kengaymaydi.
 */
export function AssignmentScoresPage() {
  const [classes, setClasses] = useState<Group[]>([])
  const [classId, setClassId] = useState('')
  const [board, setBoard] = useState<AssignmentScoreboard | null>(null)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<AssignmentScoreRow | null>(null)
  const [sort, setSort] = useState<'name' | 'high' | 'low'>('name')

  useEffect(() => {
    getClasses().then((cl) => {
      setClasses(cl)
      if (cl.length > 0) setClassId(cl[0].id)
    })
  }, [])

  useEffect(() => {
    if (!classId) return
    setLoading(true)
    setSelected(null)
    getAssignmentScoreboard(classId)
      .then(setBoard)
      .finally(() => setLoading(false))
  }, [classId])

  // Topshiriq id → ustun (modalda nom/fan/maks ball ko'rsatish uchun).
  const colById = useMemo(() => {
    const m = new Map<string, AssignmentScoreColumn>()
    for (const a of board?.assignments ?? []) m.set(a.assignmentId, a)
    return m
  }, [board])

  const hasAssignments = (board?.assignments.length ?? 0) > 0

  // Saralash: ism (backend tartibi), yuqori ball, past ball. Baholanmaganlar doim oxirida.
  const sortedStudents = useMemo(() => {
    const list = [...(board?.students ?? [])]
    if (sort === 'name') return list
    return list.sort((a, b) => {
      const ag = a.gradedCount > 0
      const bg = b.gradedCount > 0
      if (ag !== bg) return ag ? -1 : 1
      if (!ag) return 0
      return sort === 'high' ? b.totalScore - a.totalScore : a.totalScore - b.totalScore
    })
  }, [board, sort])

  return (
    <div>
      <PageHeader
        title="Topshiriqlar bali"
        sub="O'quvchini bosing — uning barcha topshiriq ballari ochiladi"
        actions={
          <>
            <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
              {classes.length === 0 && <option value="">Guruh yo'q</option>}
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select
              value={sort}
              onChange={(e) => setSort(e.target.value as 'name' | 'high' | 'low')}
            >
              <option value="name">Ism bo'yicha (A–Z)</option>
              <option value="high">Yuqori ball bo'yicha</option>
              <option value="low">Past ball bo'yicha</option>
            </Select>
          </>
        }
      />

      {loading ? (
        <Card>
          <Loader label="Yuklanmoqda..." />
        </Card>
      ) : !board || !hasAssignments ? (
        <Card>
          <div className="state">
            <div className="state-icon">
              <Trophy className="h-6 w-6" />
            </div>
            <h4>Topshiriq berilmagan</h4>
            <p>Bu guruhga hali topshiriq berilmagan.</p>
          </div>
        </Card>
      ) : board.students.length === 0 ? (
        <Card>
          <div className="state">
            <h4>O'quvchi yo'q</h4>
            <p>Guruhda hali o'quvchi yo'q.</p>
          </div>
        </Card>
      ) : (
        <Card tight>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-12">№</th>
                  <th>F.I.Sh.</th>
                  <th className="w-24">Guruh</th>
                  <th className="num w-40">Jami ball</th>
                </tr>
              </thead>
              <tbody>
                {sortedStudents.map((row, i) => (
                  <tr
                    key={row.studentId}
                    onClick={() => setSelected(row)}
                    className="cursor-pointer"
                  >
                    <td className="num text-slate-400">{i + 1}</td>
                    <td className="font-medium text-slate-700">{row.fullName}</td>
                    <td className="text-slate-500">{row.className}</td>
                    <td className="num">
                      {row.gradedCount > 0 ? (
                        <span className={`font-semibold ${scoreColor(row.totalScore, row.totalMax)}`}>
                          {row.totalScore}
                          <span className="font-normal text-slate-400"> / {row.totalMax}</span>
                        </span>
                      ) : (
                        <span className="text-slate-300">— / —</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* O'quvchi tafsiloti — barcha topshiriqlar vertikal */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        size="md"
        title={selected?.fullName}
      >
        {selected && (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              {selected.className}-guruh ·{' '}
              {selected.gradedCount > 0 ? (
                <span className={scoreColor(selected.totalScore, selected.totalMax)}>
                  Jami <span className="font-mono">{selected.totalScore} / {selected.totalMax}</span> ball
                </span>
              ) : (
                "hali baholanmagan"
              )}
            </p>

            <div className="space-y-2">
              {selected.cells.map((c) => {
                const col = colById.get(c.assignmentId)
                if (!col) return null
                return (
                  <div
                    key={c.assignmentId}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800">{col.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                        <Badge tone="violet">{formatLabel[col.format]}</Badge>
                        {col.subjectName && <Badge>{col.subjectName}</Badge>}
                        {col.dueDate && (
                          <span className="inline-flex items-center gap-1 text-amber-600">
                            <CalendarClock className="h-3.5 w-3.5" />
                            <span className="font-mono">{formatDate(col.dueDate)}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      {c.score !== null ? (
                        <span className={`font-mono text-lg font-bold ${scoreColor(c.score, col.maxScore)}`}>
                          {c.score}
                          <span className="text-sm font-normal text-slate-400"> / {col.maxScore}</span>
                        </span>
                      ) : c.completed ? (
                        <span className="text-xs font-medium text-slate-500">Tekshirilmoqda</span>
                      ) : (
                        <span className="text-xs font-medium text-red-400">Bajarilmagan</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
