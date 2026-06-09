import { useEffect, useState } from 'react'
import type { Group } from '@/types'
import type { ClassPayload } from '@/api/services/classes'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { languageOptions, gradeOptions } from '@/config/constants'

interface Props {
  open: boolean
  onClose: () => void
  onSubmit: (values: ClassPayload) => void
  initial?: Group | null
}

const empty: ClassPayload = {
  name: '',
  grade: 1,
  language: 'uz',
  monthlyFee: 0,
  room: '',
  status: 'active',
  startDate: '',
  endDate: '',
  capacity: 0,
}

export function ClassFormModal({ open, onClose, onSubmit, initial }: Props) {
  const [form, setForm] = useState<ClassPayload>(empty)

  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- modal ochilganda formani initial bilan sinxronlash (maqsadli)
    setForm(
      initial
        ? {
            name: initial.name,
            grade: initial.grade,
            language: initial.language,
            monthlyFee: initial.monthlyFee,
            room: initial.room ?? '',
            status: initial.status ?? 'active',
            startDate: initial.startDate ?? '',
            endDate: initial.endDate ?? '',
            capacity: initial.capacity ?? 0,
          }
        : empty,
    )
  }, [open, initial])

  const update = <K extends keyof ClassPayload>(key: K, value: ClassPayload[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    onSubmit(form)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Guruhni tahrirlash' : 'Yangi guruh'}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" form="class-form">
            Saqlash
          </Button>
        </>
      }
    >
      <form id="class-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Guruh nomi"
            required
            placeholder="3-A"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
          />
          <Select
            label="Guruh (daraja)"
            value={form.grade}
            onChange={(e) => update('grade', Number(e.target.value))}
          >
            {gradeOptions.map((g) => (
              <option key={g} value={g}>
                {g}-guruh
              </option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Xona"
            placeholder="301"
            value={form.room}
            onChange={(e) => update('room', e.target.value)}
          />
          <Select
            label="Til"
            value={form.language}
            onChange={(e) => update('language', e.target.value as ClassPayload['language'])}
          >
            {languageOptions.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </Select>
        </div>
        <Input
          label="Oylik to'lov (so'm)"
          type="number"
          min={0}
          step={50000}
          value={form.monthlyFee}
          onChange={(e) => update('monthlyFee', Number(e.target.value))}
        />
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Holat"
            value={form.status ?? 'active'}
            onChange={(e) => update('status', e.target.value as Group['status'])}
          >
            <option value="active">Faol</option>
            <option value="full">To'lgan</option>
            <option value="archived">Arxiv</option>
          </Select>
          <Input
            label="Sig'im (0 = cheksiz)"
            type="number"
            min={0}
            value={form.capacity ?? 0}
            onChange={(e) => update('capacity', Number(e.target.value))}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Boshlanish sanasi"
            type="date"
            value={form.startDate ?? ''}
            onChange={(e) => update('startDate', e.target.value)}
          />
          <Input
            label="Tugash sanasi"
            type="date"
            value={form.endDate ?? ''}
            onChange={(e) => update('endDate', e.target.value)}
          />
        </div>
      </form>
    </Modal>
  )
}
