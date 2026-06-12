import { useEffect, useState } from 'react'
import type { LmsModule } from '@/types'
import type { SaveModulePayload } from '@/api/services/lms'
import { createLmsModule, updateLmsModule } from '@/api/services/lms'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'

interface Props {
  open: boolean
  /** null — yangi modul yaratish */
  module: LmsModule | null
  /** Yangi modul qaysi fanga tegishli */
  subjectId: string
  onClose: () => void
  onSaved: () => void
}

export function LmsModuleModal({ open, module, subjectId, onClose, onSaved }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setTitle(module?.title ?? '')
      setDescription(module?.description ?? '')
    }
  }, [open, module])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    const payload: SaveModulePayload = {
      title: title.trim(),
      description: description.trim(),
    }
    setSaving(true)
    try {
      if (module) {
        await updateLmsModule(module.id, payload)
      } else {
        await createLmsModule(subjectId, payload)
      }
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={module ? 'Modulni tahrirlash' : "Yangi modul qo'shish"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" form="lms-module-form" disabled={saving || !title.trim()}>
            {saving ? 'Saqlanmoqda...' : 'Saqlash'}
          </Button>
        </>
      }
    >
      <form id="lms-module-form" onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Modul nomi"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Masalan: 1-chorak, Algebra asoslari..."
        />

        <Textarea
          label="Ta'rif"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Qisqacha ta'rif..."
        />
      </form>
    </Modal>
  )
}
