import { useState } from 'react'
import { Plus, Tag } from 'lucide-react'
import type { AssignmentType } from '@/types'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

interface Props {
  open: boolean
  onClose: () => void
  types: AssignmentType[]
  /** Yangi tur qo'shish — nomi bir xil bo'lsa backend mavjudini qaytaradi (dublikat yaratmaydi). */
  onCreate: (name: string) => Promise<AssignmentType>
  onCreated: (type: AssignmentType) => void
}

/** Mavjud "topshiriq turlari"ni ko'rsatib, yangisini qo'shish imkonini beruvchi modal (o'qituvchi/admin). */
export function AssignmentTypesModal({ open, onClose, types, onCreate, onCreated }: Props) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const handleAdd = async () => {
    const trimmed = name.trim()
    if (!trimmed || saving) return
    setSaving(true)
    try {
      const created = await onCreate(trimmed)
      onCreated(created)
      setName('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="sm" title="Topshiriq turlari">
      <div className="space-y-4">
        <div>
          <span className="mb-2 block text-sm font-medium text-slate-600">Mavjud turlar</span>
          {types.length === 0 ? (
            <p className="text-sm text-slate-400">Hali tur qo'shilmagan.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {types.map((t) => (
                <span
                  key={t.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700"
                >
                  <Tag className="h-3.5 w-3.5 text-slate-400" />
                  {t.name}
                </span>
              ))}
            </div>
          )}
        </div>
        <div>
          <span className="mb-2 block text-sm font-medium text-slate-600">Yangi tur qo'shish</span>
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="Masalan: Uy vazifasi"
              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-400"
            />
            <Button type="button" onClick={handleAdd} disabled={!name.trim() || saving}>
              <Plus className="h-4 w-4" /> {saving ? '...' : "Qo'shish"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
