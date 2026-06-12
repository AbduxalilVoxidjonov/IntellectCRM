import { useEffect, useState } from 'react'
import type { ActionReason } from '@/types'
import { getActionReasons } from '@/api/services/actionReasons'
import { Modal } from './Modal'
import { Button } from './Button'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  /** Sabablar kategoriyasi (ReasonsPage'dagi kalit). */
  category: string
  title: string
  message?: string
  confirmLabel: string
  tone?: 'red' | 'sky' | 'brand'
  /** Sana maydoni ko'rsatilsinmi (masalan muzlatish uchun). */
  showDate?: boolean
  defaultDate?: string
  onConfirm: (reasonId: string | undefined, date?: string) => void
  onClose: () => void
}

/**
 * Amal (muzlatish/o'chirish/sinovga qaytarish/lid/guruh) bajarishdan oldin SABAB tanlash modali.
 * Sabablar Sozlamalar → Sabablar bo'limidan (kategoriya bo'yicha) keladi. Sabab ixtiyoriy.
 */
export function ReasonPromptModal({
  open, category, title, message, confirmLabel, tone = 'red', showDate, defaultDate, onConfirm, onClose,
}: Props) {
  const [reasons, setReasons] = useState<ActionReason[]>([])
  const [selected, setSelected] = useState<string | undefined>(undefined)
  const [date, setDate] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setSelected(undefined)
    setSubmitting(false)
    setDate(defaultDate ?? new Date().toISOString().slice(0, 10))
    getActionReasons()
      .then((all) => setReasons(all.filter((r) => r.category === category)))
      .catch(() => setReasons([]))
  }, [open, category, defaultDate])

  const toneCls =
    tone === 'sky' ? 'bg-sky-600 hover:bg-sky-700'
    : tone === 'brand' ? 'bg-brand-600 hover:bg-brand-700'
    : 'bg-red-600 hover:bg-red-700'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Bekor
          </Button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => {
              if (submitting) return
              setSubmitting(true)
              onConfirm(selected, showDate ? date : undefined)
            }}
            className={cn('rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50', toneCls)}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {message && <p className="text-sm text-slate-600">{message}</p>}

        {showDate && (
          <div>
            <span className="mb-1 block text-sm font-medium text-slate-600">Sana</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-400"
            />
          </div>
        )}

        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-600">
            Sabab {reasons.length === 0 && <span className="text-xs font-normal text-slate-400">(Sabablar bo'limida sozlanadi)</span>}
          </span>
          {reasons.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {reasons.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelected((s) => (s === r.id ? undefined : r.id))}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-sm transition-colors',
                    selected === r.id
                      ? 'border-brand-500 bg-brand-50 font-medium text-brand-700'
                      : 'border-slate-200 text-slate-600 hover:border-brand-300 hover:bg-slate-50',
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">Sabab tanlanmaydi — to'g'ridan-to'g'ri davom etadi.</p>
          )}
        </div>
      </div>
    </Modal>
  )
}
