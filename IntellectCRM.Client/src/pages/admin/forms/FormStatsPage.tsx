import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Eye, ClipboardList, UserPlus, GraduationCap, Wallet } from 'lucide-react'
import {
  getLeadFormStats, getLeadFormSubmissions,
  type LeadFormStats, type LeadFormSubmission,
} from '@/api/services/leadForms'
import { Card } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import { Loader } from '@/components/ui/Loader'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { CardTabs } from '@/components/ui/CardTabs'
import { formTabs } from '@/config/sectionTabs'
import { LeadStageChip } from '@/components/leads/LeadStageChip'
import { usePerm } from '@/lib/permissions'
import { cn, formatMoney } from '@/lib/utils'
import { SubmissionsTable } from './FormEditorPage'

/**
 * FORMALAR STATISTIKASI — modulning asosiy savoli: «qaysi ijtimoiy tarmoq haqiqiy o'quvchi
 * keltiryapti?». Voronka: ochildi → ariza → lid → o'quvchi (hozir faol).
 *
 * <p>Butun hisob serverda (`LeadFormService.BuildStatsAsync`) — bu sahifa faqat chizadi.</p>
 */

// Ranglar loyihadagi tekshirilgan palitradan (`.claude/rules/course-analytics.md` §6).
const C_SUBMIT = '#0284c7' // sky-600 — ariza oqimi (yakka seriya, legend kerak emas)
const axisTick = { fontSize: 12, fill: '#94a3b8' }
const tooltipStyle = { borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }

