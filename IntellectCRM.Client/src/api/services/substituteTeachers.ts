import { api } from '../client'
import type { SubstituteTeacherAssignment, CreateSubstituteAssignmentPayload } from '@/types'

export interface GetSubstituteAssignmentsParams {
  groupId?: string
  teacherId?: string
  date?: string
  isActive?: boolean
}

/** O'rinbosar o'qituvchilar tayinlovlari ro'yxatini olish */
export async function getSubstituteAssignments(
  params?: GetSubstituteAssignmentsParams
): Promise<SubstituteTeacherAssignment[]> {
  const { data } = await api.get<SubstituteTeacherAssignment[]>('/admin/substitute-teachers', { params })
  return data
}

/** ID bo'yicha tayinlovni olish */
export async function getSubstituteAssignmentById(id: string): Promise<SubstituteTeacherAssignment> {
  const { data } = await api.get<SubstituteTeacherAssignment>(`/admin/substitute-teachers/${id}`)
  return data
}

/** Yangi o'rinbosar o'qituvchi biriktirish */
export async function createSubstituteAssignment(
  payload: CreateSubstituteAssignmentPayload
): Promise<SubstituteTeacherAssignment> {
  const { data } = await api.post<SubstituteTeacherAssignment>('/admin/substitute-teachers', payload)
  return data
}

/** Tayinlovni bekor qilish */
export async function cancelSubstituteAssignment(id: string): Promise<{ message: string }> {
  const { data } = await api.delete<{ message: string }>(`/admin/substitute-teachers/${id}`)
  return data
}

/** O'qituvchi ilovasi uchun — me'yoriy o'rinbosarliklar ro'yxatini olish */
export async function getMySubstitutions(): Promise<SubstituteTeacherAssignment[]> {
  const { data } = await api.get<SubstituteTeacherAssignment[]>('/teacher/substitutions')
  return data
}

/** Guruhning oydagi dars kunlarini olish (modal uchun) */
export async function getGroupLessonDates(
  groupId: string,
  month: string
): Promise<Array<{ date: string; dayName: string; isScheduled: boolean }>> {
  const { data } = await api.get<Array<{ date: string; dayName: string; isScheduled: boolean }>>(
    '/admin/substitute-teachers/group-lesson-dates',
    { params: { groupId, month } }
  )
  return data
}
