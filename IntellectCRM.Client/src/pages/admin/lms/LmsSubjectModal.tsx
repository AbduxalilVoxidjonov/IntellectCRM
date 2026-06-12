import { useEffect, useState } from 'react'
import type { LmsSubject, LmsUnlockMode } from '@/types'
import type { SaveSubjectPayload } from '@/api/services/lms'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  editing?: LmsSubject
  saving: boolean
  onClose: () => void
  /** classId LmsSubjectsPage dan beriladi — modal o'zi bilmaydi */
  onSave: (payload: SaveSubjectPayload) => void
}

const MODES: { value: LmsUnlockMode; label: string; desc: string }[] = [
  { value: 'all', label: 'Hammasi ochiq', desc: "Barcha mavzular bir vaqtda ko'rinadi" },
  { value: 'sequential', label: 'Ketma-ket', desc: 'Oldingi mavzu tugallananda keyingisi ochiladi' },
  { value: 'batch', label: 'Guruhli', desc: "Bir vaqtda N ta mavzu ochiq bo'ladi" },
]

export function LmsSubjectModal({ open, editing, saving, onClose, onSave }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [unlockMode, setUnlockMode] = useState<LmsUnlockMode>('all')
  const [batchSize, setBatchSize] = useState(3)

  useEffect(() => {
    if (open) {
      setTitle(editing?.title ?? '')
      setDescription(editing?.description ?? '')
      setUnlockMode(editing?.unlockMode ?? 'all')
      setBatchSize(editing?.batchSize ?? 3)
    }
  }, [open, editing])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    onSave({
      classId: editing?.classId ?? '',
      title: title.trim(),
      description: description.trim(),
      unlockMode,
      batchSize,
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={editing ? 'Fanni tahrirlash' : "Yangi fan qo'shish"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" form="lms-subject-form" disabled={saving || !title.trim()}>
            {saving ? 'Saqlanmoqda...' : 'Saqlash'}
          </Button>
        </>
      }
    >
      <form id="lms-subject-form" onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Fan nomi"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Masalan: Matematika, Fizika..."
        />

        <Textarea
          label="Ta'rif"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Qisqacha ta'rif..."
        />

        {/* Ochilish tartibi */}
        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-600">
            Mavzular ochilish tartibi
          </span>
          <div className="space-y-2">
            {MODES.map((m) => (
              <label
                key={m.value}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                  unlockMode === m.value
                    ? 'border-brand-300 bg-brand-50'
                    : 'border-slate-200 hover:border-slate-300',
                )}
              >
                <input
                  type="radio"
                  name="unlockMode"
                  value={m.value}
                  checked={unlockMode === m.value}
                  onChange={() => setUnlockMode(m.value)}
                  className="mt-0.5 accent-brand-600"
                />
                <div>
                  <p className="text-sm font-medium text-slate-800">{m.label}</p>
                  <p className="text-xs text-slate-500">{m.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Guruh hajmi */}
        {unlockMode === 'batch' && (
          <div className="flex items-center gap-3 rounded-lg bg-brand-50 px-3 py-2">
            <label className="text-sm font-medium text-slate-700">
              Bir vaqtda ochiq mavzular soni:
            </label>
            <input
              type="number"
              min={1}
              max={50}
              value={batchSize}
              onChange={(e) => setBatchSize(Math.max(1, Number(e.target.value)))}
              className="w-20 rounded-lg border border-brand-200 bg-white px-3 py-1.5 font-mono text-sm outline-none focus:border-brand-400"
            />
          </div>
        )}
      </form>
    </Modal>
  )
}
