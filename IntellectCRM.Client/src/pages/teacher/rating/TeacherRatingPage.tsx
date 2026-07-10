import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Medal, Trophy } from 'lucide-react'
import { getMyStudentRating } from '@/api/services/teacher'
import type { TeacherRating } from '@/types'
import { apiErrorMessage } from '@/lib/utils'
import { Loader } from '@/components/ui/Loader'

/** Podium (TOP-3) rangi va medal fon rangi — o'rin bo'yicha. */
const PODIUM_STYLE: Record<number, { ring: string; medal: string; label: string }> = {
  1: { ring: 'from-amber-400 to-amber-600', medal: 'bg-amber-100 text-amber-600', label: '1' },
  2: { ring: 'from-slate-300 to-slate-500', medal: 'bg-slate-100 text-slate-600', label: '2' },
  3: { ring: 'from-orange-300 to-orange-500', medal: 'bg-orange-100 text-orange-600', label: '3' },
}

/** O'qituvchi — O'quvchilar reytingi. Ball = jurnal baholari + bajarilgan mezonlar. */
export function TeacherRatingPage() {
  const nav = useNavigate()
  const [rating, setRating] = useState<TeacherRating | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    getMyStudentRating()
      .then((d) => {
        if (alive) setRating(d)
      })
      .catch((err) => {
        if (alive) setError(apiErrorMessage(err, "Reytingni yuklab bo'lmadi"))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  const rows = rating?.rows ?? []
  const top3 = rows.slice(0, 3)
  const rest = rows.slice(3)
  const maxBall = rows[0]?.ball ?? 0

  return (
    <div className="px-4 pt-3 pb-6">
      {/* Sarlavha */}
      <div className="mb-4 flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => nav(-1)}
          className="tap-scale flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-mute shadow-[var(--shadow-card)]"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <p className="text-[17px] font-extrabold text-ink">O'quvchilar reytingi</p>
      </div>

      {loading ? (
        <Loader label="Yuklanmoqda..." />
      ) : error ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-[20px] border border-line bg-white p-8 text-center shadow-[var(--shadow-card)]">
          <p className="text-[13px] font-semibold text-rose-600">{error}</p>
        </div>
      ) : !rating || rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-[20px] border border-line bg-white p-8 text-center shadow-[var(--shadow-card)]">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-tealsoft text-teal-700">
            <Trophy className="h-6 w-6" />
          </div>
          <p className="text-[14px] font-semibold text-ink">Reyting uchun ma'lumot yo'q</p>
          <p className="text-[13px] text-mute">
            Guruhlaringizda hali jurnal bahosi yoki bajarilgan mezon qayd etilmagan.
          </p>
        </div>
      ) : (
        <>
          {/* Umumiy karta */}
          <div className="rounded-[20px] border border-line bg-white p-4 shadow-[var(--shadow-card)]">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-tealsoft text-teal-700">
                <Trophy className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-ink">
                  {rating.studentsCount} ta o'quvchi · {rating.groupsCount} ta guruh
                </p>
                <p className="truncate text-[12px] text-mute">{rating.fullName}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-[14px] border border-line bg-white p-2.5 text-center">
                <p className="text-[11px] font-semibold text-faint">Guruhlar</p>
                <p className="mt-0.5 text-[14px] font-extrabold text-ink font-mono">
                  {rating.groupsCount}
                </p>
              </div>
              <div className="rounded-[14px] border border-line bg-white p-2.5 text-center">
                <p className="text-[11px] font-semibold text-faint">O'quvchilar</p>
                <p className="mt-0.5 text-[14px] font-extrabold text-ink font-mono">
                  {rating.studentsCount}
                </p>
              </div>
              <div className="rounded-[14px] border border-line bg-white p-2.5 text-center">
                <p className="text-[11px] font-semibold text-faint">O'rtacha ball</p>
                <p className="mt-0.5 text-[14px] font-extrabold text-teal-700 font-mono">
                  {rating.averageBall.toFixed(1)}
                </p>
              </div>
            </div>
          </div>

          {/* TOP-3 podium */}
          {top3.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {top3.map((r) => {
                const style = PODIUM_STYLE[r.rank] ?? PODIUM_STYLE[3]
                return (
                  <div
                    key={r.studentId}
                    className="flex flex-col items-center gap-1.5 rounded-[16px] border border-line bg-white p-3 text-center shadow-[var(--shadow-card)]"
                  >
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br text-white ${style.ring}`}
                    >
                      <Medal className="h-5 w-5" />
                    </div>
                    <p className="line-clamp-2 text-[12px] font-bold leading-tight text-ink">
                      {r.fullName}
                    </p>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${style.medal}`}>
                      {r.rank}-o'rin
                    </span>
                    <p className="font-mono text-[15px] font-extrabold text-ink">{r.ball}</p>
                  </div>
                )
              })}
            </div>
          )}

          {/* Qolgan ro'yxat */}
          {rest.length > 0 && (
            <div className="mt-3 divide-y divide-line rounded-[20px] border border-line bg-white shadow-[var(--shadow-card)]">
              {rest.map((r) => {
                const pct = maxBall > 0 ? Math.round((r.ball / maxBall) * 100) : 0
                return (
                  <div key={r.studentId} className="px-3.5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[12px] font-bold text-mute">
                        {r.rank}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-bold text-ink">{r.fullName}</p>
                        <p className="truncate text-[11px] text-mute">{r.groups}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-mono text-[16px] font-extrabold text-ink">{r.ball}</p>
                        <p className="text-[11px] text-faint">
                          o'rtacha: {r.average.toFixed(1)}
                          {r.attendance !== null ? ` · davomat: ${r.attendance}%` : ''}
                        </p>
                      </div>
                    </div>
                    {maxBall > 0 && (
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-teal-600"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Izoh */}
          <p className="mt-3 px-1 text-center text-[11px] text-faint">
            Ball = jurnal baholari + bajarilgan mezonlar
          </p>
        </>
      )}
    </div>
  )
}
