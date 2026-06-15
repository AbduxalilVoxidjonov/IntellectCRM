import { useEffect, useState } from 'react'
import { ClipboardCheck, Plus, Pencil, Trash2 } from 'lucide-react'
import type { Group } from '@/types'
import {
  getCriteria,
  createCriterion,
  updateCriterion,
  deleteCriterion,
  getGroupCriteria,
  setGroupCriteria,
  type GradingCriterion,
} from '@/api/services/grading'
import { getClasses } from '@/api/services/classes'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Loader } from '@/components/ui/Loader'
import { Modal } from '@/components/ui/Modal'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { cn } from '@/lib/utils'

export function GradingCriteriaPage() {
  const [criteria, setCriteria] = useState<GradingCriterion[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)

  // Mezon yaratish/tahrirlash modali
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<GradingCriterion | null>(null)
  const [fName, setFName] = useState('')
  const [fDesc, setFDesc] = useState('')
  const [saving, setSaving] = useState(false)

  // Guruhga biriktirish
  const [groupId, setGroupId] = useState('')
  const [assigned, setAssigned] = useState<string[]>([])
  const [assignBusy, setAssignBusy] = useState(false)
  const [assignSaved, setAssignSaved] = useState(false)

  useEffect(() => {
    Promise.all([getCriteria(), getClasses()])
      .then(([c, g]) => {
        setCriteria(c)
        setGroups(g)
        if (g.length > 0) setGroupId(g[0].id)
      })
      .finally(() => setLoading(false))
  }, [])

  // Tanlangan guruh o'zgarganda — biriktirilgan mezonlarni yuklash
  useEffect(() => {
    if (!groupId) {
      setAssigned([])
      return
    }
    let active = true
    getGroupCriteria(groupId).then((ids) => {
      if (active) setAssigned(ids)
    })
    return () => {
      active = false
    }
  }, [groupId])

  const openCreate = () => {
    setEditing(null)
    setFName('')
    setFDesc('')
    setFormOpen(true)
  }

  const openEdit = (c: GradingCriterion) => {
    setEditing(c)
    setFName(c.name)
    setFDesc(c.description)
    setFormOpen(true)
  }

  const handleSave = async () => {
    if (!fName.trim() || saving) return
    setSaving(true)
    try {
      if (editing) {
        await updateCriterion(editing.id, fName.trim(), fDesc.trim())
      } else {
        await createCriterion(fName.trim(), fDesc.trim())
      }
      const fresh = await getCriteria()
      setCriteria(fresh)
      setFormOpen(false)
      setEditing(null)
    } catch (e: any) {
      alert(e?.response?.data?.message ?? "Saqlab bo'lmadi")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (c: GradingCriterion) => {
    if (!confirm("Mezonni o'chirasizmi? Bog'langan baholar ham o'chadi.")) return
    try {
      await deleteCriterion(c.id)
      setCriteria((prev) => prev.filter((x) => x.id !== c.id))
      setAssigned((prev) => prev.filter((id) => id !== c.id))
    } catch (e: any) {
      alert(e?.response?.data?.message ?? "O'chirib bo'lmadi")
    }
  }

  const toggleAssign = async (criterionId: string, checked: boolean) => {
    if (!groupId) return
    const next = checked
      ? [...assigned, criterionId]
      : assigned.filter((id) => id !== criterionId)
    setAssigned(next)
    setAssignBusy(true)
    setAssignSaved(false)
    try {
      await setGroupCriteria(groupId, next)
      setAssignSaved(true)
      setTimeout(() => setAssignSaved(false), 1600)
    } catch (e: any) {
      // Xato bo'lsa — eski holatga qaytaramiz
      alert(e?.response?.data?.message ?? "Saqlab bo'lmadi")
      try {
        const ids = await getGroupCriteria(groupId)
        setAssigned(ids)
      } catch {
        /* jim */
      }
    } finally {
      setAssignBusy(false)
    }
  }

  if (loading) return <Loader label="Yuklanmoqda..." />

  return (
    <div>
      <PageHeader
        title="Baholash mezonlari"
        sub="Mezon yarating va guruhlarga biriktiring — har guruhga boshqa-boshqa mezonlar"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 1. Mezonlar puli */}
        <Card
          title="Mezonlar"
          actions={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Mezon
            </Button>
          }
        >
          {criteria.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <ClipboardCheck className="h-6 w-6" />
              </div>
              <p className="text-sm text-slate-500">
                Hali mezon yo'q. "Mezon" tugmasi orqali birinchisini qo'shing.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {criteria.map((c) => (
                <div key={c.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-slate-800">{c.name}</p>
                    {c.description && (
                      <p className="mt-0.5 text-xs text-slate-400">{c.description}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      title="Tahrirlash"
                      onClick={() => openEdit(c)}
                      className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      title="O'chirish"
                      onClick={() => handleDelete(c)}
                      className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* 2. Guruhga biriktirish */}
        <Card
          title="Guruhga biriktirish"
          sub={assignBusy ? 'Saqlanmoqda...' : assignSaved ? 'Saqlandi' : undefined}
        >
          {groups.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Guruh yo'q.</p>
          ) : (
            <div className="space-y-4">
              <Select
                label="Guruh"
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>

              {criteria.length === 0 ? (
                <p className="rounded-lg bg-slate-50 px-3 py-3 text-center text-sm text-slate-400">
                  Avval mezon yarating
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {criteria.map((c) => {
                    const checked = assigned.includes(c.id)
                    return (
                      <label
                        key={c.id}
                        className={cn(
                          'flex cursor-pointer items-center gap-3 py-2.5 first:pt-0 last:pb-0',
                          assignBusy && 'pointer-events-none opacity-60',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={assignBusy}
                          onChange={(e) => toggleAssign(c.id, e.target.checked)}
                          className="h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-200"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-700">
                            {c.name}
                          </span>
                          {c.description && (
                            <span className="block truncate text-xs text-slate-400">
                              {c.description}
                            </span>
                          )}
                        </span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Mezon yaratish/tahrirlash */}
      <Modal
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
        title={editing ? 'Mezonni tahrirlash' : 'Yangi mezon'}
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setFormOpen(false)
                setEditing(null)
              }}
            >
              Bekor
            </Button>
            <Button onClick={handleSave} disabled={saving || !fName.trim()}>
              {editing ? 'Saqlash' : 'Qo\'shish'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="Nom"
            required
            placeholder="Masalan: Faollik"
            value={fName}
            onChange={(e) => setFName(e.target.value)}
            autoFocus
          />
          <Textarea
            label="Izoh"
            rows={3}
            placeholder="Ixtiyoriy izoh (masalan: uy vazifasini bajardimi)"
            value={fDesc}
            onChange={(e) => setFDesc(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  )
}
