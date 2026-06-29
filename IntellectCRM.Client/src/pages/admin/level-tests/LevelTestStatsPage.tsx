import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check } from 'lucide-react'
import { getLevelTestOverallStats, type LevelTestOverallStats } from '@/api/services/levelTests'
import { Card } from '@/components/ui/Card'
import { Loader } from '@/components/ui/Loader'
import { PageHeader } from '@/components/ui/PageHeader'
import { cn, formatDate } from '@/lib/utils'

/**
 * Daraja testlari — UMUMIY statistika (alohida sahifa). Barcha testlarni topshirgan har bir
 * o'quvchi: qaysi testga tegishli + natija (daraja/foiz) + hozir aktivmi (guruh/o'qituvchi).
 */
export function LevelTestStatsPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<LevelTestOverallStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getLevelTestOverallStats()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <button
              onClick={() => navigate('/admin/level-tests')}
              className="rounded-lg border border-slate-200 p-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
              title="Orqaga"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            Daraja testlari — umumiy statistika
          </span>
        }
        sub="Barcha testlarni topshirgan o'quvchilar, natijalari va hozirgi holati"
      />

      {loading ? (
        <Loader label="Yuklanmoqda..." />
      ) : !stats ? (
        <Card>
          <p className="py-10 text-center text-slate-400">Statistikani yuklab bo'lmadi.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <StatBox label="Testlar" value={stats.testCount} />
            <StatBox label="Topshirganlar" value={stats.submissions} />
            <StatBox label="Aktiv o'quvchi" value={stats.active} highlight />
            <StatBox label="Havolalar (yuborilgan)" value={stats.invites} />
            <StatBox label="Havola ishlangan" value={stats.invitesUsed} />
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            O'rtacha natija: <b className="font-mono">{stats.avgPercent}%</b>
          </div>

          {/* Barcha testlarni topshirgan o'quvchilar — natija + qaysi testga tegishli + hozir aktivmi */}
          <Card title={`Topshirganlar (${stats.rows.length})`} sub="Qaysi testga tegishli + natija + hozirgi holati">
            {stats.rows.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">Hali hech kim topshirmagan.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-3 py-2">F.I.SH</th>
                      <th className="px-3 py-2">Test</th>
                      <th className="px-3 py-2">Daraja</th>
                      <th className="px-3 py-2 text-center">Foiz</th>
                      <th className="px-3 py-2 text-center">Aktiv</th>
                      <th className="px-3 py-2">Guruh</th>
                      <th className="px-3 py-2">O'qituvchi</th>
                      <th className="px-3 py-2">Sana</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {stats.rows.map((r) => (
                      <tr
                        key={r.submissionId}
                        className={cn('hover:bg-slate-50/60', r.isDeleted && 'bg-red-50/40 line-through')}
                      >
                        <td className={cn('px-3 py-2 font-medium text-slate-700', r.isDeleted && 'text-red-600')}>
                          {r.fullName}
                          {r.isDeleted && <span className="ml-1.5 text-[11px] font-normal text-red-500">(o'chirilgan)</span>}
                          <div className="font-mono text-[11px] font-normal text-slate-400">{r.phone}</div>
                        </td>
                        <td className="px-3 py-2 text-slate-500">
                          <Link to={`/admin/level-tests/${r.testId}`} className="text-inherit hover:underline">
                            {r.testTitle || '—'}
                          </Link>
                        </td>
                        <td className="px-3 py-2">
                          {r.level ? (
                            <span className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">{r.level}</span>
                          ) : '—'}
                        </td>
                        <td className="px-3 py-2 text-center font-mono text-slate-600">{r.percent}%</td>
                        <td className="px-3 py-2 text-center">
                          {r.active ? (
                            <Check className="mx-auto h-4 w-4 text-emerald-600" />
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-600">{r.groupName || <span className="text-slate-300">—</span>}</td>
                        <td className="px-3 py-2 text-slate-600">{r.teacherName || <span className="text-slate-300">—</span>}</td>
                        <td className="px-3 py-2 text-slate-500">{formatDate(r.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {stats.byLevel.length > 0 && (
            <Card title="Darajalar bo'yicha">
              <div className="flex flex-wrap gap-2">
                {stats.byLevel.map((l) => (
                  <span key={l.level} className="rounded-full bg-brand-50 px-3 py-1 text-sm text-brand-700">
                    {l.level}: <b>{l.count}</b>
                  </span>
                ))}
              </div>
            </Card>
          )}

          <Card title="Testlar kesimida">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-400">
                    <th className="px-2 py-2">Test</th>
                    <th className="px-2 py-2 text-center">Topshirgan</th>
                    <th className="px-2 py-2 text-center">Havola</th>
                    <th className="px-2 py-2 text-center">Ishlangan</th>
                    <th className="px-2 py-2 text-center">O'rtacha %</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.byTest.map((r) => (
                    <tr key={r.testId} className="border-b border-slate-50">
                      <td className="px-2 py-2 font-medium text-slate-700">
                        <Link to={`/admin/level-tests/${r.testId}`} className="text-inherit hover:underline">{r.title}</Link>
                      </td>
                      <td className="px-2 py-2 text-center font-mono">{r.submissions}</td>
                      <td className="px-2 py-2 text-center font-mono">{r.invites}</td>
                      <td className="px-2 py-2 text-center font-mono">{r.invitesUsed}</td>
                      <td className="px-2 py-2 text-center font-mono">{r.avgPercent}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

function StatBox({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-xl border px-3 py-3 text-center',
        highlight ? 'border-emerald-100 bg-emerald-50' : 'border-slate-100 bg-white',
      )}
    >
      <div className={cn('font-mono text-2xl font-bold', highlight ? 'text-emerald-700' : 'text-slate-800')}>{value}</div>
      <div className={cn('mt-0.5 text-xs', highlight ? 'text-emerald-600' : 'text-slate-400')}>{label}</div>
    </div>
  )
}
