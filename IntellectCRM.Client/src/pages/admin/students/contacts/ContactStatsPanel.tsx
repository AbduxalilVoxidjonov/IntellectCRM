import { useEffect, useState } from 'react'
import { getContactStats, type ContactStats } from '@/api/services/contacts'
import { Card } from '@/components/ui/Card'
import { Loader } from '@/components/ui/Loader'
import { apiErrorMessage, cn, formatDate } from '@/lib/utils'

/** "YYYY-MM-DD" — bugundan `days` kun oldin. */
function daysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

const ranges = [
  { label: 'Bugun', days: 0 },
  { label: '7 kun', days: 6 },
  { label: '30 kun', days: 29 },
  { label: '90 kun', days: 89 },
]

/**
 * "BOG'LANISH KERAK" HISOBOTLARI.
 *
 * <p>Barcha sonlar HODISALARDAN (`ContactAttempt`) hisoblanadi, ya'ni "kim nima qildi" bo'yicha —
 * shuning uchun bir talab bir necha marta sanalishi mumkin (har urinish alohida). Bu ataylab:
 * savol "nechta odam bilan bog'lanildi" emas, "nechta bog'lanish bo'ldi".</p>
 *
 * <p>⚠️ "Bog'lanildi" ustuni FAQAT odam bilan haqiqatan gaplashilgan urinishlarni sanaydi
 * (server: `ContactService.Reached`) — ko'tarmagan qo'ng'iroq "urinish"ga kiradi, "bog'lanildi"ga
 * emas. Aks holda hisobot haqiqiy aloqani ko'rsatmasdi.</p>
 */
