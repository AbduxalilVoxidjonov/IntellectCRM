import type { Group, GroupMember, StudentGroupMembership, GroupFillRow } from '@/types'
import { delay, uid } from '@/lib/utils'
import { api, USE_MOCK } from '../client'
import { classesMock } from '../mock/classes'

export type ClassPayload = Omit<Group, 'id'>

export async function getClasses(): Promise<Group[]> {
  if (USE_MOCK) {
    await delay()
    return classesMock
  }
  const { data } = await api.get<Group[]>('/admin/classes')
  return data
}

export async function createClass(payload: ClassPayload, force?: boolean): Promise<Group> {
  if (USE_MOCK) {
    await delay(200)
    return { ...payload, id: uid() }
  }
  const { data } = await api.post<Group>('/admin/classes', payload, {
    params: force ? { force: true } : undefined,
  })
  return data
}

/**
 * Guruhni yangilash. Oylik to'lov o'zgargan bo'lsa, `applyFee` orqali yangi narx joriy oy
 * o'quvchilariga qo'llanishini boshqaramiz: true = joriy oydan, false = keyingi oydan.
 */
export async function updateClass(
  id: string,
  payload: ClassPayload,
  applyFee?: boolean,
  force?: boolean,
): Promise<Group> {
  if (USE_MOCK) {
    await delay(200)
    return { ...payload, id }
  }
  const params: Record<string, unknown> = {}
  if (applyFee !== undefined) params.applyFee = applyFee
  if (force) params.force = true
  const { data } = await api.put<Group>(`/admin/classes/${id}`, payload, {
    params: Object.keys(params).length ? params : undefined,
  })
  return data
}

export async function deleteClass(id: string, reasonId?: string): Promise<void> {
  if (USE_MOCK) {
    await delay(200)
    return
  }
  await api.delete(`/admin/classes/${id}`, { params: reasonId ? { reasonId } : undefined })
}

/** Arxivlangan guruhlar ro'yxati. */
export async function getArchivedClasses(): Promise<Group[]> {
  if (USE_MOCK) {
    await delay()
    return []
  }
  const { data } = await api.get<Group[]>('/admin/classes/archived')
  return data
}

/** Guruhni arxivlash — o'quvchilari ham arxivlanadi. */
export async function archiveClass(id: string): Promise<{ archivedStudents: number }> {
  const { data } = await api.post<{ archivedStudents: number }>(`/admin/classes/${id}/archive`)
  return data
}

/** Guruhni arxivdan chiqarish — guruh bilan arxivlangan o'quvchilar ham qaytariladi. */
export async function unarchiveClass(id: string): Promise<{ restoredStudents: number }> {
  const { data } = await api.post<{ restoredStudents: number }>(`/admin/classes/${id}/unarchive`)
  return data
}

/* ---------- Guruh a'zoligi (many-to-many) ---------- */

/** Guruh a'zolari ro'yxati. */
export async function getGroupMembers(id: string): Promise<GroupMember[]> {
  if (USE_MOCK) {
    await delay()
    return []
  }
  const { data } = await api.get<GroupMember[]>(`/admin/classes/${id}/members`)
  return data
}

/** Guruhga o'quvchi qo'shish. To'lgan/allaqachon a'zo bo'lsa server 409/400 qaytaradi. */
export async function addGroupMember(
  id: string,
  studentId: string,
  joinedAt?: string,
): Promise<{ ok: boolean }> {
  if (USE_MOCK) {
    await delay(150)
    return { ok: true }
  }
  const { data } = await api.post<{ ok: boolean }>(`/admin/classes/${id}/members`, {
    studentId,
    joinedAt,
  })
  return data
}

/** Guruhdan o'quvchini chiqarish (left deb belgilanadi). Sabab (ixtiyoriy) auditga yoziladi. */
export async function removeGroupMember(id: string, studentId: string, reasonId?: string): Promise<void> {
  if (USE_MOCK) {
    await delay(150)
    return
  }
  await api.delete(`/admin/classes/${id}/members/${studentId}`, {
    params: reasonId ? { reasonId } : undefined,
  })
}

/** A'zolikni AKTIVLASHTIRISH (sinov → faol). Birinchi (qisman) oy to'lovi shu sanadan avtomatik hisoblanadi. */
export async function activateMember(id: string, studentId: string, date: string): Promise<void> {
  if (USE_MOCK) {
    await delay(150)
    return
  }
  await api.post(`/admin/classes/${id}/members/${studentId}/activate`, { date })
}

/** A'zolikni MUZLATISH — kiritilgan sanadan boshlab oylik to'lov hisoblanmaydi. Sabab (ixtiyoriy). */
export async function freezeMember(id: string, studentId: string, date: string, reasonId?: string): Promise<void> {
  if (USE_MOCK) {
    await delay(150)
    return
  }
  await api.post(`/admin/classes/${id}/members/${studentId}/freeze`, { date, reasonId })
}

/** A'zolikni SINOVGA qaytarish (active/frozen → trial). Sabab (ixtiyoriy). */
export async function returnMemberToTrial(id: string, studentId: string, reasonId?: string): Promise<void> {
  if (USE_MOCK) {
    await delay(150)
    return
  }
  await api.post(`/admin/classes/${id}/members/${studentId}/return-trial`, { reasonId })
}

/** O'quvchining barcha guruh a'zoliklari. */
export async function getStudentGroups(studentId: string): Promise<StudentGroupMembership[]> {
  if (USE_MOCK) {
    await delay()
    return []
  }
  const { data } = await api.get<StudentGroupMembership[]>(
    `/admin/classes/student/${studentId}/groups`,
  )
  return data
}

/** Guruhlar to'ldirilishi (sig'im / a'zolar / bo'sh o'rin). */
export async function getGroupFill(): Promise<GroupFillRow[]> {
  if (USE_MOCK) {
    await delay()
    return []
  }
  const { data } = await api.get<GroupFillRow[]>('/admin/classes/fill')
  return data
}

export interface CompleteAndTransferResult {
  ok: boolean
  archivedGroupId: string
  newGroupId: string
  certificatesGenerated: number
  enrolledInNew: number
  targetCourseName?: string
}

/** Guruhni yakunlash (Hybrid): eski guruh arxivlanadi, maqsad kurs bilan yangi guruh ochiladi, sertifikat beriladi. */
export async function completeAndTransferClass(
  id: string,
  opts?: {
    autoEnrollNewGroup?: boolean
    newGroupName?: string
    completionNotes?: string
    /** Yangi guruh kursi. Bo'sh bo'lsa — eski kurs qayta ishlatiladi. */
    targetCourseId?: string
  },
): Promise<CompleteAndTransferResult> {
  if (USE_MOCK) {
    await delay(300)
    return {
      ok: true,
      archivedGroupId: id,
      newGroupId: 'mock-new-group',
      certificatesGenerated: 5,
      enrolledInNew: 5,
      targetCourseName: 'Elementary',
    }
  }
  const { data } = await api.post<CompleteAndTransferResult>(
    `/admin/classes/${id}/complete-and-transfer`,
    {
      autoEnrollNewGroup: opts?.autoEnrollNewGroup ?? true,
      newGroupName: opts?.newGroupName ?? null,
      completionNotes: opts?.completionNotes ?? null,
      targetCourseId: opts?.targetCourseId ?? null,
    },
  )
  return data
}
