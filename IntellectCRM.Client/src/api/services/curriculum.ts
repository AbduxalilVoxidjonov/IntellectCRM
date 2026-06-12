import { api } from '../client'
import type { Curriculum } from '@/types'

/** Kurs o'quv dasturi (daraja → mavzu → band) + o'quvchi progressi. */

export async function getCurriculum(subjectId: string): Promise<Curriculum> {
  const { data } = await api.get<Curriculum>(`/admin/curriculum/${subjectId}`)
  return data
}

// ---- Daraja ----
export async function createLevel(subjectId: string, name: string, note = ''): Promise<{ id: string }> {
  const { data } = await api.post<{ id: string }>(`/admin/curriculum/${subjectId}/levels`, { name, note })
  return data
}
export async function updateLevel(id: string, name: string, note = ''): Promise<void> {
  await api.put(`/admin/curriculum/levels/${id}`, { name, note })
}
export async function deleteLevel(id: string): Promise<void> {
  await api.delete(`/admin/curriculum/levels/${id}`)
}

// ---- Mavzu ----
export async function createTopic(levelId: string, title: string, note = ''): Promise<{ id: string }> {
  const { data } = await api.post<{ id: string }>(`/admin/curriculum/levels/${levelId}/topics`, { title, note })
  return data
}
export async function updateTopic(id: string, title: string, note = ''): Promise<void> {
  await api.put(`/admin/curriculum/topics/${id}`, { title, note })
}
export async function deleteTopic(id: string): Promise<void> {
  await api.delete(`/admin/curriculum/topics/${id}`)
}

// ---- Band ----
export async function createItem(topicId: string, text: string, note = ''): Promise<{ id: string }> {
  const { data } = await api.post<{ id: string }>(`/admin/curriculum/topics/${topicId}/items`, { text, note })
  return data
}
export async function updateItem(id: string, text: string, note = ''): Promise<void> {
  await api.put(`/admin/curriculum/items/${id}`, { text, note })
}
export async function deleteItem(id: string): Promise<void> {
  await api.delete(`/admin/curriculum/items/${id}`)
}

// ---- O'quvchi progressi (bajarilgan band id'lari) ----
export async function getProgress(subjectId: string, studentId: string): Promise<string[]> {
  const { data } = await api.get<string[]>(`/admin/curriculum/${subjectId}/progress/${studentId}`)
  return data
}
export async function setProgress(studentId: string, itemId: string, done: boolean): Promise<void> {
  await api.post(`/admin/curriculum/progress`, { studentId, itemId, done })
}
