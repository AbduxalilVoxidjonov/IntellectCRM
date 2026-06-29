import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, Check } from 'lucide-react'
import type { AiCheckOverviewRow } from '@/types'
import {
  getAiCheckOverview,
  getAiCheckSettings,
  saveAiCheckSettings,
  saveAiAccess,
} from '@/api/services/aiCheck'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Loader } from '@/components/ui/Loader'
import { PageHeader } from '@/components/ui/PageHeader'

const control =
  'rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-800 outline-none transition-colors focus:border-brand-400'

export function AiCheckPage() {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<AiCheckOverviewRow[]>([])
  const [defaultLimit, setDefaultLimit] = useState(3)
  const [savingDefault, setSavingDefault] = useState<'idle' | 'saving' | 'saved'>('idle')

  useEffect(() => {
    Promise.all([getAiCheckOverview(), getAiCheckSettings()])
      .then(([o, s]) => {
        setRows(o)
        setDefaultLimit(s.defaultDailyLimit)
      })
      .finally(() => setLoading(false))
  }, [])

  const saveDefault = async () => {
    setSavingDefault('saving')
    await saveAiCheckSettings(defaultLimit)
    setSavingDefault('saved')
    setTimeout(() => setSavingDefault('idle'), 1500)
  }

  const patchRow = (id: string, patch: Partial<AiCheckOverviewRow>) =>
    setRows((prev) => prev.map((r) => (r.studentId === id ? { ...r, ...patch } : r)))

  const persist = async (r: AiCheckOverviewRow) => {
    try {
      await saveAiAccess(r.studentId, r.effectiveLimit, r.premium, r.blocked)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Saqlab boʻlmadi')
    }
  }

  if (loading) return <Loader label="Yuklanmoqda..." />

  return (
    <div>
      <PageHeader
        title="AI tekshiruv (Speaking & Writing)"
        sub="Kim necha marta foydalanayotgani, kunlik limit, premium va cheklash boshqaruvi"
      />

      <Card
        title="Standart kunlik limit"
        sub="Premium yoki shaxsiy limiti yo'q o'quvchilar uchun (kuniga necha marta)"
        actions={
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              value={defaultLimit}
              onChange={(e) => setDefaultLimit(Math.max(0, Number(e.target.value) || 0))}
              className={control + ' w-20'}
            />
            <Button onClick={saveDefault} disabled={savingDefault === 'saving'}>
              <Check className="h-4 w-4" />
              {savingDefault === 'saving' ? 'Saqlanmoqda...' : savingDefault === 'saved' ? 'Saqlandi' : 'Saqlash'}
            </Button>
          </div>
        }
      >
        <p className="text-xs text-slate-400">
          AI tekshiruv ishlashi uchun Sozlamalar → AI Tahlil (Gemini) kaliti, Speaking uchun esa
          Sozlamalar → Speaking (Azure) kiritilgan bo'lishi kerak.
        </p>
      </Card>

      <Card title="Foydalanuvchilar" sub={`${rows.length} ta o'quvchi AI tekshiruvdan foydalangan`} className="mt-4">
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            <Sparkles className="mx-auto mb-2 h-6 w-6 text-slate-300" />
            Hali hech kim AI tekshiruvdan foydalanmagan.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th className="text-left">O'quvchi</th>
                  <th className="text-left">Guruh</th>
                  <th className="text-center">Writing</th>
                  <th className="text-center">Speaking</th>
                  <th className="text-center">Bugun</th>
                  <th className="text-center">Kunlik limit</th>
                  <th className="text-center">Premium</th>
                  <th className="text-center">Bloklash</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.studentId}>
                    <td className="font-medium text-slate-800">{r.fullName}</td>
                    <td className="text-slate-500">{r.className || '—'}</td>
                    <td className="text-center font-mono">{r.writingCount}</td>
                    <td className="text-center font-mono">{r.speakingCount}</td>
                    <td className="text-center font-mono">{r.todayUsed}</td>
                    <td className="text-center">
                      <input
                        type="number"
                        min={0}
                        value={r.effectiveLimit}
                        disabled={r.premium}
                        onChange={(e) => patchRow(r.studentId, { effectiveLimit: Math.max(0, Number(e.target.value) || 0) })}
                        onBlur={() => persist(r)}
                        className={control + ' w-16 text-center disabled:opacity-40'}
                      />
                    </td>
                    <td className="text-center">
                      <input
                        type="checkbox"
                        checked={r.premium}
                        onChange={(e) => {
                          const next = { ...r, premium: e.target.checked }
                          patchRow(r.studentId, { premium: e.target.checked })
                          persist(next)
                        }}
                        className="h-4 w-4 rounded border-slate-300 accent-brand-600"
                      />
                    </td>
                    <td className="text-center">
                      <input
                        type="checkbox"
                        checked={r.blocked}
                        onChange={(e) => {
                          const next = { ...r, blocked: e.target.checked }
                          patchRow(r.studentId, { blocked: e.target.checked })
                          persist(next)
                        }}
                        className="h-4 w-4 rounded border-slate-300 accent-red-600"
                      />
                    </td>
                    <td className="text-right">
                      <Link to={`/admin/ai-check/${r.studentId}`} className="text-sm font-medium text-brand-600 hover:text-brand-700">
                        Tarix →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
