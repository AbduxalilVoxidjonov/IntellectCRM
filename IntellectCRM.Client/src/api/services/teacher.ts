import type {
  Assignment,
  AssignmentResult,
  AssignmentType,
  ChatMessage,
  PortalMeta,
  SalaryLedger,
  Subject,
  TeacherClass,
  EvaluationBoard,
  EvaluationType,
  TeacherRating,
} from '@/types'
import { api, USE_MOCK } from '../client'
import type { MaterialInput, SaveAssignmentInput } from './assignments'
import type { GroupJournal } from './journal'
import type { GroupCurriculum } from './curriculum'
import type { GradingBoard, SetGrade, BulkGrade } from './grading'

/** O'qituvchi profili (panel sarlavhasi/salom uchun) */
export interface TeacherProfile {
  id: string
  fullName: string
  email: string
  homeroomClass: string
  subjects: Subject[]
  /** Support o'qituvchimi (bo'sh vaqt/bron bo'limi ko'rinadimi). */
  isSupport?: boolean
}

export async function getTeacherProfile(): Promise<TeacherProfile | null> {
  if (USE_MOCK) return null
  const { data } = await api.get<TeacherProfile>('/teacher/me')
  return data
}

/** O'qituvchi dars beradigan guruhlar (har biri o'qitadigan fanlari bilan) */
export async function getMyClasses(): Promise<TeacherClass[]> {
  if (USE_MOCK) return []
  const { data } = await api.get<TeacherClass[]>('/teacher/classes')
  return data
}

/* ---------- O'quvchilarni baholash (o'z fanidan) ---------- */

export async function getTeacherEvalTypes(): Promise<EvaluationType[]> {
  if (USE_MOCK) return []
  const { data } = await api.get<EvaluationType[]>('/teacher/evaluation/types')
  return data
}

/** O'qituvchining shu guruh+fan bo'yicha baholash jadvali (tanlangan oy). */
export async function getTeacherEvalBoard(
  classId: string,
  subjectId: string,
  month?: string,
): Promise<EvaluationBoard> {
  if (USE_MOCK)
    return { months: [], month: '', week: 0, types: [], rows: [], subjectId, subjects: [] }
  const { data } = await api.get<EvaluationBoard>('/teacher/evaluation/board', {
    params: { classId, subjectId, month },
  })
  return data
}

/** O'z fanidan bitta o'quvchiga bitta tur bo'yicha bir oyda baho qo'yish (1-5). score=null = tozalash. */
export async function setTeacherEvalGrade(
  classId: string,
  subjectId: string,
  studentId: string,
  typeId: string,
  month: string,
  score: number | null,
): Promise<void> {
  await api.post('/teacher/evaluation/grade', {
    classId, subjectId, studentId, typeId, month, week: 0, score,
  })
}

/** O'qituvchining o'zi yaratgan topshiriqlari */
export async function getTeacherAssignments(): Promise<Assignment[]> {
  if (USE_MOCK) return []
  const { data } = await api.get<Assignment[]>('/teacher/assignments')
  return data
}

export async function createTeacherAssignment(input: SaveAssignmentInput): Promise<Assignment> {
  const { data } = await api.post<Assignment>('/teacher/assignments', input)
  return data
}

export async function updateTeacherAssignment(id: string, input: SaveAssignmentInput): Promise<void> {
  await api.put(`/teacher/assignments/${id}`, input)
}

export async function deleteTeacherAssignment(id: string): Promise<void> {
  await api.delete(`/teacher/assignments/${id}`)
}

/** Topshiriq natijalari — kim bajardi/bajarmadi */
export async function getTeacherAssignmentResults(id: string): Promise<AssignmentResult> {
  const { data } = await api.get<AssignmentResult>(`/teacher/assignments/${id}/results`)
  return data
}

/** O'quvchining bajarish holatini belgilash */
export async function setTeacherSubmission(
  id: string,
  studentId: string,
  completed: boolean,
  score?: number | null,
): Promise<void> {
  await api.put(`/teacher/assignments/${id}/submissions/${studentId}`, {
    completed,
    score: score ?? null,
  })
}

