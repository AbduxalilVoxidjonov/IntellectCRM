import { useEffect, useState } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import type { Group } from '@/types'
import { getClasses, transferMember } from '@/api/services/classes'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Input'

const today = () => new Date().toISOString().slice(0, 10)

interface Props {
  open: boolean
  onClose: () => void
  studentId: string
  studentName: string
  fromGroupId: string
  fromGroupName: string
  /** Muvaffaqiyatli o'tkazilgach — chaqiruvchi ro'yxatini yangilash uchun. */
  onDone: () => void
}

/**
 * O'quvchini joriy guruhdan boshqa (mavjud) guruhga o'tkazish: eski guruh muzlatiladi,
 * yangi guruh darhol aktivlashtiriladi — bitta modal, ikkita sana bilan.
 */
export function TransferGroupModal({ open, onClose, studentId, studentName, fromGroupId, fromGroupName, onDone }: Props) {
  const [groups, setGroups] = useState<Group[]>([])
  const [toGroupId, setToGroupId] = useState('')
  const [freezeDate, setFreezeDate] = useState(today())
  const [activateDate, setActivateDate] = useState(today())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setToGroupId('')
    setFreezeDate(today())
    setActivateDate(today())
    setError('')
    getClasses()
      .then((gs) => setGroups(gs.filter((g) => !g.isArchived && g.id !== fromGroupId)))
      .catch(() => setGroups([]))
  }, [open, fromGroupId])

  const handleSave = async () => {
    if (!toGroupId || saving) return
    setSaving(true)
    setError('')
    try {
      await transferMember(fromGroupId, studentId, toGroupId, freezeDate, activateDate)
      onDone()
      onClose()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : ((err as any)?.response?.data?.message ?? "Guruhni almashtirib bo'lmadi"),
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => !saving && onClose()}
      size="sm"
      title="Guruhni almashtirish"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Bekor
          </Button>
          <Button onClick={handleSave} disabled={!toGroupId || saving}>
            <ArrowLeftRight className="h-4 w-4" /> {saving ? 'Saqlanmoqda...' : 'Saqlash'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          <span className="font-medium text-slate-800">{studentName}</span>
        </p>

        <div>
          <span className="mb-1 block text-sm font-medium text-slate-600">Aktiv guruhi (hozirgi)</span>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {fromGroupName}
          </div>
        </div>

        <Select label="Yangi guruh" value={toGroupId} onChange={(e) => setToGroupId(e.target.value)}>
          <option value="">— guruh tanlang —</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </Select>

        {toGroupId && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-600">
                Eski guruhda muzlatish sanasi
              </span>
              <input
                type="date"
                value={freezeDate}
                onChange={(e) => setFreezeDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-400"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-600">
                Yangi guruhda aktivlashtirish sanasi
              </span>
              <input
                type="date"
                value={activateDate}
                onChange={(e) => setActivateDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-400"
              />
            </label>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <p className="text-xs text-slate-400">
          Saqlanganda: eski guruhda shu sanagacha qatnashgan darslar uchun qisman to'lov hisoblanib
          a'zolik muzlatiladi; yangi guruhda esa shu sanadan qisman oylik hisoblanib darhol
          aktivlashtiriladi.
        </p>
      </div>
    </Modal>
  )
}
