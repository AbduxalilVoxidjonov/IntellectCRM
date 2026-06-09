import { useEffect, useState } from 'react'
import type { Credentials, Student, StudentGroupMembership } from '@/types'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { CredentialsBox } from '@/components/ui/CredentialsBox'
import { getStudentCredentials, resetStudentPassword } from '@/api/services/students'
import { getStudentGroups } from '@/api/services/classes'
import { genderLabels } from '@/config/constants'
import { formatDate, formatMoney } from '@/lib/utils'

interface Props {
  student: Student | null
  onClose: () => void
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2.5 last:border-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-right text-sm font-medium text-slate-800">{value}</span>
    </div>
  )
}

export function StudentViewModal({ student, onClose }: Props) {
  const [credentials, setCredentials] = useState<Credentials | null>(null)
  const [groups, setGroups] = useState<StudentGroupMembership[]>([])

  useEffect(() => {
    if (!student) {
      setCredentials(null)
      setGroups([])
      return
    }
    let active = true
    setCredentials(null)
    setGroups([])
    getStudentCredentials(student.id)
      .then((c) => active && setCredentials(c))
      .catch(() => active && setCredentials(null))
    getStudentGroups(student.id)
      .then((g) => active && setGroups(g))
      .catch(() => active && setGroups([]))
    return () => {
      active = false
    }
  }, [student])

  const activeGroups = groups.filter((g) => g.isActive)

  return (
    <Modal
      open={!!student}
      onClose={onClose}
      title="O'quvchi ma'lumotlari"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Yopish
        </Button>
      }
    >
      {student && (
        <div className="space-y-0">
          <Row label="F.I.SH" value={student.fullName} />
          <Row label="Tug'ilgan kun" value={formatDate(student.birthDate)} />
          <Row label="Jinsi" value={genderLabels[student.gender]} />
          <Row label="Manzil" value={student.address} />
          <Row label="Guruh" value={student.className} />
          {activeGroups.length > 0 && (
            <div className="border-b border-slate-100 py-2.5">
              <span className="mb-1.5 block text-sm text-slate-400">Guruhlar</span>
              <div className="flex flex-wrap gap-1.5">
                {activeGroups.map((g) => (
                  <span
                    key={g.id}
                    className="inline-flex items-center gap-1.5 rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700"
                  >
                    {g.groupName}
                    <span className="text-brand-400">{formatDate(g.joinedAt)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          <Row label="Ota-onasi" value={student.parentFullName} />
          <Row label="Ota-onasi raqami" value={student.parentPhone} />
          <Row label="Balans" value={formatMoney(student.balance)} />
          {(student.discountPct > 0 || student.discountAmount > 0) && (
            <Row
              label="Chegirma"
              value={
                [
                  student.discountPct > 0 ? `${student.discountPct}%` : null,
                  student.discountAmount > 0 ? `${formatMoney(student.discountAmount)}` : null,
                ]
                  .filter(Boolean)
                  .join(' + ') + (student.discountNote ? ` — ${student.discountNote}` : '')
              }
            />
          )}
          <CredentialsBox
            credentials={credentials}
            onReset={async () => {
              const c = await resetStudentPassword(student.id)
              setCredentials(c)
            }}
          />
        </div>
      )}
    </Modal>
  )
}