/** Topshiriq materiali sifatida fayl yuklash; yuklangan fayl metadatasini qaytaradi */
export async function uploadTeacherFile(file: File): Promise<MaterialInput> {
  const fd = new FormData()
  fd.append('file', file)
  const { data } = await api.post<MaterialInput>('/teacher/uploads', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function getTeacherAssignmentTypes(): Promise<AssignmentType[]> {
  if (USE_MOCK) return []
  const { data } = await api.get<AssignmentType[]>('/teacher/assignment-types')
  return data
}

/* ---------- Meta (choraklar, dars vaqtlari, davomat sabablari) ---------- */

export async function getTeacherMeta(): Promise<PortalMeta | null> {
  if (USE_MOCK) return null
  const { data } = await api.get<PortalMeta>('/teacher/meta')
  return data
}

/** Markaz nomi + Telegram kanali (o'qituvchi ilovasi uchun). */
export async function getTeacherSchool(): Promise<{ name: string; telegramChannel: string }> {
  if (USE_MOCK) return { name: '', telegramChannel: '' }
  const { data } = await api.get<{ name: string; telegramChannel: string }>('/teacher/school')
  return data
}

/* ---------- Bildirishnomalar (ilova tarixi) ---------- */
export interface AppNotification {
  id: string
  title: string
  body: string
  type: string
  createdAt: string
  read: boolean
  confirmed: boolean
}
export interface NotificationsResponse {
  unread: number
  items: AppNotification[]
}

export async function getTeacherNotifications(): Promise<NotificationsResponse> {
  if (USE_MOCK) return { unread: 0, items: [] }
  const { data } = await api.get<NotificationsResponse>('/teacher/notifications')
  return data
}
export async function markTeacherNotificationsRead(): Promise<void> {
  await api.post('/teacher/notifications/read')
}
export async function confirmTeacherNotification(id: string): Promise<void> {
  await api.post(`/teacher/notifications/${id}/confirm`)
}

/* ---------- Baholash mezonlari (o'z guruhi) ---------- */
export async function getTeacherGradingBoard(groupId: string, month?: string): Promise<GradingBoard> {
  const { data } = await api.get<GradingBoard>(`/teacher/grading/group/${groupId}/board`, {
    params: month ? { month } : {},
  })
  return data
}
export async function setTeacherGrade(req: SetGrade): Promise<void> {
  await api.post('/teacher/grading/grade', req)
}
export async function bulkTeacherGrade(req: BulkGrade): Promise<void> {
  await api.post('/teacher/grading/grade/bulk', req)
}

/* ---------- Taklif va shikoyat (o'qituvchi → admin) ---------- */
export async function sendTeacherFeedback(
  type: 'suggestion' | 'complaint',
  text: string,
  image?: File | null,
): Promise<void> {
  const fd = new FormData()
  fd.append('type', type)
  fd.append('text', text)
  if (image) fd.append('image', image)
  await api.post('/teacher/feedback', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
}

/* ---------- Maosh (faqat o'ziniki) ---------- */

export async function getTeacherSalary(from?: string, to?: string): Promise<SalaryLedger | null> {
  if (USE_MOCK) return null
  const { data } = await api.get<SalaryLedger>('/teacher/salary', {
    params: { from, to },
  })
  return data
}

/* ---------- Guruh OYLIK jurnali (o'qituvchi guruh sahifasi — admin bilan bir xil shakl) ---------- */

interface TeacherEntryPayload {
  grade?: number | null
  reasonId?: string | null
  homework?: number
  behavior?: number
  mastery?: number | null
}

/** Guruhning bitta oylik jurnali (ustunlar guruh dars kunlaridan, qatorlar faqat faol o'quvchilar). */
export async function getTeacherGroupJournal(classId: string, month?: string): Promise<GroupJournal> {
  if (USE_MOCK) {
    return {
      group: { id: classId, name: '', courseId: '', courseName: '', teacherName: '', days: [], startTime: '', endTime: '', room: '', startDate: '', monthlyFee: 0 },
      months: [], month: month ?? '', columns: [], students: [], entries: [], conductedDates: [],
    }
  }
  const { data } = await api.get<GroupJournal>('/teacher/journal/group', { params: { classId, month } })
  return data
}

/** Bitta katakni belgilash (baho/davomat/uy vazifa/xulq/o'zlashtirish). subjectId = guruh kursi. */
export async function setTeacherJournalEntry(
  classId: string,
  courseId: string,
  studentId: string,
  date: string,
  payload: TeacherEntryPayload,
): Promise<void> {
  await api.put('/teacher/journal', {
    classId, subjectId: courseId, quarter: 1, studentId, date, period: 1, ...payload,
  })
}

/** Bitta katakni tozalash. */
export async function clearTeacherJournalEntry(
  classId: string,
  courseId: string,
  studentId: string,
  date: string,
): Promise<void> {
  await api.delete('/teacher/journal', {
    params: { classId, subjectId: courseId, quarter: 1, studentId, date, period: 1 },
  })
}

/** Bitta dars (sana) uchun BARCHA faol o'quvchiga birdan davomat. absent=false → keldi; true → kelmadi.
 * Backend `BulkAttendanceRequest` subjectId/period/studentIds'ni ham talab qiladi (bo'lmasa 400 qaytadi). */
export async function bulkTeacherAttendance(
  classId: string,
  subjectId: string,
  period: number,
  studentIds: string[],
  date: string,
  absent: boolean,
  reasonId?: string | null,
): Promise<void> {
  await api.post('/teacher/journal/bulk-attendance', {
    classId, subjectId, period, studentIds, date, absent, reasonId: reasonId ?? null,
  })
}

/* ---------- Guruh o'quv dasturi (darsda o'tilgan bandlar + tugatish prognozi) ---------- */

export async function getTeacherGroupCurriculum(groupId: string): Promise<GroupCurriculum> {
  const { data } = await api.get<GroupCurriculum>(`/teacher/curriculum/group/${groupId}`)
  return data
}

export async function setTeacherGroupCover(groupId: string, itemId: string, covered: boolean): Promise<void> {
  await api.post(`/teacher/curriculum/group/${groupId}/cover`, { itemId, covered })
}

export async function changeTeacherGroupRevision(groupId: string, delta: number): Promise<void> {
  await api.post(`/teacher/curriculum/group/${groupId}/revision`, { delta })
}

/* ---------- Guruh chati ---------- */

export async function getTeacherChatClasses(): Promise<string[]> {
  if (USE_MOCK) return []
  const { data } = await api.get<string[]>('/teacher/chat/classes')
  return data
}

export async function getTeacherChat(className: string, since?: string): Promise<ChatMessage[]> {
  if (USE_MOCK) return []
  const { data } = await api.get<ChatMessage[]>(`/teacher/chat/${encodeURIComponent(className)}`, {
    params: since ? { since } : undefined,
  })
  return data
}

export async function sendTeacherChat(className: string, text: string): Promise<ChatMessage> {
  const { data } = await api.post<ChatMessage>(`/teacher/chat/${encodeURIComponent(className)}`, { text })
  return data
}

/**
 * Har bir kanal uchun oxirgi xabar vaqti — o'qilmagan xabarlarni aniqlash uchun (unread-context).
 * Qaytadi: { [channelName]: ISO vaqt yoki null (xabari yo'q kanal) }
 */
export async function getTeacherLastMessages(): Promise<Record<string, string | null>> {
  if (USE_MOCK) return {}
  const { data } = await api.get<Record<string, string | null>>('/teacher/chat/last-messages')
  return data
}


/* ---------- O'quvchilar reytingi (o'z guruhlari, ball bo'yicha) ---------- */

/** Ball = jurnal baholari yig'indisi + bajarilgan baholash mezonlari (faqat o'z guruhlarida). */
export async function getMyStudentRating(): Promise<TeacherRating | null> {
  if (USE_MOCK) return null
  const { data } = await api.get<TeacherRating>('/teacher/rating')
  return data
}
