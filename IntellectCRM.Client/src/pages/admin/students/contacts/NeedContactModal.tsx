import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PhoneCall } from 'lucide-react'
import type { ActionReason } from '@/types'
import { getActionReasons } from '@/api/services/actionReasons'
import { createContactRequest } from '@/api/services/contacts'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { apiErrorMessage, cn } from '@/lib/utils'

/**
 * "BOG'LANISH KERAK" — o'quvchi profilidagi "⋮" menyusidan ochiladi.
 *
 * <p>Sabab so'raladi va o'quvchi NAVBATGA tushadi (Bog'lanish kerak bo'limi). Sabablar
 * Sozlamalar → Sabablar dan, "contact" kategoriyasi (backend: `ContactService.ReasonCategory`).</p>
 *
 * <p>Bir o'quvchida bir vaqtda faqat BITTA ochiq talab bo'ladi — server buni tekshiradi va
 * mavjud talab id'sini qaytaradi, biz esa navbatga havola ko'rsatamiz (dublikat yaratilmasin).</p>
 */
export function NeedContactModal({
  open,
  studentId,
  studentName,
  onClose,
  onCreated,
}: {
  open: boolean
  studentId: string
  studentName: string
  onClose: () => void
  onCreated?: () => void
}) {
  const [reasons, setReasons] = useState<ActionReason[]>([])
  const [reasonId, setReasonId] = useState('')
  const [note, setNote] = useState('')
  /** Bo'sh — darhol "Bog'lanish kerak"; sana berilsa "Qayta qo'ng'iroq" bo'lib tushadi. */
  const [dueDate, setDueDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [existing, setExisting] = useState(false)

  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- modal ochilganda holatni tiklash (maqsadli)
    setReasonId('')
    setNote('')
    setDueDate('')
    setError('')
    setExisting(false)
    setBusy(false)
    getActionReasons()
      .then((all) => setReasons(all.filter((r) => r.category === 'contact')))
      .catch(() => setReasons([]))
  }, [open])

  const submit = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    setExisting(false)
    try {
      await createContactRequest({
        studentId,
        reasonId: reasonId || undefined,
        note: note.trim() || undefined,
        dueDate: dueDate || undefined,
      })
      onCreated?.()
      onClose()
    } catch (e) {
      // Server ochiq talab borligini aytsa — "yana bitta ochish" o'rniga navbatga yo'naltiramiz.
      const msg = apiErrorMessage(e, "Talabni ochib bo'lmadi")
      setExisting(msg.includes('ochiq talab'))
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      size="sm"
      title="Bog'lanish kerak"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Bekor qilish
          </Button>
          <Button onClick={submit} disabled={busy}>
            <PhoneCall className="h-4 w-4" /> {busy ? 'Saqlanmoqda...' : "Navbatga qo'shish"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
          <p className="font-semibold text-slate-700">{studentName}</p>
          <p className="mt-0.5 text-slate-500">
            O'quvchi "Bog'lanish kerak" navbatiga tushadi — operator bog'lanib javobini yozadi.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">Sabab</label>
          <select
            value={reasonId}
            onChange={(e) => setReasonId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-400"
          >
            <option value="">— Tanlanmagan —</option>
            {reasons.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
          {reasons.length === 0 && (
            <p className="mt-1 text-xs text-amber-700">
              Sabablar ro'yxati bo'sh — Sozlamalar → Sabablar da "Bog'lanish kerak" kategoriyasiga
              sabab qo'shing (sababsiz ham navbatga qo'shsa bo'ladi).
            </p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">Izoh (ixtiyoriy)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Operator uchun qisqacha: nima haqida gaplashish kerak"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-400"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">
            Qachon bog'lanilsin (ixtiyoriy)
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-400"
          />
          <p className="mt-1 text-xs text-slate-400">
            Bo'sh qolsa — darhol navbatga. Sana tanlansa "Qayta qo'ng'iroq" bo'lib o'sha kunda chiqadi.
          </p>
        </div>

        {error && (
          <div className={cn('rounded-lg px-3 py-2 text-sm', existing ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-600')}>
            {error}
            {existing && (
              <>
                {' '}
                <Link to="/admin/students/boglanish" className="font-semibold underline">
                  Navbatni ochish
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