export function ContactStatsPanel() {
  const [from, setFrom] = useState(daysAgo(29))
  const [to, setTo] = useState('')
  const [data, setData] = useState<ContactStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- davr o'zgarganda qayta yuklash (maqsadli)
    setLoading(true)
    getContactStats(from || undefined, to || undefined)
      .then((d) => { if (active) { setData(d); setError('') } })
      .catch((e) => { if (active) setError(apiErrorMessage(e, "Hisobotni yuklab bo'lmadi")) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [from, to])

  return (
    <div className="space-y-4">
      <Card title="Davr" sub="Sanoqlar shu davrdagi amallar bo'yicha (navbat sanoqlari — joriy holat).">
        <div className="flex flex-wrap items-end gap-3">
          {ranges.map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={() => { setFrom(daysAgo(r.days)); setTo('') }}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                from === daysAgo(r.days) && !to
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              {r.label}
            </button>
          ))}
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Sanadan
            <input
              type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-400"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Sanagacha
            <input
              type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-400"
            />
          </label>
        </div>
      </Card>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {loading || !data ? (
        <Loader label="Yuklanmoqda..." />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Yangi talab" value={data.created} hint="Davrda ochilgan" />
            <Stat label="Bog'lanildi" value={data.reached} hint={`${data.attempts} urinishdan`} tone="emerald" />
            <Stat label="Hal bo'ldi" value={data.done} tone="emerald" />
            <Stat label="Bog'lanib bo'lmadi" value={data.failed} tone="rose" />
            <Stat label="Qayta qo'ng'iroqqa o'tkazildi" value={data.callback} tone="sky" />
            <Stat label="Hozir navbatda" value={data.openNow} hint="Joriy holat" />
            <Stat label="Muddati o'tgan" value={data.overdueNow} hint="Joriy holat" tone={data.overdueNow > 0 ? 'rose' : undefined} />
            <Stat
              label="Aloqa foizi"
              value={data.attempts > 0 ? `${Math.round((data.reached / data.attempts) * 100)}%` : '—'}
              hint="Gaplashilgan / urinish"
            />
          </div>

          {/* KUNLIK — "kunlik nechta odam bilan bog'lanildi" */}
          <Card title="Kunlik" sub="Har kuni nechta yangi talab ochilgan va nechta bog'lanish bo'lgan.">
            {data.daily.every((d) => d.created + d.attempts === 0) ? (
              <p className="py-6 text-center text-sm text-slate-400">Bu davrda amal bo'lmagan</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Kun</th>
                      <th className="num">Yangi talab</th>
                      <th className="num">Urinish</th>
                      <th className="num">Bog'lanildi</th>
                      <th className="num">Hal bo'ldi</th>
                      <th className="num">Qayta qo'ng'iroq</th>
                      <th className="num">Bo'lmadi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Bo'sh kunlar chiqarilmaydi — jadval uzayib ketmasin. */}
                    {data.daily.filter((d) => d.created + d.attempts > 0).reverse().map((d) => (
                      <tr key={d.date}>
                        <td>{formatDate(d.date)}</td>
                        <td className="num">{d.created || '—'}</td>
                        <td className="num">{d.attempts || '—'}</td>
                        <td className="num font-semibold text-emerald-600">{d.reached || '—'}</td>
                        <td className="num">{d.done || '—'}</td>
                        <td className="num">{d.callback || '—'}</td>
                        <td className="num">{d.failed || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* XODIMLAR — "kim qaysi bosqichga oldi, natijasi qanday bo'ldi" */}
          <Card title="Xodimlar kesimi" sub="Kim nechta bog'lanish qildi va qaysi bosqichga o'tkazdi.">
            {data.byStaff.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">Ma'lumot yo'q</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Xodim</th>
                      <th className="num">Urinish</th>
                      <th className="num">Bog'lanildi</th>
                      <th className="num">Hal bo'ldi</th>
                      <th className="num">Qayta qo'ng'iroq</th>
                      <th className="num">Bo'lmadi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byStaff.map((s) => (
                      <tr key={s.actorName}>
                        <td className="font-medium text-slate-700">{s.actorName}</td>
                        <td className="num">{s.attempts}</td>
                        <td className="num font-semibold text-emerald-600">{s.reached}</td>
                        <td className="num">{s.done}</td>
                        <td className="num">{s.callback}</td>
                        <td className="num">{s.failed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Sabablar" sub="Qaysi sabab bilan talab ochilgan va qanchasi hal bo'lgan.">
              {data.byReason.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">Ma'lumot yo'q</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Sabab</th>
                      <th className="num">Ochilgan</th>
                      <th className="num">Hal</th>
                      <th className="num">Bo'lmadi</th>
                      <th className="num">Ochiq</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byReason.map((r) => (
                      <tr key={r.reasonLabel}>
                        <td className="text-slate-700">{r.reasonLabel}</td>
                        <td className="num">{r.created}</td>
                        <td className="num text-emerald-600">{r.done}</td>
                        <td className="num text-rose-600">{r.failed}</td>
                        <td className="num">{r.open}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            <Card title="Qo'ng'iroq natijalari" sub="Ko'tarmagan/band ulushi — aloqa sifati ko'rsatkichi.">
              {data.byResult.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">Ma'lumot yo'q</p>
              ) : (
                <ul className="space-y-2">
                  {data.byResult.map((r) => {
                    const pct = data.attempts > 0 ? Math.round((r.count / data.attempts) * 100) : 0
                    return (
                      <li key={r.key}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600">{r.label}</span>
                          <span className="font-semibold text-slate-700">
                            {r.count} <span className="text-xs font-normal text-slate-400">({pct}%)</span>
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

function Stat({
  label, value, hint, tone,
}: {
  label: string
  value: number | string
  hint?: string
  tone?: 'emerald' | 'rose' | 'sky'
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p
        className={cn(
          'mt-1 text-2xl font-bold',
          tone === 'emerald' ? 'text-emerald-600'
          : tone === 'rose' ? 'text-rose-600'
          : tone === 'sky' ? 'text-sky-600'
          : 'text-slate-800',
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </div>
  )
}
