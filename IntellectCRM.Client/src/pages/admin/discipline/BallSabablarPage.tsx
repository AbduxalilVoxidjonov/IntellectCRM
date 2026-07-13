import { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, CalendarCheck } from 'lucide-react'
import type { DisciplineReason } from '@/types'
import {
  getDisciplineReasons,
  createDisciplineReason,
  updateDisciplineReason,
  deleteDisciplineReason,
  setAttendanceReasonPoints,
} from '@/api/services/discipline'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { Loader } from '@/components/ui/Loader'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { usePerm } from '@/lib/permissions'

export function BallSabablarPage() {
  const { can } = usePerm()
  const [reasons, setReasons] = useState<DisciplineReason[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<DisciplineReason | null>(null)
  const [name, setName] = useState('')
  const [points, setPoints] = useState(0)

  useEffect(() => {
    getDisciplineReasons()
      .then(setReasons)
      .finally(() => setLoading(false))
  }, [])

  const attendance = useMemo(() => reasons.filter((r) => r.kind === 'attendance'), [reasons])
  const other = useMemo(() => reasons.filter((r) => r.kind === 'other'), [reasons])

  const openCreate = () => {
    setEditing(null)
    setName('')
    setPoints(0)
    setOpen(true)
  }
  const openEdit = (r: DisciplineReason) => {
    setEditing(r)
    setName(r.name)
    setPoints(r.points)
    setOpen(true)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const isAttendance = editing?.kind === 'attendance'
    if (!isAttendance && (!name.trim() || points === 0)) return
    let saved: DisciplineReason
    if (editing) {
      saved = isAttendance
        ? await setAttendanceReasonPoints(editing.id, points)
        : await updateDisciplineReason(editing.id, name.trim(), points)
      setReasons((p) => p.map((x) => (x.id === saved.id ? saved : x)))
    } else {
      saved = await createDisciplineReason(name.trim(), points)
      setReasons((p) => [...p, saved])
    }
    setOpen(false)
  }

  const remove = (r: DisciplineReason) => {
    if (!confirm(`"${r.name}" sababini o'chirasizmi?`)) return
    deleteDisciplineReason(r.id).then(() => setReasons((p) => p.filter((x) => x.id !== r.id)))
  }

  const PointsBadge = ({ p }: { p: number }) => (
    <span
      className={cn(
        'rounded-md px-2 py-0.5 font-mono text-sm font-semibold',
        p === 0
          ? 'bg-slate-100 text-slate-400'
          : p < 0
            ? 'bg-red-50 text-red-600'
            : 'bg-emerald-50 text-emerald-600',
      )}
    >
      {p > 0 ? `+${p}` : p}
    </span>
  )

  return (
    <div>
      <PageHeader
        title="Ball sabablar"
        sub="Intizomiy ball sabablari — har biriga ball (manfiy = jazo, musbat = rag'bat)"
        actions={
          can('discipline', 'create') && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Yangi sabab
            </Button>
          )
        }
      />

      {loading ? (
        <Card>
          <Loader label="Yuklanmoqda..." />
        </Card>
      ) : (
        <div className="space-y-5">
          {/* Davomat sabablari (jurnal bilan bog'liq) */}
          <Card
            tight
            title={
              <span className="inline-flex items-center gap-2">
                <CalendarCheck className="h-4 w-4 text-brand-600" /> Davomat sabablari
              </span>
            }
            sub={'jurnalda shu sabab bilan davomat qo\'yilsa, qoldiga ta\'sir qiladi (nomi "Davomat sabablari"da)'}
          >
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th className="w-10">#</th>
                    <th>Sabab</th>
                    <th>Ball</th>
                    <th className="text-right">Amallar</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.map((r, i) => (
                    <tr key={r.id}>
                      <td className="num text-slate-400">{i + 1}</td>
                      <td className="font-medium text-slate-800">{r.name}</td>
                      <td>
                        <PointsBadge p={r.points} />
                      </td>
                      <td>
                        <div className="flex items-center justify-end">
                          {can('discipline', 'edit') && (
                            <button
                              type="button"
                              title="Ballni o'zgartirish"
                              onClick={() => openEdit(r)}
                              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {attendance.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                        Davomat sabablari yo'q (Sozlamalar → Davomat sabablarida qo'shiladi)
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Boshqa intizomiy sabablar */}
          <Card
            tight
            title="Boshqa intizomiy sabablar"
            sub="qo'lda kiritiladigan sabablar (janjal, rag'bat va h.k.)"
          >
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th className="w-10">#</th>
                    <th>Sabab</th>
                    <th>Ball</th>
                    <th className="text-right">Amallar</th>
                  </tr>
                </thead>
                <tbody>
                  {other.map((r, i) => (
                    <tr key={r.id}>
                      <td className="num text-slate-400">{i + 1}</td>
                      <td className="font-medium text-slate-800">{r.name}</td>
                      <td>
                        <PointsBadge p={r.points} />
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-0.5">
                          {can('discipline', 'edit') && (
                            <button
                              type="button"
                              title="Tahrirlash"
                              onClick={() => openEdit(r)}
                              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          {can('discipline', 'delete') && (
                            <button
                              type="button"
                              title="O'chirish"
                              onClick={() => remove(r)}
                              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {other.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                        Hali sabab qo'shilmagan — "Yangi sabab" tugmasi orqali qo'shing
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={
          editing
            ? editing.kind === 'attendance'
              ? `${editing.name} — ball`
              : 'Sababni tahrirlash'
            : 'Yangi sabab'
        }
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Bekor qilish
            </Button>
            <Button
              type="submit"
              form="reason-form"
              disabled={editing?.kind !== 'attendance' && (!name.trim() || points === 0)}
            >
              Saqlash
            </Button>
          </>
        }
      >
        <form id="reason-form" onSubmit={submit} className="space-y-4">
          <Input
            label="Sabab nomi"
            required
            placeholder="masalan: Darsga kech qoldi"
            value={name}
            disabled={editing?.kind === 'attendance'}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label="Ball (manfiy = jazo, musbat = rag'bat)"
            type="number"
            className="font-mono"
            value={points}
            onChange={(e) => setPoints(Number(e.target.value) || 0)}
          />
          {editing?.kind === 'attendance' ? (
            <p className="text-xs text-slate-400">
              Davomat sababi nomi "Sozlamalar → Davomat sabablari"da o'zgartiriladi. Bu yerda faqat ball
              belgilanadi. 0 = ballga ta'sir qilmaydi.
            </p>
          ) : (
            <p className="text-xs text-slate-400">
              Masalan: −5 (kech qoldi), −10 (janjal), +3 (faol ishtirok). 0 bo'lmasin.
            </p>
          )}
        </form>
      </Modal>
    </div>
  )
}
