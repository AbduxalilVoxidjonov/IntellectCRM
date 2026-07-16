import { api } from '../client'
import type { Curriculum, LessonType } from '@/types'

/** Kurs o'quv dasturi (modul → mavzu → dars) + dars kontenti + o'quvchi progressi. */

// ---- Dars kontenti (video/matn/audio/lug'at/test) ----
export interface VocabEntry {
  term: string
  meaning: string
}
export interface CourseQuestion {
  id: string
  text: string
  options: string[]
  correctIndex: number
}
export interface CourseItemDetail {
  id: string
  topicId: string
  text: string
  note: string
  order: number
  type: LessonType
  videoUrl: string
  audioUrl: string
  textContent: string
  pdfUrl: string
  pdfName: string
  meta: string
  vocab: VocabEntry[]
  questions: CourseQuestion[]
}
export interface SaveItemContent {
  text: string
  type: LessonType
  videoUrl?: string
  audioUrl?: string
  textContent?: string
  pdfUrl?: string
  pdfName?: string
  meta?: string
  vocab?: VocabEntry[]
  questions?: CourseQuestion[]
}

/** Bitta darsning to'liq kontentini o'qish (tahrirlovchi/ko'rish uchun). */
export async function getCourseItem(id: string): Promise<CourseItemDetail> {
  const { data } = await api.get<CourseItemDetail>(`/admin/curriculum/item/${id}`)
  return data
}
/** Dars kontentini saqlash (nom + tur + kontent + lug'at + test savollari). */
export async function saveItemContent(id: string, payload: SaveItemContent): Promise<void> {
  await api.put(`/admin/curriculum/items/${id}/content`, payload)
}

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
/** Yangi band (dars) yaratish — `type` FAQAT shu yerda beriladi, keyin o'zgarmaydi (bitta band = bitta tur). */
export async function createItem(
  topicId: string, text: string, note = '', type?: LessonType,
): Promise<{ id: string }> {
  const { data } = await api.post<{ id: string }>(`/admin/curriculum/topics/${topicId}/items`, { text, note, type })
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

// ---- Guruh o'quv dasturi (darsda o'tilgan bandlar + tugatish prognozi) ----

export interface GroupCurriculumItem {
  id: string
  text: string
  note: string
  order: number
  covered: boolean
  coveredDate: string
}
export interface GroupCurriculumTopic {
  id: string
  title: string
  note: string
  order: number
  items: GroupCurriculumItem[]
}
export interface GroupCurriculumLevel {
  id: string
  name: string
  note: string
  order: number
  topics: GroupCurriculumTopic[]
}
export interface GroupCurriculum {
  groupId: string
  courseId: string
  courseName: string
  totalItems: number
  coveredCount: number
  revisionLessons: number
  totalLessons: number
  remainingItems: number
  estLessonsLeft: number
  lessonsPerWeek: number
  /** ISO sana yoki null — taxminiy tugash sanasi */
  estFinishDate: string | null
  levels: GroupCurriculumLevel[]
}

export async function getGroupCurriculum(groupId: string): Promise<GroupCurriculum> {
  const { data } = await api.get<GroupCurriculum>(`/admin/curriculum/group/${groupId}`)
  return data
}

export async function setGroupCover(groupId: string, itemId: string, covered: boolean): Promise<void> {
  await api.post(`/admin/curriculum/group/${groupId}/cover`, { itemId, covered })
}

export async function changeGroupRevision(groupId: string, delta: number): Promise<{ revisionLessons: number }> {
  const { data } = await api.post<{ ok: boolean; revisionLessons: number }>(
    `/admin/curriculum/group/${groupId}/revision`,
    { delta },
  )
  return { revisionLessons: data.revisionLessons }
}

// ---- O'quvchi darslar tarixi (o'tilgan mavzular jadvali, eng yangisi birinchi) ----

export interface CoverageLogEntry {
  date: string
  courseName: string
  groupName: string
  levelName: string
  topicTitle: string
  itemText: string
  isRevision: boolean
}

export async function getStudentCoverageLog(studentId: string): Promise<CoverageLogEntry[]> {
  const { data } = await api.get<CoverageLogEntry[]>(`/admin/curriculum/student/${studentId}/coverage-log`)
  return data
}

// ---- Excel import (shablon + fayl) ----

/** Excel importi natijasi: yaratilgan modul/mavzu/dars soni + xato qatorlar. */
export interface CurriculumExcelImportResult {
  levels: number
  topics: number
  items: number
  skipped: number
  errors: { row: number; message: string }[]
}

/** O'quv dasturini ommaviy kiritish uchun Excel shablonini yuklab oladi (.xlsx). */
export async function downloadCurriculumImportTemplate(): Promise<void> {
  const res = await api.get('/admin/curriculum/import-template', { responseType: 'blob' })
  const url = URL.createObjectURL(res.data as Blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'oquv_dasturi_shablon.xlsx'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** To'ldirilgan Excel (.xlsx) shablonidan o'quv dasturini yuklaydi.
 *  replace=true — mavjud dastur o'chirilib almashtiriladi; aks holda qo'shiladi. */
export async function importCurriculumExcel(
  subjectId: string,
  file: File,
  replace: boolean,
): Promise<CurriculumExcelImportResult> {
  const fd = new FormData()
  fd.append('file', file)
  const { data } = await api.post<CurriculumExcelImportResult>(
    `/admin/curriculum/${subjectId}/import-excel?replace=${replace}`,
    fd,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return data
}

// ---- Daraja nusxalash (boshqa kursga) ----

export interface CopyLevelResult {
  levelId: string
  levelName: string
  topicCount: number
  itemCount: number
}

export async function copyLevelToSubject(levelId: string, targetSubjectId: string): Promise<CopyLevelResult> {
  const { data } = await api.post<CopyLevelResult>(
    `/admin/curriculum/levels/${levelId}/copy-to/${targetSubjectId}`,
    {},
  )
  return data
}
