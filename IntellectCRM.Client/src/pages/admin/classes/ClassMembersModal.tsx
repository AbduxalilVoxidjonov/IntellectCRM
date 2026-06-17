import { useEffect, useMemo, useState } from 'react'
import { Trash2, UserPlus, Search, CheckCircle2, Snowflake, Plus, RotateCcw } from 'lucide-react'
import type { Group, GroupMember, Student } from '@/types'
import {
  getGroupMembers,
  addGroupMember,
  removeGroupMember,
  activateMember,
  freezeMember,
  returnMemberToTrial,
} from '@/api/services/classes'
import { getStudents, createStudent } from '@/api/services/students'
import type { StudentPayload } from '@/api/services/students'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Loader } from '@/components/ui/Loader'
import { ReasonPromptModal } from '@/components/ui/ReasonPromptModal'
import { formatDate, formatMoney, cn } from '@/lib/utils'
import { StudentFormModal } from '../students/StudentFormModal'

/** O'quvchi holatiga qarab "o'chirish" sabab kategoriyasi. */
function removeCategory(status: string): string {
  return status === 'active' ? 'remove_active' : status === 'frozen' ? 'remove_frozen' : 'remove_trial'
}

interface Props {
  group: Group | null
  onClose: () => void
}

export function ClassMembersModal({ group, onClose }: Props) {
  const [members, setMembers] = useState<GroupMember[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  /** Aktivlashtirish uchun sana so'rash modali. */
  const [dateAction, setDateAction] = useState<{ kind: 'activate'; m: GroupMember } | null>(null)
  const [actionDate, setActionDate] = useState('')
  /** Sabab bilan amal (muzlatish/chiqarish/sinovga qaytarish). */
  const [reasonAction, setReasonAction] = useState<{ kind: 'freeze' | 'remove' | 'return'; m: GroupMember } | null>(null)
  /** "Yangi o'quvchi" yaratish formasi ochiqmi — yaratilgach shu guruhga qo'shiladi. */
  const [newStudentOpen, setNewStudentOpen] = useState(false)

  useEffect(() => {
    if (!group) {
      setMembers([])
      setQuery('')
      return
    }
    let active = true
    setLoading(true)
    Promise.all([getGroupMembers(group.id), getStudents()])
      .then(([m, s]) => {
        if (!active) return
        setMembers(m)
        setStudents(s)
      })
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [group])

  const activeMembers = members.filter((m) => m.isActive)
  const capacity = group?.capacity ?? 0
  const isFull = capacity > 0 && activeMembers.length >= capacity

  const memberIds = useMemo(
    () => new Set(activeMembers.map((m) => m.studentId)),
    [activeMembers],
  )

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return students
      .filter((s) => !memberIds.has(s.id) && s.fullName.toLowerCase().includes(q))
      .slice(0, 8)
  }, [query, students, memberIds])

  const handleAdd = async (studentId: string, fullName: string) => {
    if (!group || busy) return
    setBusy(true)
    try {
      await addGroupMember(group.id, studentId)
      const fresh = await getGroupMembers(group.id)
      setMembers(fresh)
      setQuery('')
    } catch (e: any) {
      alert(e?.response?.data?.message ?? `"${fullName}" ni qo'shib bo'lmadi`)
    } finally {
      setBusy(false)
    }
  }

  /** Yangi o'quvchi yaratiladi va darhol shu guruhga (M2M) qo'shiladi. */
  const handleCreateAndAdd = async (values: StudentPayload) => {
    if (!group) return
    setBusy(true)
    try {
      const created = await createStudent(values)
      await addGroupMember(group.id, created.id)
      const fresh = await getGroupMembers(group.id)
      setMembers(fresh)
      setNewStudentOpen(false)
    } catch (e: any) {
      alert(e?.response?.data?.message ?? "Yangi o'quvchini qo'shib bo'lmadi")
    } finally {
      setBusy(false)
    }
  }

  const openActivate = (m: GroupMember) => {
    setActionDate(new Date().toISOString().slice(0, 10))
    setDateAction({ kind: 'activate', m })
  }

  const confirmDateAction = async () => {
    if (!group || !dateAction || busy) return
    setBusy(true)
    try {
      await activateMember(group.id, dateAction.m.studentId, actionDate)
      const fresh = await getGroupMembers(group.id)
      setMembers(fresh)
      setDateAction(null)
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Amal bajarilmadi')
    } finally {
      setBusy(false)
    }
  }

  /** Sabab modali tasdiqlangach amalni bajaradi. */
  const confirmReasonAction = async (reasonId: string | undefined, date?: string) => {
    if (!group || !reasonAction || busy) return
    const { kind, m } = reasonAction
    setBusy(true)
    try {
      if (kind === 'freeze') await freezeMember(group.id, m.studentId, date ?? new Date().toISOString().slice(0, 10), reasonId)
      else if (kind === 'remove') await removeGroupMember(group.id, m.studentId, reasonId)
      else await returnMemberToTrial(group.id, m.studentId, reasonId)
      const fresh = await getGroupMembers(group.id)
      setMembers(fresh)
      setReasonAction(null)
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Amal bajarilmadi')
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = (m: GroupMember) => {
    if (!group || busy) return
    setReasonAction({ kind: 'remove', m })
  }

  return (
    <>
    <Modal
      open={!!group}
      onClose={onClose}
      title={group ? `${group.name} — a'zolar` : "A'zolar"}
      size="xl"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Yopish
        </Button>
      }
    >
      {loading ? (
        <Loader label="Yuklanmoqda..." />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Faol a'zolar:{' '}
              <span className="font-semibold text-slate-800">{activeMembers.length}</span>
              {capacity > 0 && <span className="text-slate-400"> / {capacity}</span>}
            </p>
            {isFull && (
              <span className="rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                to'lgan
              </span>
            )}
          </div>

          {/* Qidiruvli o'quvchi tanlash + yangi o'quvchi yaratish */}
          <div className="flex items-start gap-2">
          <div className="relative flex-1">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                className="w-full text-sm text-slate-800 outline-none disabled:opacity-50"
                placeholder="Mavjud o'quvchini qidirish..."
                value={query}
                disabled={isFull || busy}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            {candidates.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                {candidates.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    disabled={busy}
                    onClick={() => handleAdd(s.id, s.fullName)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                  >
                    <span>{s.fullName}</span>
                    <UserPlus className="h-4 w-4 text-brand-600" />
                  </button>
                ))}
              </div>
            )}
            {isFull && (
              <p className="mt-1 text-xs text-red-600">
                Guruh to'lgan — yangi o'quvchi qo'shib bo'lmaydi.
              </p>
            )}
          </div>
            <button
              type="button"
              disabled={isFull || busy}
              onClick={() => setNewStudentOpen(true)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
              title="Yangi o'quvchi yaratib, shu guruhga qo'shish"
            >
              <Plus className="h-4 w-4" /> Yangi o'quvchi
            </button>
          </div>

          {/* A'zolar ro'yxati */}
          <div className="overflow-hidden rounded-lg border border-slate-100">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2">O'quvchi</th>
                  <th className="px-3 py-2">Holat</th>
                  <th className="px-3 py-2">Qo'shilgan sana</th>
                  <th className="px-3 py-2 text-right">Amal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeMembers.map((m, idx) => {
                  const sb = statusBadge(m.status)
                  return (
                    <tr key={m.studentId} className="hover:bg-slate-50/60">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 text-right text-xs font-medium text-slate-400">{idx + 1}.</span>
                          <span
                            className={cn(
                              'h-2 w-2 shrink-0 rounded-full',
                              m.balance < 0 ? 'bg-red-500' : 'bg-emerald-500',
                            )}
                            title={m.balance < 0 ? `Qarz: ${formatMoney(m.balance)}` : 'Qarzi yo\'q'}
                          />
                          <span className={cn('font-medium', m.balance < 0 ? 'text-red-600' : 'text-emerald-700')}>
                            {m.fullName}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className={cn('rounded-md px-2 py-0.5 text-xs font-medium', sb.cls)}>
                          {sb.label}
                        </span>
                        {m.status === 'frozen' && m.frozenAt && (
                          <span className="ml-1 text-xs text-slate-400">{formatDate(m.frozenAt)}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-500">{formatDate(m.joinedAt)}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {m.status !== 'active' && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => openActivate(m)}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" /> Aktivlashtirish
                            </button>
                          )}
                          {m.status === 'active' && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => setReasonAction({ kind: 'freeze', m })}
                              className="inline-flex items-center gap-1 rounded-lg bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 transition-colors hover:bg-sky-100 disabled:opacity-50"
                            >
                              <Snowflake className="h-3.5 w-3.5" /> Muzlatish
                            </button>
                          )}
                          {m.status !== 'trial' && (
                            <button
                              type="button"
                              disabled={busy}
                              title="Sinovga qaytarish"
                              onClick={() => setReasonAction({ kind: 'return', m })}
                              className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50"
                            >
                              <RotateCcw className="h-3.5 w-3.5" /> Sinovga
                            </button>
                          )}
                          <button
                            type="button"
                            title="Chiqarish"
                            disabled={busy}
                            onClick={() => handleRemove(m)}
                            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {activeMembers.length === 0 && members.filter(m => !m.isActive).length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-slate-400">
                      A'zolar yo'q
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Muzlatilgan a'zolar */}
          {members.filter(m => !m.isActive).length > 0 && (
            <div className="overflow-hidden rounded-lg border border-slate-100">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th colSpan={4} className="px-3 py-2">Muzlatilgan a'zolar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-slate-50">
                  {members.filter(m => !m.isActive).map((m, idx) => (
                    <tr key={m.studentId} className="text-slate-400">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 text-right text-xs font-medium text-slate-400">{activeMembers.length + idx + 1}.</span>
                          <span
                            className={cn(
                              'h-2 w-2 shrink-0 rounded-full',
                              m.balance < 0 ? 'bg-red-500' : 'bg-slate-300',
                            )}
                            title={m.balance < 0 ? `Qarz: ${formatMoney(m.balance)}` : 'Qarzi yo\'q'}
                          />
                          <span className={cn('font-medium', m.balance < 0 ? 'text-red-600' : 'text-slate-500')}>
                            {m.fullName}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className="rounded-md bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">Muzlatilgan</span>
                        {m.frozenAt && <span className="ml-1 text-xs text-slate-400">{formatDate(m.frozenAt)}</span>}
                      </td>
                      <td className="px-3 py-2 text-slate-400">{formatDate(m.joinedAt)}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => openActivate(m)}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Aktivlashtirish
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Modal>

      <Modal
        open={!!dateAction}
        onClose={() => setDateAction(null)}
        title="Aktivlashtirish"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDateAction(null)}>
              Bekor
            </Button>
            <Button onClick={confirmDateAction} disabled={busy}>
              Aktivlashtirish
            </Button>
          </>
        }
      >
        {dateAction && (
          <div className="space-y-3 text-sm text-slate-600">
            <p>
              <span className="font-medium text-slate-800">{dateAction.m.fullName}</span> — shu sanadan
              oylik to'lov boshlanadi (birinchi oy QISMAN — dars soniga qarab avtomatik hisoblanadi).
            </p>
            <div>
              <span className="mb-1 block text-sm font-medium text-slate-600">Sana</span>
              <input
                type="date"
                value={actionDate}
                onChange={(e) => setActionDate(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-400"
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Muzlatish / chiqarish / sinovga qaytarish — sabab tanlash modali */}
      <ReasonPromptModal
        open={!!reasonAction}
        category={
          reasonAction?.kind === 'freeze' ? 'freeze'
          : reasonAction?.kind === 'return' ? 'return_trial'
          : removeCategory(reasonAction?.m.status ?? 'trial')
        }
        title={
          reasonAction?.kind === 'freeze' ? 'Muzlatish'
          : reasonAction?.kind === 'return' ? 'Sinovga qaytarish'
          : "Guruhdan chiqarish"
        }
        message={
          reasonAction
            ? reasonAction.kind === 'freeze'
              ? `${reasonAction.m.fullName} — shu sanadan boshlab oylik to'lov hisoblanmaydi.`
              : reasonAction.kind === 'return'
                ? `${reasonAction.m.fullName} — sinov holatiga qaytariladi (oylik to'lov hisoblanmaydi).`
                : `${reasonAction.m.fullName} ni guruhdan chiqarasizmi?`
            : undefined
        }
        confirmLabel={
          reasonAction?.kind === 'freeze' ? 'Muzlatish'
          : reasonAction?.kind === 'return' ? 'Sinovga qaytarish'
          : 'Chiqarish'
        }
        tone={reasonAction?.kind === 'freeze' ? 'sky' : reasonAction?.kind === 'return' ? 'brand' : 'red'}
        showDate={reasonAction?.kind === 'freeze'}
        onConfirm={confirmReasonAction}
        onClose={() => setReasonAction(null)}
      />

      {/* Yangi o'quvchi yaratish — saqlangach avtomatik shu guruhga qo'shiladi. */}
      <StudentFormModal
        open={newStudentOpen}
        onClose={() => setNewStudentOpen(false)}
        onSubmit={handleCreateAndAdd}
        initial={null}
      />
    </>
  )
}

function statusBadge(status: string): { label: string; cls: string } {
  switch (status) {
    case 'active':
      return { label: 'Aktiv', cls: 'bg-emerald-50 text-emerald-700' }
    case 'frozen':
      return { label: 'Muzlatilgan', cls: 'bg-sky-50 text-sky-700' }
    default:
      return { label: 'Sinov', cls: 'bg-amber-50 text-amber-700' }
  }
}