/** "2026-08-06" → "06.08" (grafik o'qi uchun ixcham). */
function shortDay(iso: string) {
  return iso.length >= 10 ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}` : iso
}

export function FormStatsPage() {
  const navigate = useNavigate()
  const { can } = usePerm()
  const canTests = can('schedule', 'view')
  const [stats, setStats] = useState<LeadFormStats | null>(null)
  const [subs, setSubs] = useState<LeadFormSubmission[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getLeadFormStats(), getLeadFormSubmissions()])
      .then(([s, list]) => {
        setStats(s)
        setSubs(list)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading || !stats) return <Loader label="Yuklanmoqda..." />

  const daily = stats.daily.map((d) => ({ name: shortDay(d.date), arizalar: d.submissions }))
  const hasFlow = stats.daily.some((d) => d.submissions > 0)
  // Bosqichlar chizig'i: eng katta ustunga nisbatan uzunlik, foiz esa BOSQICHDAGI jami lidlardan
  // (bosqichsiz lidlar ro'yxatga umuman kirmaydi — kanbanda ham ko'rinmaydi).
  const maxStage = Math.max(0, ...stats.byStage.map((s) => s.leads))
  const stageLeads = stats.byStage.reduce((a, s) => a + s.leads, 0)

  return (
    <div>
      <CardTabs items={formTabs(true, canTests)} className="mb-5" />

      <PageHeader
        title="Formalar statistikasi"
        sub="Ochildi → ariza → lid → o'quvchi → TO'LADI. Foizlar TAKRORSIZ lidlar bo'yicha hisoblanadi"
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Ochilgan"
          value={stats.views}
          icon={Eye}
          hint={`${stats.forms} ta forma (${stats.activeForms} faol)`}
        />
        <StatCard
          label="Ariza"
          value={stats.submissions}
          icon={ClipboardList}
          iconBg="bg-sky-50"
          iconColor="text-sky-600"
          hint={stats.views > 0 ? `Ochganlarning ${Math.round((stats.submissions / stats.views) * 100)}%` : '—'}
        />
        <StatCard
          label="Yangi lid"
          value={stats.newLeads}
          icon={UserPlus}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
          hint={`${stats.submissions - stats.newLeads} ta takroriy ariza`}
        />
        <StatCard
          label="Aktiv o'quvchi"
          value={stats.activeStudents}
          icon={GraduationCap}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          hint={`${stats.converted} ta o'quvchiga aylangan`}
        />
        {/* SOTUV: pul to'lagan lidlar — "o'quvchi bo'ldi" hali pul degani emas */}
        <StatCard
          label="To'lov qildi"
          value={stats.paid}
          icon={Wallet}
          iconBg="bg-teal-50"
          iconColor="text-teal-600"
          hint={stats.revenue > 0 ? `${formatMoney(stats.revenue)} so'm tushum` : "Hali to'lov yo'q"}
        />
      </div>

      <div className="space-y-4">
        <Card title="Ariza oqimi" sub="Oxirgi 30 kun — kunlik tushgan arizalar">
          {hasFlow ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={daily} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f4" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={axisTick} interval="preserveStartEnd" />
                <YAxis tickLine={false} axisLine={false} tick={axisTick} allowDecimals={false} width={36} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="arizalar" name="Ariza" fill={C_SUBMIT} radius={[4, 4, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-10 text-center text-sm text-slate-400">Oxirgi 30 kunda ariza tushmagan.</p>
          )}
        </Card>

        <Card
          title="Formalar kesimi"
          sub="Har bir forma bo'yicha voronka — havolani qayerga qo'yganingiz shu yerda ko'rinadi"
        >
          {stats.byForm.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">Hali forma yaratilmagan.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Forma</th>
                    <th className="px-3 py-2">Manba</th>
                    <th className="px-3 py-2 text-center">Ochildi</th>
                    <th className="px-3 py-2 text-center">Ariza</th>
                    <th className="px-3 py-2 text-center">Ariza %</th>
                    <th className="px-3 py-2 text-center">O'quvchi</th>
                    <th className="px-3 py-2 text-center">Aktiv</th>
                    <th className="px-3 py-2 text-center">To'ladi</th>
                    <th className="px-3 py-2 text-right">Tushum</th>
                    <th className="px-3 py-2 text-center">O'quvchi %</th>
                    <th className="px-3 py-2 text-center">Sotuv %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {stats.byForm.map((r) => (
                    <tr
                      key={r.formId}
                      onClick={() => navigate(`/admin/forms/${r.formId}`)}
                      className="cursor-pointer hover:bg-slate-50/60"
                    >
                      <td className="px-3 py-2 font-medium text-slate-700">
                        {r.title}
                        {!r.isActive && <span className="ml-2 text-[11px] font-normal text-slate-400">(o'chiq)</span>}
                      </td>
                      <td className="px-3 py-2">
                        {r.source ? <Badge tone="blue">{r.source}</Badge> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-center font-mono text-slate-500">{r.views}</td>
                      <td className="px-3 py-2 text-center font-mono text-slate-700">{r.submissions}</td>
                      <td className="px-3 py-2 text-center font-mono text-slate-500">{r.submitRate}%</td>
                      <td className="px-3 py-2 text-center font-mono text-slate-700">{r.converted}</td>
                      <td className="px-3 py-2 text-center font-mono text-emerald-600">{r.activeStudents}</td>
                      <td className="px-3 py-2 text-center font-mono text-teal-700">{r.paid}</td>
                      <td className="px-3 py-2 text-right font-mono text-teal-700">
                        {r.revenue > 0 ? formatMoney(r.revenue) : <span className="text-slate-300">—</span>}
                      </td>
                      <td
                        className={cn(
                          'px-3 py-2 text-center font-mono',
                          r.convertRate >= 30 ? 'text-emerald-600' : r.convertRate > 0 ? 'text-slate-600' : 'text-slate-300',
                        )}
                      >
                        {r.convertRate}%
                      </td>
                      {/* SOTUV konversiyasi — kanalning haqiqiy natijasi (pul keldimi) */}
                      <td
                        className={cn(
                          'px-3 py-2 text-center font-mono font-semibold',
                          r.payRate >= 20 ? 'text-teal-700' : r.payRate > 0 ? 'text-slate-600' : 'text-slate-300',
                        )}
                      >
                        {r.payRate}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* BOSQICHLAR — "voronka qayerda tiqilib qolgan": lidlar hozir qaysi ustunda turibdi */}
        <Card
          title="Lidlar qaysi bosqichda"
          sub="Formalardan kelgan lidlarning HOZIRGI kanban ustuni — sotuv qayerda to'xtab qolganini ko'rsatadi"
        >
          {stats.byStage.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              Bosqichga tushgan lid yo'q.
            </p>
          ) : (
            <div className="space-y-2">
              {stats.byStage.map((st) => {
                const share = maxStage > 0 ? Math.round((st.leads / maxStage) * 100) : 0
                return (
                  <div key={st.stage} className="flex items-center gap-3">
                    <div className="w-40 shrink-0 sm:w-52">
                      <LeadStageChip title={st.stage} color={st.color} />
                    </div>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-brand-400 transition-all"
                        style={{ width: `${share}%` }}
                      />
                    </div>
                    <span className="w-16 shrink-0 text-right font-mono text-sm text-slate-700">
                      {st.leads}
                      {stageLeads > 0 && (
                        <span className="ml-1 text-[11px] text-slate-400">
                          {Math.round((st.leads / stageLeads) * 100)}%
                        </span>
                      )}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Manbalar kesimi" sub="Bir manbaga bir nechta forma bog'langan bo'lishi mumkin">
            {stats.bySource.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">Ma'lumot yo'q.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Manba</th>
                    <th className="px-3 py-2 text-center">Forma</th>
                    <th className="px-3 py-2 text-center">Ariza</th>
                    <th className="px-3 py-2 text-center">Aktiv</th>
                    <th className="px-3 py-2 text-center">To'ladi</th>
                    <th className="px-3 py-2 text-right">Tushum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {stats.bySource.map((s) => (
                    <tr key={s.source || '—'} className="hover:bg-slate-50/60">
                      <td className="px-3 py-2">
                        {s.source ? (
                          <Badge tone="blue">{s.source}</Badge>
                        ) : (
                          <span className="text-slate-400">Manba tanlanmagan</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center font-mono text-slate-500">{s.forms}</td>
                      <td className="px-3 py-2 text-center font-mono text-slate-700">{s.submissions}</td>
                      <td className="px-3 py-2 text-center font-mono text-emerald-600">{s.activeStudents}</td>
                      <td className="px-3 py-2 text-center font-mono text-teal-700">{s.paid}</td>
                      <td className="px-3 py-2 text-right font-mono text-teal-700">
                        {s.revenue > 0 ? formatMoney(s.revenue) : <span className="text-slate-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card
            title="Havola belgisi (ref)"
            sub="Bitta forma havolasini bir necha joyga qo'ysangiz — oxiriga ?ref=story deb yozing"
          >
            {stats.byRef.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">Ma'lumot yo'q.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Belgi</th>
                    <th className="px-3 py-2 text-center">Ariza</th>
                    <th className="px-3 py-2 text-center">O'quvchi</th>
                    <th className="px-3 py-2 text-center">To'ladi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {stats.byRef.map((r) => (
                    <tr key={r.ref || '—'} className="hover:bg-slate-50/60">
                      <td className="px-3 py-2">
                        {r.ref ? (
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600">
                            {r.ref}
                          </span>
                        ) : (
                          <span className="text-slate-400">Belgisiz</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center font-mono text-slate-700">{r.submissions}</td>
                      <td className="px-3 py-2 text-center font-mono text-slate-600">{r.converted}</td>
                      <td className="px-3 py-2 text-center font-mono text-teal-700">{r.paid}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        {/* Oxirgi arizalar — barcha formalar bo'yicha */}
        <SubmissionsTable
          subs={subs}
          onOpenLead={(leadId) => navigate(`/admin/leads?lead=${leadId}`)}
          showForm
        />
      </div>
    </div>
  )
}
