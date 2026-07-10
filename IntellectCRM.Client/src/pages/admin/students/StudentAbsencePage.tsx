import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Download, Phone, Search, UserX, Clock3, CheckCircle2, BookOpen } from 'lucide-react'
import { getDailyAbsence, type AbsentStudent, type DailyAbsence } from '@/api/services/studentAttendance'
import { apiErrorMessage, cn, exportToCsv } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import { Badge } from '@/components/ui/Badge'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Loader } from '@/components/ui/Loader'
import { CallPickerModal, type CallOption } from '@/components/CallPickerModal'

type ChipFilter = 'absent' | 'late' | 'all'

const control =
  'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-100'

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Sanani bir kunga siljitish ("yyyy-MM-dd" satrdan — TZ siljishisiz). */
function shiftDate(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d + days)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

/** Bo'sh raqamlarni tashlab, bir xil raqamni faqat birinchi label bilan qoldiradi (CallPickerModal uchun). */
function dedupeCallOptions(options: CallOption[]): CallOption[] {
  const seen = new Set<string>()
  return options.filter((o) => {
    if (!o.number || seen.has(o.number)) return false
    seen.add(o.number)
    return true
  })
}

export function StudentAbsencePage() {
  const [date, setDate] = useState(today())
  const [data, setData] = useState<DailyAbsence | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [chip, setChip] = useState<ChipFilter>('absent')
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState('all')

  /** Qo'ng'iroq qilish — CallPickerModal uchun tanlangan o'quvchi */
  const [callStudent, setCallStudent] = useState<AbsentStudent | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sana o'zgarganda ma'lumotni qayta yuklash (maqsadli)
    setLoading(true)
    setError('')
    getDailyAbsence(date)
      .then(setData)
      .catch((err) => setError(apiErrorMessage(err, "Davomatni yuklab bo'lmadi")))
      .finally(() => setLoading(false))
  }, [date])

  const isToday = date === today()

  const groups = useMemo(() => {
    const set = new Set<string>()
    ;(data?.rows ?? []).forEach((r) => set.add(r.groupName))
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [data])

  const filtered = (data?.rows ?? []).filter((r) => {
    if (chip === 'absent' && r.isLate) return false
    if (chip === 'late' && !r.isLate) return false
    if (groupFilter !== 'all' && r.groupName !== groupFilter) return false
    const q = search.trim().toLowerCase()
    if (q && !r.fullName.toLowerCase().includes(q) && !r.groupName.toLowerCase().includes(q)) return false
    return true
  })

  const handleExport = () => {
    exportToCsv(
      `davomat_${date}.csv`,
      ['O\'quvchi', 'Guruh', 'Sabab', 'Ota-ona', 'Telefon'],
      filtered.map((r) => [r.fullName, r.groupName, r.reasonName, r.parentFullName, r.parentPhone]),
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="O'quvchilar davomati"
        sub="Shu kunda darsga kelmagan/kechikkan o'quvchilar — ota-onaga darrov qo'ng'iroq qilish uchun."
        actions={
          <Button variant="secondary" onClick={handleExport} disabled={filtered.length === 0}>
            <Download className="h-4 w-4" /> CSV
          </Button>
        }
      />

      {/* Sana boshqaruvi */}
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setDate((d) => shiftDate(d, -1))}
            className="rounded-lg border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-slate-50"
            title="Oldingi kun"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <input
            type="date"
            value={date}
            max={today()}
            onChange={(e) => setDate(e.target.value)}
            className={control}
          />
          <button
            type="button"
            disabled={isToday}
            onClick={() => setDate((d) => shiftDate(d, 1))}
            className="rounded-lg border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            title="Keyingi kun"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {!isToday && (
            <Button variant="secondary" onClick={() => setDate(today())}>
              Bugun
            </Button>
          )}
        </div>
      </Card>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      {loading ? (
        <Loader label="Yuklanmoqda..." />
      ) : (
        <>
          {/* Statistika */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Kelmadi" value={data?.absentCount ?? 0} icon={UserX} iconBg="bg-red-50" iconColor="text-red-600" />
            <StatCard label="Kechikdi" value={data?.lateCount ?? 0} icon={Clock3} iconBg="bg-amber-50" iconColor="text-amber-600" />
            <StatCard label="Davomat olindi" value={data?.markedStudents ?? 0} icon={CheckCircle2} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
            <StatCard label="Darsi o'tilgan guruh" value={data?.conductedGroups ?? 0} icon={BookOpen} iconBg="bg-brand-50" iconColor="text-brand-600" />
          </div>

          {(data?.conductedGroups ?? 0) === 0 ? (
            <Card className="py-10 text-center text-slate-400">
              Bu kunda hali hech qaysi guruhda davomat olinmagan.
            </Card>
          ) : (data?.absentCount ?? 0) === 0 && (data?.lateCount ?? 0) === 0 ? (
            <Card className="py-10 text-center">
              <p className="text-lg font-semibold text-emerald-600">Bu kunda kelmagan o'quvchi yo'q 🎉</p>
              <p className="mt-1 text-sm text-slate-400">
                Davomat olingan guruhlar: {data?.conductedGroups ?? 0}
              </p>
            </Card>
          ) : (
            <Card tight>
              {/* Filtrlar */}
              <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3">
                <div className="tabs">
                  <button
                    type="button"
                    onClick={() => setChip('absent')}
                    className={cn('tab', chip === 'absent' && 'active')}
                  >
                    Kelmaganlar ({data?.absentCount ?? 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setChip('late')}
                    className={cn('tab', chip === 'late' && 'active')}
                  >
                    Kechikkanlar ({data?.lateCount ?? 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setChip('all')}
                    className={cn('tab', chip === 'all' && 'active')}
                  >
                    Hammasi
                  </button>
                </div>
                <div className="search-inline">
                  <Search className="h-4 w-4 shrink-0 text-slate-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Ism yoki guruh bo'yicha qidirish..."
                  />
                </div>
                <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} className={control}>
                  <option value="all">Barcha guruhlar</option>
                  {groups.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
                <span className="ml-auto text-sm text-slate-400">{filtered.length} ta</span>
              </div>

              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>O'quvchi</th>
                      <th>Guruh</th>
                      <th>Dars vaqti</th>
                      <th>Sabab</th>
                      <th>Telefon</th>
                      <th className="text-right">Amallar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr key={`${r.studentId}-${r.groupId}`}>
                        <td>
                          <div>
                            <Link
                              to={`/admin/students/${r.studentId}`}
                              className="font-medium text-slate-800 no-underline hover:underline"
                            >
                              {r.fullName}
                            </Link>
                            <div className="text-xs text-slate-400">{r.parentFullName}</div>
                          </div>
                        </td>
                        <td>
                          <Badge tone="violet">{r.groupName}</Badge>
                          <div className="mt-1 text-xs text-slate-400">{r.courseName}</div>
                        </td>
                        <td className="font-mono text-slate-600">
                          {r.startTime}–{r.endTime}
                          <div className="font-sans text-xs text-slate-400">{r.teacherName}</div>
                        </td>
                        <td>
                          <Badge tone={r.isLate ? 'amber' : 'red'}>{r.reasonName}</Badge>
                        </td>
                        <td className="font-mono text-slate-600">{r.parentPhone}</td>
                        <td className="text-right">
                          <button
                            type="button"
                            title="Qo'ng'iroq qilish"
                            onClick={() => setCallStudent(r)}
                            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                          >
                            <Phone className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                          Filtrga mos o'quvchi topilmadi
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      <CallPickerModal
        open={!!callStudent}
        onClose={() => setCallStudent(null)}
        title={callStudent?.fullName}
        studentId={callStudent?.studentId}
        numbers={
          callStudent
            ? dedupeCallOptions([
                { label: "O'z raqami", number: callStudent.phone ?? '' },
                { label: 'Ota-ona', number: callStudent.parentPhone },
                { label: 'Otasi', number: callStudent.fatherPhone ?? '' },
                { label: 'Onasi', number: callStudent.motherPhone ?? '' },
              ])
            : []
        }
      />
    </div>
  )
}
