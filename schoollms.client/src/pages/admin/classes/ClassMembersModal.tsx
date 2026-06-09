import { useEffect, useMemo, useState } from 'react'
import { Trash2, UserPlus, Search } from 'lucide-react'
import type { Group, GroupMember, Student } from '@/types'
import { getGroupMembers, addGroupMember, removeGroupMember } from '@/api/services/classes'
import { getStudents } from '@/api/services/students'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Loader } from '@/components/ui/Loader'
import { formatDate, cn } from '@/lib/utils'

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

  const handleRemove = async (m: GroupMember) => {
    if (!group || busy) return
    if (!confirm(`"${m.fullName}" ni guruhdan chiqarasizmi?`)) return
    setBusy(true)
    try {
      await removeGroupMember(group.id, m.studentId)
      const fresh = await getGroupMembers(group.id)
      setMembers(fresh)
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Chiqarib bo\'lmadi')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={!!group}
      onClose={onClose}
      title={group ? `${group.name} — a'zolar` : "A'zolar"}
      size="md"
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

          {/* Qidiruvli o'quvchi tanlash */}
          <div className="relative">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                className="w-full text-sm text-slate-800 outline-none disabled:opacity-50"
                placeholder="O'quvchi qidirish..."
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

          {/* A'zolar ro'yxati */}
          <div className="overflow-hidden rounded-lg border border-slate-100">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2">O'quvchi</th>
                  <th className="px-3 py-2">Qo'shilgan sana</th>
                  <th className="px-3 py-2 text-right">Amal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeMembers.map((m) => (
                  <tr key={m.studentId} className="hover:bg-slate-50/60">
                    <td className="px-3 py-2 font-medium text-slate-800">{m.fullName}</td>
                    <td className="px-3 py-2 text-slate-500">{formatDate(m.joinedAt)}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        title="Chiqarish"
                        disabled={busy}
                        onClick={() => handleRemove(m)}
                        className={cn(
                          'rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50',
                        )}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {activeMembers.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-8 text-center text-slate-400">
                      A'zolar yo'q
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  )
}
