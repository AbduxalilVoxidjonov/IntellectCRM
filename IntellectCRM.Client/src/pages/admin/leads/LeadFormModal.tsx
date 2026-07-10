import { useEffect, useState } from 'react'
import type { Lead } from '@/types'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { genderOptions, leadSourceOptions } from '@/config/constants'
import { getLeadSources } from '@/api/services/leadSources'

export type LeadFormValues = Omit<Lead, 'id' | 'stage'>

interface Props {
  open: boolean
  onClose: () => void
  onSubmit: (values: LeadFormValues) => void
  /** Tahrirlash uchun mavjud lid, qo'shish uchun null */
  initial?: Lead | null
}

const empty: LeadFormValues = {
  fullName: '',
  gender: 'male',
  birthDate: '',
  phone: '',
  fatherFullName: '',
  fatherPhone: '',
  motherFullName: '',
  motherPhone: '',
  note: '',
  source: '',
  interestSubject: '',
}

export function LeadFormModal({ open, onClose, onSubmit, initial }: Props) {
  const [form, setForm] = useState<LeadFormValues>(empty)
  // Manba ro'yxati serverdan ("O'quv bo'limi → Sabablar" → "Lid manbalari"); xato/bo'sh bo'lsa fallback.
  const [sourceOptions, setSourceOptions] = useState<string[]>(leadSourceOptions)

  useEffect(() => {
    if (!open) return
    getLeadSources()
      .then((list) => {
        const names = list.map((s) => s.name)
        setSourceOptions(names.length > 0 ? names : leadSourceOptions)
      })
      .catch(() => setSourceOptions(leadSourceOptions))
  }, [open])

  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- modal ochilganda formani initial bilan sinxronlash (maqsadli)
    setForm(
      initial
        ? {
            fullName: initial.fullName,
            gender: initial.gender,
            birthDate: initial.birthDate,
            phone: initial.phone,
            fatherFullName: initial.fatherFullName,
            fatherPhone: initial.fatherPhone,
            motherFullName: initial.motherFullName,
            motherPhone: initial.motherPhone,
            note: initial.note ?? '',
            source: initial.source ?? '',
            interestSubject: initial.interestSubject ?? '',
          }
        : empty,
    )
  }, [open, initial])

  const update = <K extends keyof LeadFormValues>(key: K, value: LeadFormValues[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.fullName.trim()) return
    onSubmit(form)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Lidni tahrirlash' : 'Yangi lid'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" form="lead-form">
            Saqlash
          </Button>
        </>
      }
    >
      <form id="lead-form" onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="F.I.SH"
          required
          value={form.fullName}
          onChange={(e) => update('fullName', e.target.value)}
        />
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Jinsi"
            value={form.gender}
            onChange={(e) => update('gender', e.target.value as LeadFormValues['gender'])}
          >
            {genderOptions.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </Select>
          <Input
            label="Tug'ilgan kun"
            type="date"
            value={form.birthDate}
            onChange={(e) => update('birthDate', e.target.value)}
          />
        </div>
        <PhoneInput
          label="O'z telefon raqami"
          value={form.phone}
          onChange={(phone) => update('phone', phone)}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Otasi F.I.SH"
            value={form.fatherFullName}
            onChange={(e) => update('fatherFullName', e.target.value)}
          />
          <PhoneInput
            label="Otasi raqami"
            value={form.fatherPhone}
            onChange={(phone) => update('fatherPhone', phone)}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Onasi F.I.SH"
            value={form.motherFullName}
            onChange={(e) => update('motherFullName', e.target.value)}
          />
          <PhoneInput
            label="Onasi raqami"
            value={form.motherPhone}
            onChange={(phone) => update('motherPhone', phone)}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Manba"
            value={form.source ?? ''}
            onChange={(e) => update('source', e.target.value)}
          >
            <option value="">— tanlanmagan —</option>
            {form.source && !sourceOptions.includes(form.source) && (
              <option key={form.source} value={form.source}>
                {form.source}
              </option>
            )}
            {sourceOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Input
            label="Qiziqqan fani"
            placeholder="Masalan: Matematika"
            value={form.interestSubject ?? ''}
            onChange={(e) => update('interestSubject', e.target.value)}
          />
        </div>
        <Textarea
          label="Izoh"
          rows={3}
          value={form.note}
          onChange={(e) => update('note', e.target.value)}
        />
      </form>
    </Modal>
  )
}
