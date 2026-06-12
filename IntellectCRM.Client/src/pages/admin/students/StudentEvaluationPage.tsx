import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, ClipboardList, CalendarRange } from 'lucide-react'
import type { EvaluationBoard, EvaluationRow } from '@/types'
import { getEvaluationBoard, setEvaluationGrade } from '@/api/services/studentEvaluation'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { PageHeader } from '@/components/ui/PageHeader'
import { Loader } from '@/components/ui/Loader'

const control =
  'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-100'

type Sort = 'class' | 'name' | 'att-desc' | 'att-asc' | 'grade-desc' | 'grade-asc'

const emptyBoard: EvaluationBoard = { months: [], month: '', week: 0, types: [], rows: [], subjectId: 'all', subjects: [] }

const uzMonths = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
]

function monthLabel(m: string): string {
  if (!m || m.length < 7) return m
  const y = m.slice(0, 4)
  const idx = Number(m.slice(5, 7)) - 1
  return `${uzMonths[idx] ?? m} ${y}`
}

function recalcAvg(grades: Record<string, number>): number {
  const vals = Object.values(grades)
  if (vals.length === 0) return 0
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
}

export function StudentEvaluationPage() {
  const [board, setBoard] = useState<EvaluationBoard>(emptyBoard)
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState('')
  const [search, setSearch] = useState('')
  const [groupId, setGroupId] = useState('all')
  const [sort, setSort] = useState<Sort>('class')
  /** Tanlangan fan id — baho shu fan bo'yicha qo'yiladi (guruh tanlansa = guruh kursi). */
  const [subjectId, setSubjectId] = useState('')

  const load = useCallback((m?: string, subj?: string, grp?: string) => {
    setLoading(true)
    getEvaluationBoard(m || undefined, 0, subj, grp)
      .then((b) => {
        setBoard(b)
        setMonth(b.month)
        // Guruh tanlangan bo'lsa fan = guruh kursi (backend o'rnatadi) — sinxronlaymiz.
        if (grp && grp !== 'all') setSubjectId(b.subjectId ?? '')
      })
      .finally(() => setLoading(false))
  }, [])

  // Dastlab fanlar ro'yxatini olish uchun yuklaymiz (subjectsiz).
  useEffect(() => {
    load(undefined, undefined, undefined)
  }, [load])

  // "Barcha guruhlar" rejimida fanlar kelgach birinchi fanni avtomatik tanlaymiz.
  useEffect(() => {
    if (groupId === 'all' && !subjectId && board.subjects && board.subjects.length > 0) {
      const first = board.subjects[0].id
      setSubjectId(first)
      load(board.month || undefined, first, 'all')
    }
  }, [board.subjects, board.month, subjectId, groupId, load])

  const editable = subjectId !== '' && subjectId !== 'all'

  const onMonth = (m: string) => {
    setMonth(m)
    load(m, groupId === 'all' ? subjectId : undefined, groupId)
  }

  const onSubject = (s: string) => {
    setSubjectId(s)
    load(month, s, 'all') // fan tanlash faqat "Barcha guruhlar" rejimida.
  }

  const onGroup = (g: string) => {
    setGroupId(g)
    if (g === 'all') load(month, subjectId || undefined, 'all')
    else load(month, undefined, g) // fan = guruh kursi (avtomatik).
  }

  const rows = useMemo(() => {
    let r = board.rows
    const q = search.trim().toLowerCase()
    if (q) r = r.filter((x) => x.fullName.toLowerCase().includes(q))
    const arr = [...r]
    switch (sort) {
      case 'name':
        arr.sort((a, b) => a.fullName.localeCompare(b.fullName))
        break
      case 'att-desc':
        arr.sort((a, b) => b.attended - a.attended)
        break
      case 'att-asc':
        arr.sort((a, b) => a.attended - b.attended)
        break
      case 'grade-desc':
        arr.sort((a, b) => b.avgGrade - a.avgGrade)
        break
      case 'grade-asc':
        arr.sort((a, b) => a.avgGrade - b.avgGrade)
        break
    }
    return arr
  }, [board.rows, search, sort])

  const onGrade = (studentId: string, typeId: string, score: number | null) => {
    if (!editable) return // "Hammasi (o'rtacha)" — faqat ko'rish
    setBoard((prev) => ({
      ...prev,
      rows: prev.rows.map((r) => {
        if (r.studentId !== studentId) return r
        const grades = { ...r.grades }
        if (score == null) delete grades[typeId]
        else grades[typeId] = score
        return { ...r, grades, avgGrade: recalcAvg(grades) }
      }),
    }))
    setEvaluationGrade(studentId, typeId, month, 0, score, subjectId).catch(() => {
      alert('Bahoni saqlashda xatolik — qayta yuklanmoqda')
      load(month, subjectId)
    })
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="O'quvchilarga feedback"
        sub="Har oy bir marta — fan kesimida feedback turlari (yozma, og'zaki/suhbat...) bo'yicha 1-5"
      />

      {/* Filtrlar — bir qatorda: Oy · Guruh · Fan · qidiruv · saralash */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
        <CalendarRange className="h-5 w-5 shrink-0 text-brand-600" />
        <span className="text-sm font-medium text-slate-600">Oy:</span>
        <select className={control} value={month} onChange={(e) => onMonth(e.target.value)}>
          {(board.months.length ? board.months : month ? [month] : []).map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
        <span className="text-sm font-medium text-slate-600">Guruh:</span>
        <select className={control} value={groupId} onChange={(e) => onGroup(e.target.value)}>
          <option value="all">Barcha guruhlar</option>
          {(board.groups ?? []).map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <span className="text-sm font-medium text-slate-600">Fan:</span>
        <select
          className={control}
          value={subjectId}
          disabled={groupId !== 'all'}
          title={groupId !== 'all' ? 'Guruh tanlanganda fan = guruh kursi' : undefined}
          onChange={(e) => onSubject(e.target.value)}
        >
          {(board.subjects ?? []).length === 0 && <option value="">Fan yo'q</option>}
          {(board.subjects ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className={cn(control, 'w-48 pl-9')}
            placeholder="Ism bo'yicha qidirish..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className={control} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="class">Saralash: guruh</option>
          <option value="name">Ism (A-Z)</option>
          <option value="att-desc">Qatnashgan ko'pdan</option>
          <option value="att-asc">Qatnashgan kamdan</option>
          <option value="grade-desc">Baho yuqoridan</option>
          <option value="grade-asc">Baho pastdan</option>
        </select>
        <span className="ml-auto text-sm text-slate-400">{rows.length} o'quvchi</span>
      </div>

      {loading ? (
        <Loader label="Yuklanmoqda..." />
      ) : board.types.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
            <ClipboardList className="h-7 w-7 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-600">Hali feedback nomi yo'q</p>
          <p className="max-w-sm text-sm text-slate-400">
            Avval{' '}
            <Link
              to="/admin/students/baholash-turlari"
              className="font-medium text-brand-600 hover:underline"
            >
              Feedback nomi
            </Link>{' '}
            bo'limida nom qo'shing — keyin shu yerda har bir nom bo'yicha 1-5 feedback qo'yasiz.
          </p>
        </Card>
      ) : (
        <Card tight>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-10">#</th>
                  <th>FISH</th>
                  <th>Guruh</th>
                  <th className="text-center">Qatnashgan</th>
                  <th>Davomat sabablari</th>
                  {board.types.map((t) => (
                    <th key={t.id} className="text-center" title={t.description}>
                      {t.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <EvalRow
                    key={row.studentId}
                    row={row}
                    index={i}
                    typeIds={board.types.map((t) => t.id)}
                    editable={editable}
                    onGrade={onGrade}
                  />
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={5 + board.types.length}
                      className="px-4 py-12 text-center text-slate-400"
                    >
                      Hech narsa topilmadi
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
  editable,
  onGrade,
}: {
  row: EvaluationRow
  index: number
  typeIds: string[]
  editable: boolean
  onGrade: (studentId: string, typeId: string, score: number | null) => void
}) {
  return (
    <tr>
      <td className="font-mono text-slate-400">{index + 1}</td>
      <td className="whitespace-nowrap font-medium text-slate-800">{row.fullName}</td>
      <td className="whitespace-nowrap text-slate-500">{row.className}</td>
      <td className="whitespace-nowrap text-center">
        {row.conducted > 0 ? (
          <span className="font-mono font-semibold text-slate-700">
            {row.attended}
            <span className="text-slate-400"> / {row.conducted}</span>
          </span>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
      <td>
        {row.reasons.length === 0 ? (
          <span className="text-slate-300">—</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {row.reasons.map((r) => (
              <Badge key={r.reasonId} tone={r.isLate ? 'amber' : 'red'}>
                <span title={r.name}>{r.short || r.name}</span>
                <span className="font-semibold">×{r.count}</span>
              </Badge>
            ))}
          </div>
        )}
      </td>
      {typeIds.map((typeId) => (
        <td key={typeId} className="text-center">
          <GradeSelect
            value={row.grades[typeId] ?? null}
            disabled={!editable}
            onChange={(score) => onGrade(row.studentId, typeId, score)}
          />
        </td>
      ))}
    </tr>
  )
}

const gradeColor: Record<number, string> = {
  5: 'text-emerald-700 border-emerald-200 bg-emerald-50',
  4: 'text-brand-700 border-brand-200 bg-brand-50',
  3: 'text-amber-700 border-amber-200 bg-amber-50',
  2: 'text-red-600 border-red-200 bg-red-50',
  1: 'text-red-700 border-red-300 bg-red-50',
}

function GradeSelect({
  value,
  onChange,
  disabled,
}: {
  value: number | null
  onChange: (score: number | null) => void
  disabled?: boolean
}) {
  return (
    <select
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      className={cn(
        'w-14 rounded-md border px-2 py-1 text-center text-sm font-semibold outline-none focus:border-brand-400',
        value ? gradeColor[value] : 'border-slate-200 bg-white text-slate-400',
        disabled && 'cursor-default opacity-90',
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
