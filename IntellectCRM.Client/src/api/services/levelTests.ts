import { api } from '../client'
import type {
  LevelTestListItem,
  LevelTestDetail,
  LevelTestSubmission,
  LevelTestPayload,
} from '@/types'

/** Daraja testlari ro'yxati. */
export async function getLevelTests(): Promise<LevelTestListItem[]> {
  const { data } = await api.get<LevelTestListItem[]>('/admin/level-tests')
  return data
}

/** Bitta testning to'liq tafsiloti (savollar + diapazonlar). */
export async function getLevelTest(id: string): Promise<LevelTestDetail> {
  const { data } = await api.get<LevelTestDetail>(`/admin/level-tests/${id}`)
  return data
}

/** Yangi test yaratish. */
export async function createLevelTest(payload: LevelTestPayload): Promise<LevelTestDetail> {
  const { data } = await api.post<LevelTestDetail>('/admin/level-tests', payload)
  return data
}

/** Testni yangilash. */
export async function updateLevelTest(id: string, payload: LevelTestPayload): Promise<LevelTestDetail> {
  const { data } = await api.put<LevelTestDetail>(`/admin/level-tests/${id}`, payload)
  return data
}

/** Testni o'chirish. */
export async function deleteLevelTest(id: string): Promise<void> {
  await api.delete(`/admin/level-tests/${id}`)
}

/** Test natijalari (topshirganlar — har biri CRM'da lid). */
export async function getLevelTestSubmissions(id: string): Promise<LevelTestSubmission[]> {
  const { data } = await api.get<LevelTestSubmission[]>(`/admin/level-tests/${id}/submissions`)
  return data
}

/** Topshiruvchi: aktiv o'quvchi bo'ldimi + qaysi guruh(lar)ga qo'shilgan va o'qituvchisi (FISH).
 * isDeleted — lid o'chirilgan yoki o'quvchi o'chirilgan/arxivlangan. */
export interface LevelTestStatRow {
  submissionId: string
  fullName: string
  phone: string
  level: string
  percent: number
  createdAt: string
  leadId: string
  studentId: string | null
  active: boolean
  groupName: string
  teacherName: string
  isDeleted: boolean
}
export interface LevelTestStats {
  total: number
  active: number
  rows: LevelTestStatRow[]
}
export async function getLevelTestStats(id: string): Promise<LevelTestStats> {
  const { data } = await api.get<LevelTestStats>(`/admin/level-tests/${id}/stats`)
  return data
}

/** Bu testga yuborilgan bir martalik havolalar (lid + SMS holati + ishlangani). */
export interface LevelTestInvite {
  id: string
  testId: string
  leadId: string
  leadName: string
  phone: string
  smsStatus: string
  createdAt: string
  used: boolean
  usedAt: string
  percent: number
  level: string
}
export async function getLevelTestInvites(id: string): Promise<LevelTestInvite[]> {
  const { data } = await api.get<LevelTestInvite[]>(`/admin/level-tests/${id}/invites`)
  return data
}

/** Barcha daraja testlari bo'yicha umumiy statistika. */
export interface LevelCount { level: string; count: number }
export interface TestStatRow {
  testId: string
  title: string
  submissions: number
  invites: number
  invitesUsed: number
  avgPercent: number
}
/** Umumiy statistikadagi bitta topshiruvchi — qaysi testga tegishli + natija + hozir aktivmi. */
export interface LevelTestOverallRow {
  submissionId: string
  testId: string
  testTitle: string
  fullName: string
  phone: string
  level: string
  percent: number
  createdAt: string
  leadId: string
  studentId: string | null
  active: boolean
  groupName: string
  teacherName: string
  isDeleted: boolean
}
export interface LevelTestOverallStats {
  testCount: number
  submissions: number
  invites: number
  invitesUsed: number
  avgPercent: number
  active: number
  byLevel: LevelCount[]
  byTest: TestStatRow[]
  rows: LevelTestOverallRow[]
}
export async function getLevelTestOverallStats(): Promise<LevelTestOverallStats> {
  const { data } = await api.get<LevelTestOverallStats>('/admin/level-tests/overall-stats')
  return data
}

/** Lidga daraja testi havolasini SMS qilib yuborish (bir martalik). */
export async function sendLeadTest(leadId: string, testId: string): Promise<{ ok: boolean; status: string; link: string }> {
  const { data } = await api.post<{ ok: boolean; status: string; link: string }>(
    `/admin/leads/${leadId}/send-test`,
    { testId },
  )
  return data
}
