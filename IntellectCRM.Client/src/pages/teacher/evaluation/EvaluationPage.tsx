import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarRange, ClipboardList } from 'lucide-react'
import type { EvaluationBoard, EvaluationRow, TeacherClass } from '@/types'
import { getMyClasses, getTeacherEvalBoard, setTeacherEvalGrade } from '@/api/services/teacher'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Loader } from '@/components/ui/Loader'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Input'

const uzMonths = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
]
function monthLabel(m: string): string {
  if (!m || m.length < 7) return m
  return `${uzMonths[Number(m.slice(5, 7)) - 1] ?? m} ${m.slice(0, 4)}`
}

const empty: EvaluationBoard = { months: [], month: '', week: 0, types: [], rows: [], subjectId: '', subjects: [] }

export function TeacherEvaluationPage() {
  const [classes, setClasses] = useState<TeacherClass[]>([])
  const [classId, setClassId] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [month, setMonth] = useState('')
  const [board, setBoard] = useState<EvaluationBoard>(empty)
  const [loading, setLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(false)

  useEffect(() => {
    getMyClasses()
      .then((cl) => {
        setClasses(cl)
        setClassId(cl[0]?.classId ?? '')
      })
      .finally(() => setLoading(false))
  }, [])

  const selectedClass = classes.find((c) => c.classId === classId) ?? null
  const subjects = useMemo(() => selectedClass?.subjects ?? [], [selectedClass])

  // Guruh o'zgarganda — fanni shu guruh fanlariga moslaymiz.
  useEffect(() => {
    const ids = subjects.map((s) => s.id)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- guruh fanlariga moslash (maqsadli)
    setSubjectId((prev) => (ids.includes(prev) ? prev : (ids[0] ?? '')))
  }, [subjects])

  const load = useCallback((m: string | undefined, cId: string, sId: string) => {
    if (!cId || !sId) {
      setBoard(empty)
      return
    }
    setDataLoading(true)
    getTeacherEvalBoard(cId, sId, m)
      .then((b) => {
        setBoard(b)
        setMonth(b.month)
      })
      .finally(() => setDataLoading(false))
  }, [])

  // Guruh yoki fan o'zgarsa — eng so'nggi oy bilan yuklaymiz.
  useEffect(() => {
    load(undefined, classId, subjectId)
  }, [classId, subjectId, load])

  const onMonth = (m: string) => {
    setMonth(m)
    load(m, classId, subjectId)
  }

  const onGrade = (studentId: string, typeId: string, score: number | null) => {
    setBoard((prev) => ({
      ...prev,
      rows: prev.rows.map((r) => {
        if (r.studentId !== studentId) return r
        const grades = { ...r.grades }
        if (score == null) delete grades[typeId]
        else grades[typeId] = score
        const vals = Object.values(grades)
        const avg = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : 0
        return { ...r, grades, avgGrade: avg }
      }),
    }))
    setTeacherEvalGrade(classId, subjectId, studentId, typeId, month, score).catch(() => {
      alert('Bahoni saqlashda xatolik — qayta yuklanmoqda')
      load(month, classId, subjectId)
    })
  }

  if (loading) return <Loader label="Yuklanmoqda..." />

  return (
    <div className="px-4 pt-3 pb-6">
      <PageHeader
        title="Feedback"
        sub="O'z faningiz bo'yicha o'quvchilarga feedback nomi kesimida feedback bering (1-5, oylik)"
      />

      {/* Guruh + fan + oy tanlovi */}
      <div className="toolbar">
        <div className="left">
          <span className="text-sm font-medium text-mute">Guruh:</span>
          <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
            {classes.length === 0 && <option value="">— dars beradigan guruh yo'q —</option>}
            {classes.map((c) => (
              <option key={c.classId} value={c.classId}>
                {c.className}
              </option>
            ))}
          </Select>

          <span className="ml-1 text-sm font-medium text-mute">Fan:</span>
          <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            {subjects.length === 0 && <option value="">— fan yo'q —</option>}
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>

          <span className="ml-1 inline-flex items-center gap-1 text-sm font-medium text-mute">
            <CalendarRange className="h-4 w-4 text-teal-600" />
            Oy:
          </span>
          <Select value={month} onChange={(e) => onMonth(e.target.value)}>
            {(board.months.length ? board.months : month ? [month] : []).map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {dataLoading ? (
        <Card>
          <Loader label="Yuklanmoqda..." />
        </Card>
      ) : board.types.length === 0 ? (
        <Card>
          <div className="state">
            <div className="state-icon">
              <ClipboardList className="h-6 w-6" />
            </div>
            <h4>Hali feedback nomi yo'q</h4>
            <p>
              Feedback nomlarini administrator qo'shadi — qo'shilgach shu yerda har bir nom bo'yicha 1-5 feedback qo'yasiz.
            </p>
          </div>
        </Card>
      ) : !classId || !subjectId ? (
        <Card>
          <div className="state">
            <h4>Guruh va fan tanlang</h4>
          </div>
        </Card>
      ) : (
        <Card tight>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-10 num">№</th>
                  <th>F.I.Sh.</th>
                  {board.types.map((t) => (
                    <th key={t.id} className="text-center" title={t.description}>
                      {t.name}
                    </th>
                  ))}
                  <th className="num text-center">O'rtacha</th>
                </tr>
              </thead>
              <tbody>
                {board.rows.map((row, i) => (
                  <EvalRow
                    key={row.studentId}
                    row={row}
                    index={i}
                    typeIds={board.types.map((t) => t.id)}
                    onGrade={onGrade}
                  />
                ))}
                {board.rows.length === 0 && (
                  <tr>
                    <td colSpan={3 + board.types.length} className="px-4 py-12 text-center text-faint">
                      Bu guruhda o'quvchi yo'q
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

function EvalRow({
  row,
  index,
  typeIds,
  onGrade,
}: {
  row: EvaluationRow
  index: number
  typeIds: string[]
  onGrade: (studentId: string, typeId: string, score: number | null) => void
}) {
  return (
    <tr>
      <td className="num text-faint">{index + 1}</td>
      <td className="whitespace-nowrap font-medium text-ink">{row.fullName}</td>
      {typeIds.map((typeId) => (
        <td key={typeId} className="text-center">
          <GradeSelect
            value={row.grades[typeId] ?? null}
            onChange={(score) => onGrade(row.studentId, typeId, score)}
          />
        </td>
      ))}
      <td className="num text-center">
        {row.avgGrade > 0 ? (
          <span className="font-mono font-semibold text-ink">{row.avgGrade}</span>
        ) : (
          <span className="text-faint">—</span>
        )}
      </td>
    </tr>
  )
}

const gradeColor: Record<number, string> = {
  5: 'text-emerald-700 border-emerald-200 bg-emerald-50',
  4: 'text-teal-700 border-teal-300 bg-tealsoft',
  3: 'text-amber-700 border-amber-200 bg-amber-50',
  2: 'text-red-600 border-red-200 bg-red-50',
  1: 'text-red-700 border-red-300 bg-red-50',
}

function GradeSelect({
  value,
  onChange,
}: {
  value: number | null
  onChange: (score: number | null) => void
}) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      className={cn(
        'w-14 rounded-md border px-2 py-1 text-center font-mono text-sm font-semibold outline-none focus:border-teal-400',
        value ? gradeColor[value] : 'border-line bg-white text-faint',
      )}
    >
      <option value="">–</option>
      {[1, 2, 3, 4, 5].map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </select>
  )
}
