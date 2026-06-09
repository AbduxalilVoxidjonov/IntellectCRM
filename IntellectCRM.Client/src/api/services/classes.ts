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

export async function createClass(payload: ClassPayload): Promise<Group> {
  if (USE_MOCK) {
    await delay(200)
    return { ...payload, id: uid() }
  }
  const { data } = await api.post<Group>('/admin/classes', payload)
  return data
}

/**
 * Sinfni yangilash. Oylik to'lov o'zgargan bo'lsa, `applyFee` orqali yangi narx joriy oy
 * o'quvchilariga qo'llanishini boshqaramiz: true = joriy oydan, false = keyingi oydan.
 */
export async function updateClass(
  id: string,
  payload: ClassPayload,
  applyFee?: boolean,
): Promise<Group> {
  if (USE_MOCK) {
    await delay(200)
    return { ...payload, id }
  }
  const { data } = await api.put<Group>(`/admin/classes/${id}`, payload, {
    params: applyFee === undefined ? undefined : { applyFee },
  })
  return data
}

export async function deleteClass(id: string): Promise<void> {
  if (USE_MOCK) {
    await delay(200)
    return
  }
  await api.delete(`/admin/classes/${id}`)
}

/** Arxivlangan sinflar ro'yxati. */
export async function getArchivedClasses(): Promise<Group[]> {
  if (USE_MOCK) {
    await delay()
    return []
  }
  const { data } = await api.get<Group[]>('/admin/classes/archived')
  return data
}

/** Sinfni arxivlash — o'quvchilari ham arxivlanadi. */
export async function archiveClass(id: string): Promise<{ archivedStudents: number }> {
  const { data } = await api.post<{ archivedStudents: number }>(`/admin/classes/${id}/archive`)
  return data
}

/** Sinfni arxivdan chiqarish — sinf bilan arxivlangan o'quvchilar ham qaytariladi. */
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

/** Guruhdan o'quvchini chiqarish (left deb belgilanadi). */
export async function removeGroupMember(id: string, studentId: string): Promise<void> {
  if (USE_MOCK) {
    await delay(150)
    return
  }
  await api.delete(`/admin/classes/${id}/members/${studentId}`)
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
