import type { TeacherReportRow, TeacherReportDetail } from '@/types'
import { api, USE_MOCK } from '../client'

/** Barcha o'qituvchilar faollik hisoboti. */
export async function getTeacherReport(): Promise<TeacherReportRow[]> {
  if (USE_MOCK) return []
  const { data } = await api.get<TeacherReportRow[]>('/admin/teacher-reports')
  return data
}

/** Bitta o'qituvchining batafsil hisoboti (sinf/fan yoyilmasi). */
export async function getTeacherReportDetail(id: string): Promise<TeacherReportDetail> {
  const { data } = await api.get<TeacherReportDetail>(`/admin/teacher-reports/${id}`)
  return data
}
