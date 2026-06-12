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
