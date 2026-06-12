import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Check, UserX, Snowflake, RotateCcw, UserMinus, Users, Layers } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { AbsenceReason, ActionReason } from '@/types'
import { getSettings, saveAbsenceReasons } from '@/api/services/settings'
import {
  getActionReasons,
  createActionReason,
  updateActionReason,
  deleteActionReason,
} from '@/api/services/actionReasons'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Loader } from '@/components/ui/Loader'
import { PageHeader } from '@/components/ui/PageHeader'
import { cn } from '@/lib/utils'

/** Amal kategoriyalari — har biri o'z sabablar ro'yxatiga ega. */
const CATEGORIES: { key: string; title: string; sub: string; icon: LucideIcon }[] = [
  { key: 'freeze', title: 'Talaba muzlatilganda', sub: "Guruh a'zoligini muzlatishda tanlanadi", icon: Snowflake },
  { key: 'return_trial', title: 'Sinovga qaytarilganda', sub: 'Talaba sinov holatiga qaytarilganda', icon: RotateCcw },
  { key: 'remove_active', title: "Aktiv talaba o'chirilganda", sub: 'Aktiv a’zo guruhdan chiqarilganda', icon: UserMinus },
  { key: 'remove_trial', title: "Sinovdagi talaba o'chirilganda", sub: 'Sinovdagi a’zo chiqarilganda', icon: UserX },
  { key: 'remove_frozen', title: "Muzlatilgan talaba o'chirilganda", sub: 'Muzlatilgan a’zo chiqarilganda', icon: UserX },
  { key: 'lead_delete', title: "Lid o'chirilganda", sub: 'Lid (mijoz) o’chirilganda', icon: Users },
  { key: 'group_delete', title: "Guruh o'chirilganda", sub: 'Guruh o’chirilganda', icon: Layers },
]

const control =
  'rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition-colors focus:border-brand-400'

export function ReasonsPage() {
  const [loading, setLoading] = useState(true)
  const [absence, setAbsence] = useState<AbsenceReason[]>([])
  const [absStatus, setAbsStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [reasons, setReasons] = useState<ActionReason[]>([])

  useEffect(() => {
    Promise.all([getSettings(), getActionReasons()])
      .then(([s, r]) => {
        setAbsence(s.absenceReasons)
        setReasons(r)
      })
      .finally(() => setLoading(false))
  }, [])

  // ---- Davomat (kelmaganlik) sabablari ----
  const addAbsence = () =>
    setAbsence((a) => [...a, { id: crypto.randomUUID(), name: '', short: '', isLate: false, points: 0 } as AbsenceReason])
  const patchAbsence = (i: number, patch: Partial<AbsenceReason>) =>
    setAbsence((a) => a.map((r, x) => (x === i ? { ...r, ...patch } : r)))
  const removeAbsence = (i: number) => setAbsence((a) => a.filter((_, x) => x !== i))
  const saveAbsence = async () => {
    setAbsStatus('saving')
    await saveAbsenceReasons(absence.filter((r) => r.name.trim()))
    setAbsStatus('saved')
    setTimeout(() => setAbsStatus('idle'), 1500)
  }

  if (loading) return <Loader label="Yuklanmoqda..." />

  return (
    <div>
      <PageHeader
        title="Sabablar"
        sub="Barcha amallar uchun sabablar shu yerda boshqariladi — muzlatish, o'chirish, sinovga qaytarish, lid/guruh va davomat"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Davomat sabablari */}
        <Card
          title="O'quvchi kelmaganda (davomat)"
          sub="Jurnalda bor/yo'q belgilanganda ishlatiladi"
          actions={
            <Button onClick={saveAbsence} disabled={absStatus === 'saving'}>
              <Check className="h-4 w-4" /> {absStatus === 'saving' ? 'Saqlanmoqda...' : absStatus === 'saved' ? 'Saqlandi' : 'Saqlash'}
            </Button>
          }
        >
          <div className="space-y-2">
            {absence.map((r, i) => (
              <div key={r.id} className="flex flex-wrap items-center gap-2">
                <input
                  value={r.name}
                  onChange={(e) => patchAbsence(i, { name: e.target.value })}
                  placeholder="Sabab nomi (masalan: Kasal)"
                  className={cn(control, 'min-w-[160px] flex-1')}
                />
                <input
                  value={r.short}
                  onChange={(e) => patchAbsence(i, { short: e.target.value })}
                  placeholder="Belgi"
                  maxLength={3}
                  className={cn(control, 'w-16 text-center')}
                />
                <label className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap text-xs text-slate-600" title="Kech keldi — yo'qlik emas">
                  <input
                    type="checkbox"
                    checked={r.isLate}
                    onChange={() => patchAbsence(i, { isLate: !r.isLate })}
                    className="h-4 w-4 rounded border-slate-300 accent-brand-600"
                  />
                  Kech
                </label>
                <button
                  type="button"
                  onClick={() => removeAbsence(i)}
                  className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addAbsence}
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              <Plus className="h-4 w-4" /> Sabab qo'shish
            </button>
          </div>
        </Card>

        {/* Amal sabablari — kategoriyalar */}
        {CATEGORIES.map((cat) => (
          <CategoryCard
            key={cat.key}
            cat={cat}
            items={reasons.filter((r) => r.category === cat.key)}
            onChange={setReasons}
          />
        ))}
      </div>
    </div>
  )
}

function CategoryCard({
  cat,
  items,
  onChange,
}: {
  cat: { key: string; title: string; sub: string; icon: LucideIcon }
  items: ActionReason[]
  onChange: React.Dispatch<React.SetStateAction<ActionReason[]>>
}) {
  const [adding, setAdding] = useState('')
  const [busy, setBusy] = useState(false)
  const sorted = useMemo(() => [...items].sort((a, b) => a.order - b.order), [items])

  const add = async () => {
    const label = adding.trim()
    if (!label || busy) return
    setBusy(true)
    try {
      const created = await createActionReason(cat.key, label)
      onChange((prev) => [...prev, created])
      setAdding('')
    } finally {
      setBusy(false)
    }
  }
  const save = async (id: string, label: string) => {
    const trimmed = label.trim()
    if (!trimmed) return
    await updateActionReason(id, trimmed)
    onChange((prev) => prev.map((r) => (r.id === id ? { ...r, label: trimmed } : r)))
  }
  const remove = async (id: string) => {
    await deleteActionReason(id)
    onChange((prev) => prev.filter((r) => r.id !== id))
  }

  const Icon = cat.icon
  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-brand-500" />
          {cat.title}
        </span>
      }
      sub={cat.sub}
    >
      <div className="space-y-2">
        {sorted.map((r) => (
          <div key={r.id} className="flex items-center gap-2">
            <input
              defaultValue={r.label}
              onBlur={(e) => e.target.value.trim() !== r.label && save(r.id, e.target.value)}
              className={cn(control, 'flex-1')}
            />
            <button
              type="button"
              onClick={() => remove(r.id)}
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {sorted.length === 0 && <p className="text-xs text-slate-400">Sabab yo'q — quyida qo'shing.</p>}

        <div className="flex items-center gap-2 pt-1">
          <input
            value={adding}
            onChange={(e) => setAdding(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Yangi sabab..."
            className={cn(control, 'flex-1')}
          />
          <Button variant="secondary" onClick={add} disabled={busy || !adding.trim()}>
            <Plus className="h-4 w-4" /> Qo'shish
          </Button>
        </div>
      </div>
    </Card>
  )
}
