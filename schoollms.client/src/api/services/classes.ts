import type { SchoolClass } from '@/types'
import { delay, uid } from '@/lib/utils'
import { api, USE_MOCK } from '../client'
import { classesMock } from '../mock/classes'

export type ClassPayload = Omit<SchoolClass, 'id'>

export async function getClasses(): Promise<SchoolClass[]> {
  if (USE_MOCK) {
    await delay()
    return classesMock
  }
  const { data } = await api.get<SchoolClass[]>('/admin/classes')
  return data
}

export async function createClass(payload: ClassPayload): Promise<SchoolClass> {
  if (USE_MOCK) {
    await delay(200)
    return { ...payload, id: uid() }
  }
  const { data } = await api.post<SchoolClass>('/admin/classes', payload)
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
): Promise<SchoolClass> {
  if (USE_MOCK) {
    await delay(200)
    return { ...payload, id }
  }
  const { data } = await api.put<SchoolClass>(`/admin/classes/${id}`, payload, {
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
export async function getArchivedClasses(): Promise<SchoolClass[]> {
  if (USE_MOCK) {
    await delay()
    return []
  }
  const { data } = await api.get<SchoolClass[]>('/admin/classes/archived')
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
