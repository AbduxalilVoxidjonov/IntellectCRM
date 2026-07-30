import { Award } from 'lucide-react'
import type { TeacherRetentionSummary } from '@/api/services/retentionBonus'
import { formatMoney, formatDate, cn } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Loader } from '@/components/ui/Loader'

interface Props {
  data: TeacherRetentionSummary | null
  loading?: boolean
  /** O'qituvchi ilovasida sarlavha boshqacha bo'ladi. */
  title?: string
}

/**
 * O'QITUVCHINING USHLAB TURISH BONUSLARI — admin profilidagi «Bonus» tabi va o'qituvchi
 * ilovasidagi maosh sahifasi AYNAN shu komponentni ishlatadi (raqamlar ikki joyda ikki xil
 * ko'rinmasin).
 *
 * DIQQAT: bu summalar maosh (`SalaryLedger`) raqamlariga QO'SHILMAGAN — bonus alohida qayd.
 * Pul odatdagi maosh to'lovi orqali beriladi.
 */
export function TeacherBonusPanel({ data, loading, title = 'Ushlab turish bonuslari' }: Props) {
  if (loading) return <Loader />

  const items = data?.items ?? []

  return (
    <Card title={title} className="p-0">
      <div className="flex flex-wrap items-center gap-6 border-b border-slate-100 px-4 py-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Jami bonus</div>
          <div className="text-xl font-bold text-emerald-600">{formatMoney(data?.total ?? 0)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Bonuslar soni</div>
          <div className="text-xl font-bold text-slate-800">{data?.count ?? 0}</div>
        </div>
        <p className="ml-auto max-w-md text-xs text-slate-400">
          Bonus o'quvchini uzoq muddat ushlab turgani uchun beriladi. Bu summa maosh
          hisob-kitobiga <b>qo'shilmagan</b> — u alohida qayd; pul odatdagi maosh to'lovi
          orqali beriladi.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-slate-400">
          <Award className="h-8 w-8 text-slate-300" />
          Hali bonus berilmagan.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">O'quvchi</th>
                <th className="px-4 py-3">Davr</th>
                <th className="px-4 py-3 text-right">Oy</th>
                <th className="px-4 py-3 text-right">Summa</th>
                <th className="px-4 py-3">Berilgan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.map((x) => (
                <tr
                  key={x.awardId}
                  className={cn('hover:bg-slate-50/60', x.status === 'cancelled' && 'opacity-50')}
                >
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {x.studentName}
                    {x.status === 'cancelled' && (
                      <Badge tone="red" className="ml-2">
                        bekor qilingan
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {x.periodFrom} … {x.periodTo}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-600">{x.months}</td>
                  <td
                    className={cn(
                      'px-4 py-3 text-right font-semibold',
                      x.status === 'cancelled' ? 'text-slate-400 line-through' : 'text-emerald-600',
                    )}
                  >
                    {formatMoney(x.amount)}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {formatDate(x.givenAt)}
                    {x.givenBy ? ` · ${x.givenBy}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
