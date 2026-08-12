import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageSquareText, Search, StickyNote, User } from 'lucide-react'
import {
  getStudentNotesOverview,
  type StudentNoteOverviewRow,
} from '@/api/services/students'
import { StudentNotesThread } from '@/components/students/StudentNotesThread'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Loader } from '@/components/ui/Loader'
import { PageHeader } from '@/components/ui/PageHeader'
import { apiErrorMessage, cn, formatDateTime } from '@/lib/utils'

/** "YYYY-MM-DD" — bugundan `days` kun oldin. */
function daysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

const ranges = [
  { label: 'Butun davr', days: -1 },
  { label: '7 kun', days: 6 },
  { label: '30 kun', days: 29 },
  { label: '90 kun', days: 89 },
]

/**
 * "IZOHLARGA JAVOBLAR" — o'quvchi profillariga yozilgan izohlar BIR RO'YXATDA.
 *
 * <p>Izoh profil ichida yoziladi, ya'ni "kimda izoh bor" degan savolga javob berish uchun har bir
 * profilni ochib chiqish kerak edi. Bu sahifa aynan shu savolga javob beradi: kimga izoh yozilgan,
 * NECHTA, oxirgisi QACHON va NIMA deb yozilgan.</p>
 *
 * <p>Qatorni bosish — o'quvchining butun izoh tarixi va o'sha yerdan QO'SHIMCHA izoh yozish
 * (`StudentNotesThread` — profildagi bilan AYNAN bir xil komponent).</p>
 *
 * <p>Ruxsat: `students` (marshrutda `RequirePerm`, serverda esa
 * `[AdminPerm("students", ReadRequiresPerm = true)]` — butun markazning izohlari bir joyda
 * bo'lgani uchun o'qish ham darvozalangan).</p>
 */
export function StudentNotesPage() {
  const [rows, setRows] = useState<StudentNoteOverviewRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [term, setTerm] = useState('')
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  /** Ochilgan o'quvchi (izohlar oynasi). */
  const [open, setOpen] = useState<StudentNoteOverviewRow | null>(null)

  useEffect(() => {
    let alive = true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- filtr o'zgarganda qayta yuklash (maqsadli)
    setLoading(true)
    getStudentNotesOverview({ q: q || undefined, from: from || undefined, to: to || undefined })
      .then((r) => {
        if (!alive) return
        setRows(r)
        setError('')
      })
      .catch((e) => alive && setError(apiErrorMessage(e, "Ro'yxatni yuklab bo'lmadi")))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [q, from, to])

  const totalNotes = rows.reduce((sum, r) => sum + r.noteCount, 0)

  /**
   * Oynada izoh qo'shilsa/o'chirilsa ro'yxatdagi son ham yangilanadi — sahifani qayta
   * yuklamasdan (aks holda "3 ta izoh" deb turgan qator eskirib qolardi).
   */
  const applyCount = (studentId: string, count: number) => {
    setRows((prev) =>
      prev
        .map((r) => (r.studentId === studentId ? { ...r, noteCount: count } : r))
        // Izohi qolmagan o'quvchi ro'yxatda turmasin (server ham uni qaytarmasdi).
        .filter((r) => r.noteCount > 0),
    )
    setOpen((prev) => (prev && prev.studentId === studentId ? { ...prev, noteCount: count } : prev))
  }

  return (
    <div>
      <PageHeader
        title="Izohlarga javoblar"
        sub="O'quvchi profillariga yozilgan izohlar bir joyda — kimga, nechta va nima deb yozilgan"
      />

      <Card
        className="mb-4"
        title="Filtr"
        sub="Qidiruv o'quvchi ismi bo'yicha ham, izoh matni bo'yicha ham ishlaydi."
      >
        <div className="flex flex-wrap items-end gap-3">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              setQ(term.trim())
            }}
          >
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Ism yoki izoh matni"
              className="min-w-[220px] rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-400"
            />
            <Button type="submit" variant="secondary">
              <Search className="h-4 w-4" />
            </Button>
          </form>

          {ranges.map((r) => {
            const value = r.days < 0 ? '' : daysAgo(r.days)
            const active = from === value && (r.days < 0 ? !to : true)
            return (
              <button
                key={r.label}
                type="button"
                onClick={() => {
                  setFrom(value)
                  setTo('')
                }}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                  active
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                )}
              >
                {r.label}
              </button>
            )
          })}

          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Sanadan
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-400"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Sanagacha
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-400"
            />
          </label>
        </div>
      </Card>

      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <Card
        tight
        title={
          <span className="inline-flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-slate-400" /> Izoh yozilgan o'quvchilar
          </span>
        }
        sub={
          loading
            ? undefined
            : `${rows.length} ta o'quvchi · ${totalNotes} ta izoh — eng yangi izoh tepada`
        }
      >
        {loading ? (
          <div className="p-6">
            <Loader label="Yuklanmoqda..." />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">
            {q || from || to ? 'Bu filtrlarda izoh topilmadi' : 'Hali hech kimga izoh yozilmagan'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>F.I.Sh</th>
                  <th>Guruhi</th>
                  <th className="num">Izohlar</th>
                  <th>Oxirgi izoh</th>
                  <th>Nima deb yozilgan</th>
                  <th>Kim yozgan</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.studentId}
                    onClick={() => setOpen(r)}
                    className="cursor-pointer transition-colors hover:bg-slate-50"
                  >
                    <td>
                      <span className="font-semibold text-slate-800">{r.fullName}</span>
                      {r.isArchived && (
                        <span className="ml-2 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">
                          arxivda
                        </span>
                      )}
                    </td>
                    <td className="text-sm text-slate-600">
                      {r.groups.length > 0 ? r.groups.join(', ') : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="num font-semibold text-slate-700">{r.noteCount}</td>
                    <td className="whitespace-nowrap text-sm text-slate-500">
                      {formatDateTime(r.lastNoteAt)}
                    </td>
                    <td className="max-w-[380px] truncate text-sm text-slate-700" title={r.lastNoteText}>
                      {r.lastNoteText}
                    </td>
                    <td className="text-sm text-slate-500">{r.lastAuthorName || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {rows.length >= 200 && !loading && (
        <p className="mt-3 text-center text-xs text-slate-400">
          Eng so'nggi 200 ta o'quvchi ko'rsatildi — davrni toraytiring yoki qidiruvdan foydalaning.
        </p>
      )}

      {/* ---------- Bitta o'quvchining butun izoh tarixi + qo'shimcha izoh ---------- */}
      <Modal
        open={!!open}
        onClose={() => setOpen(null)}
        size="lg"
        title={open ? `${open.fullName} — izohlar` : ''}
      >
        {open && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3 text-sm">
              <span className="inline-flex items-center gap-1.5 text-slate-600">
                <MessageSquareText className="h-4 w-4 text-slate-400" />
                <b className="text-slate-800">{open.noteCount}</b> ta izoh
              </span>
              {open.groups.length > 0 && (
                <span className="text-slate-500">· {open.groups.join(', ')}</span>
              )}
              {open.authors.length > 0 && (
                <span className="text-slate-500">· Yozganlar: {open.authors.join(', ')}</span>
              )}
              <Link
                to={`/admin/students/${open.studentId}`}
                className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"
              >
                <User className="h-4 w-4" /> Profilga o'tish
              </Link>
            </div>

            {/* Profildagi bilan AYNAN bir xil komponent — qoida ikki joyda ayri ketmaydi. */}
            <StudentNotesThread
              studentId={open.studentId}
              onChanged={(count) => applyCount(open.studentId, count)}
            />
          </div>
        )}
      </Modal>
    </div>
  )
}
