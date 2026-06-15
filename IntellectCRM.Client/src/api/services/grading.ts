import { api } from '../client'

/** Baholash mezonlari (kriteriya) — guruhga biriktiriladi, guruh ichida o'quvchilar baholanadi. */

export interface GradingCriterion {
  id: string
  name: string
  description: string
  maxScore: number
  order: number
}
export interface GradingBoardCriterion {
  id: string
  name: string
  maxScore: number
  order: number
}
export interface GradingBoardStudent {
  studentId: string
  fullName: string
  /** mezon id → baho */
  scores: Record<string, number>
}
export interface GradingBoard {
  groupId: string
  groupName: string
  criteria: GradingBoardCriterion[]
  students: GradingBoardStudent[]
}
export interface SetGrade {
  groupId: string
  studentId: string
  criterionId: string
  score: number
}

// ---- Mezonlar (pul) ----
export async function getCriteria(): Promise<GradingCriterion[]> {
  const { data } = await api.get<GradingCriterion[]>('/admin/grading/criteria')
  return data
}
export async function createCriterion(name: string, description: string, maxScore: number): Promise<GradingCriterion> {
  const { data } = await api.post<GradingCriterion>('/admin/grading/criteria', { name, description, maxScore })
  return data
}
export async function updateCriterion(id: string, name: string, description: string, maxScore: number): Promise<void> {
  await api.put(`/admin/grading/criteria/${id}`, { name, description, maxScore })
}
export async function deleteCriterion(id: string): Promise<void> {
  await api.delete(`/admin/grading/criteria/${id}`)
}

// ---- Guruhga biriktirish ----
export async function getGroupCriteria(groupId: string): Promise<string[]> {
  const { data } = await api.get<string[]>(`/admin/grading/group/${groupId}/criteria`)
  return data
}
export async function setGroupCriteria(groupId: string, criterionIds: string[]): Promise<void> {
  await api.put(`/admin/grading/group/${groupId}/criteria`, { criterionIds })
}

// ---- Baholash grid'i (admin) ----
export async function getGradingBoard(groupId: string): Promise<GradingBoard> {
  const { data } = await api.get<GradingBoard>(`/admin/grading/group/${groupId}/board`)
  return data
}
export async function setGrade(req: SetGrade): Promise<void> {
  await api.post('/admin/grading/grade', req)
}
