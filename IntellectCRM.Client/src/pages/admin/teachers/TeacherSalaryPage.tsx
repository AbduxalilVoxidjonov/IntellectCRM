import { useEffect, useState } from 'react'
import { Wallet, Check } from 'lucide-react'
import type { Teacher } from '@/types'
import type { TeacherPayload } from '@/api/services/teachers'
import { getTeachers, updateTeacher } from '@/api/services/teachers'
import { formatMoney, cn } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StatCard } from '@/components/ui/StatCard'
import { PageHeader } from '@/components/ui/PageHeader'
import { Loader } from '@/components/ui/Loader'

type Status = 'idle' | 'saving' | 'saved'
type Draft = { mode: 'fixed' | 'percent'; salary: number; percent: number }

export function TeacherSalaryPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [status, setStatus] = useState<Record<string, Status>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getTeachers()
      .then((t) => {
        setTeachers(t)
        setDrafts(
          Object.fromEntries(
            t.map((x) => [
              x.id,
              {
                mode: x.salaryMode === 'percent' ? 'percent' : 'fixed',
                salary: x.salary,
                percent: x.salaryPercent ?? 0,
              } as Draft,
            ]),
          ),
        )
      })
      .finally(() => setLoading(false))
  }, [])

  const setStatusFor = (id: string, s: Status) => setStatus((p) => ({ ...p, [id]: s }))
  const patchDraft = (id: string, patch: Partial<Draft>) =>
    setDrafts((p) => ({ ...p, [id]: { ...p[id], ...patch } }))

  const save = async (teacher: Teacher) => {
    const d = drafts[teacher.id]
    if (!d) return
    setStatusFor(teacher.id, 'saving')
    try {
      // updateTeacher to'liq obyektni kutadi — faqat maosh maydonlarini yangilaymiz.
      const { id: _id, ...rest } = teacher
      void _id
      const payload: TeacherPayload = {
        ...rest,
        salaryMode: d.mode,
        salary: d.mode === 'fixed' ? d.salary : 0,
        salaryPercent: d.mode === 'percent' ? d.percent : 0,
      }
      const updated = await updateTeacher(teacher.id, payload)
      setTeachers((prev) => prev.map((t) => (t.id === teacher.id ? updated : t)))
      setStatusFor(teacher.id, 'saved')
      setTimeout(() => setStatusFor(teacher.id, 'idle'), 2000)
    } catch (e) {
      setStatusFor(teacher.id, 'idle')
      alert(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Saqlashda xatolik',
      )
    }
  }

  // Jami oylik fond — faqat qat'iy (fixed) summalar yig'indisi (foizli oylik o'zgaruvchan).
  const totalFond = teachers.reduce((s, t) => {
    const d = drafts[t.id]
    return s + (d && d.mode === 'fixed' ? d.salary : 0)
  }, 0)
  const fixedCount = teachers.filter((t) => drafts[t.id]?.mode === 'fixed').length
  const percentCount = teachers.filter((t) => drafts[t.id]?.mode === 'percent').length

  return (
    <div>
      <PageHeader
        title="Oylik hisoblash"
        sub="Har bir o'qituvchi uchun qat'iy summa yoki guruh to'lovidan foiz tanlang."
      />

      {/* Jamlama kartochkalar */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Jami qat'iy oylik fond" value={formatMoney(totalFond)} icon={Wallet} />
        <StatCard
          label="Qat'iy summali"
          value={fixedCount}
          icon={Wallet}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <StatCard
          label="Foizli"
          value={percentCount}
          icon={Wallet}
          iconBg="bg-sky-50"
          iconColor="text-sky-600"
        />
      </div>

      {loading ? (
        <Card>
          <Loader label="Yuklanmoqda..." />
        </Card>
      ) : (
        <Card
          tight
          title="O'qituvchilar oyligi"
          sub="Foizli rejimda oylik = guruh to'lovining belgilangan foizi (to'lov kelgan sayin o'sib boradi)."
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="w-8 px-4 py-3">#</th>
                  <th className="px-4 py-3">F.I.SH</th>
                  <th className="px-4 py-3">Rejim</th>
                  <th className="px-4 py-3">Qiymat</th>
                  <th className="px-4 py-3 text-right">Amal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {teachers.map((t, i) => {
                  const st = status[t.id] ?? 'idle'
                  const d = drafts[t.id] ?? { mode: 'fixed', salary: 0, percent: 0 }
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{t.fullName}</td>
                      <td className="px-4 py-3">
                        <div className="tabs" role="tablist">
                          <button
                            type="button"
                            onClick={() => patchDraft(t.id, { mode: 'fixed' })}
                            className={cn('tab', d.mode === 'fixed' && 'active')}
                          >
                            Qat'iy summa
                          </button>
                          <button
                            type="button"
                            onClick={() => patchDraft(t.id, { mode: 'percent' })}
                            className={cn('tab', d.mode === 'percent' && 'active')}
                          >
                            Foiz
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {d.mode === 'fixed' ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={0}
                              step={1000}
                              value={d.salary}
                              onChange={(e) =>
                                patchDraft(t.id, { salary: Number(e.target.value) })
                              }
                              className="w-40 rounded-lg border border-slate-200 px-3 py-2 text-right font-mono text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                            />
                            <span className="text-xs text-slate-400">so'm</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={1}
                              value={d.percent}
                              onChange={(e) =>
                                patchDraft(t.id, { percent: Number(e.target.value) })
                              }
                              className="w-24 rounded-lg border border-slate-200 px-3 py-2 text-right font-mono text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                            />
                            <span className="text-xs text-slate-400">% (guruh to'lovidan)</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {st === 'saved' ? (
                          <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600">
                            <Check className="h-4 w-4" /> Saqlandi
                          </span>
                        ) : (
                          <Button
                            onClick={() => save(t)}
                            disabled={st === 'saving'}
                            className="px-3 py-1.5"
                          >
                            {st === 'saving' ? 'Saqlanmoqda...' : 'Saqlash'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {teachers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                      O'qituvchi yo'q
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
            Foizli rejimda oylik = o'qituvchi guruh(lar)idan shu oyda haqiqatan yig'ilgan to'lovning
            belgilangan foizi (to'lov kelgan sayin o'sib boradi). Batafsil — moliya bo'limidagi maosh
            hisobida ko'rinadi.
          </p>
        </Card>
      )}
    </div>
  )
}
