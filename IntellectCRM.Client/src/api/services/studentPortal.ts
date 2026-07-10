import { api } from '../client'

/* ============================================================
   O'quvchi portali API — /api/student/*
   Rol: student (to'liq) / parent (o'qish + ba'zi amallar) / admin (?studentId= bilan o'qish).
   JSON camelCase. Quarter opaque (=1).
   ============================================================ */

// ---------- Tiplar ----------
export interface StudentProfile {
  id: string
  fullName: string
  className: string
  birthDate: string
  gender: string
  parentFullName: string
  parentPhone: string
  enrollmentDate: string
  photoUrl?: string
  parentPhotoUrl?: string
}

export interface LessonTime { period: number; startTime: string; endTime: string }
export interface AbsenceReasonMeta { id: string; name: string; short: string; isLate: boolean }
export interface PortalMeta {
  lessonTimes: LessonTime[]
  absenceReasons: AbsenceReasonMeta[]
  currentQuarter: number
  currentWeek: number
}

export interface HomeworkItem {
  date: string
  period: number
  subjectId: string
  subjectName: string
  topic: string
  homework?: string
  conducted: boolean
  grade?: number | null
  reasonId?: string | null
  reasonName?: string | null
  isLate: boolean
}
export interface StudentLesson {
  day: number
  period: number
  startTime?: string
  endTime?: string
  subjectId: string
  subjectName: string
  teacherId: string
  teacherName: string
}
export interface StudentDashboard {
  profile: StudentProfile
  meta: PortalMeta
  todayLessons: StudentLesson[]
  todayGrades: HomeworkItem[]
  pendingAssignmentsCount: number
  balance: number
  monthlyFee: number
}

export interface SubjectRef { id: string; name: string }
export interface StudentAttendanceSummary {
  missedDays: Record<number, number>
  illnessDays: Record<number, number>
  missedLessons: Record<number, number>
  illnessLessons: Record<number, number>
  lateCount: Record<number, number>
}
export interface StudentGradesReport {
  studentId: string
  fullName: string
  className: string
  homeroomTeacher: string
  subjects: SubjectRef[]
  grades: Record<string, Record<number, number>>
  attendance: StudentAttendanceSummary
}

export interface AbsenceRow {
  date: string
  period: number
  subjectId: string
  subjectName: string
  reasonId: string
  reasonName: string
  isLate: boolean
  isIll: boolean
}
export interface StudentAttendanceFull {
  summary: StudentAttendanceSummary
  rows: AbsenceRow[]
}

export interface DisciplinePoint {
  id: string
  reasonName: string
  points: number
  note: string
  createdAt: string
  createdBy: string
  source: string
}
export interface StudentDiscipline { remaining: number; plus: number; minus: number; items: DisciplinePoint[] }

export interface RatingRow {
  rank: number
  studentId: string
  fullName: string
  className: string
  average: number
  attendance?: number | null
}
export interface StudentRating {
  meStudentId: string
  classRows: RatingRow[]
  schoolRows: RatingRow[]
  meSchoolRank?: number | null
  schoolSize: number
}

export interface SubjectProgress {
  subjectId: string
  subjectName: string
  planned: number
  conducted: number
  remaining: number
  percent: number
  expectedByToday?: number
  nextLessonDate?: string | null
  lastLessonDate?: string | null
}
export interface StudentSubjectsProgress {
  quarter: number
  totalPlanned: number
  totalConducted: number
  totalPercent: number
  subjects: SubjectProgress[]
}
export interface SubjectLesson { date: string; period: number; startTime?: string; endTime?: string; topic: string; homework?: string; conducted: boolean; isPast: boolean }
export interface SubjectProgressDetail {
  subjectId: string
  subjectName: string
  quarter: number
  planned: number
  conducted: number
  remaining: number
  percent: number
  lessons: SubjectLesson[]
}

export interface AssignmentMaterial { id?: string; name: string; url: string; size: number; contentType: string; audioUrl?: string | null }
export interface StudentAssignment {
  id: string
  subjectName: string
  title: string
  description: string
  format: 'written' | 'file' | 'test' | 'video' | 'speaking'
  startDate?: string | null
  dueDate?: string | null
  lateAccept: boolean
  latePenaltyPct: number
  maxScore: number
  questionCount: number
  materials: AssignmentMaterial[]
  completed: boolean
  submittedAt?: string | null
  score?: number | null
  /** Speaking topshirig'i uchun o'qiladigan matn */
  referenceText?: string
}

// ---------- Speaking (Azure talaffuz bahosi) ----------
export interface SpeakingWord { word: string; accuracy: number; errorType: string }
export interface SpeakingResult {
  recognizedText: string
  pronScore: number
  accuracy: number
  fluency: number
  completeness: number
  prosody: number
  words: SpeakingWord[]
  error: string | null
}
/** Audio (WAV) yuborib, Azure talaffuz bahosini olish (natija saqlanadi). */
export async function submitSpeaking(assignmentId: string, audio: Blob): Promise<SpeakingResult> {
  const fd = new FormData()
  fd.append('audio', audio, 'speaking.wav')
  const { data } = await api.post<SpeakingResult>(`/student/assignments/${assignmentId}/speaking`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}
/** Oldingi speaking natijasi (bor bo'lsa) — 204 bo'lsa null. */
export async function getSpeaking(assignmentId: string, studentId?: string): Promise<SpeakingResult | null> {
  const { data } = await api.get<SpeakingResult>(`/student/assignments/${assignmentId}/speaking`, { params: sid(studentId) })
  return data || null
}
export interface TestQuestion { id: string; text: string; options: string[] }
export interface StudentAssignmentDetail extends Omit<StudentAssignment, 'questionCount'> {
  questions: TestQuestion[]
  answerText?: string | null
  fileUrl?: string | null
}
export interface AssignmentScoreItem {
  assignmentId: string
  subjectName: string
  title: string
  format: string
  maxScore: number
  score?: number | null
  completed: boolean
  dueDate?: string | null
  submittedAt?: string | null
}
export interface StudentAssignmentScores {
  count: number
  gradedCount: number
  totalScore: number
  totalMax: number
  items: AssignmentScoreItem[]
}
export interface TestAnswer { questionId: string; selectedIndex: number }
export interface SubmitResult { completed: boolean; score?: number | null; correctCount?: number | null; total?: number | null }
export interface UploadedFile { name: string; url: string; size: number; contentType: string }

export interface MonthCourse { courseName: string; fee: number }
export interface MonthLedger { month: string; charged: number; discount: number; paid: number; remaining: number; status: string; courses: MonthCourse[] }
export interface StudentPayment { date: string; amount: number; note?: string | null; month?: string | null; comment?: string | null }
export interface StudentFinance {
  student: { id: string; fullName: string; className: string }
  balance: number
  monthlyFee: number
  totalCharged: number
  totalDiscount: number
  totalPaid: number
  months: MonthLedger[]
  payments: StudentPayment[]
}

export interface StudentChatMessage { id: string; className: string; senderUserId: string; senderName: string; senderRole: string; text: string; createdAt: string }
export interface UserSettings { language: string; theme: string; notificationsEnabled: boolean }
export interface TelegramStatus { configured: boolean; botUsername: string; botName: string; deepLink: string; registered: boolean }

// ---------- Profil / auth / meta ----------
const sid = (studentId?: string) => (studentId ? { studentId } : {})

export async function getStudentMe(studentId?: string) {
  const { data } = await api.get<StudentProfile>('/student/me', { params: sid(studentId) })
  return data
}
export async function getStudentSettings(studentId?: string) {
  const { data } = await api.get<UserSettings>('/student/settings', { params: sid(studentId) })
  return data
}
export async function saveStudentSettings(body: Partial<UserSettings>) {
  const { data } = await api.put<UserSettings>('/student/settings', body)
  return data
}
export async function changeStudentPassword(currentPassword: string, newPassword: string) {
  await api.put('/student/password', { currentPassword, newPassword })
}
export async function getStudentMeta() {
  const { data } = await api.get<PortalMeta>('/student/meta')
  return data
}
export async function getStudentSchool() {
  const { data } = await api.get<{ name: string; telegramChannel: string }>('/student/school')
  return data
}

// ---------- Uy joylashuvi ----------
export interface StudentLocation {
  latitude: number | null
  longitude: number | null
  address: string | null
  updatedAt: string | null
}
/** Saqlangan uy joylashuvini o'qish (hali yo'q bo'lsa null'lar). */
export async function getStudentLocation(studentId?: string) {
  const { data } = await api.get<StudentLocation>('/student/location', { params: sid(studentId) })
  return data
}
/** Uy joylashuvini yangilash (GPS yoki xaritadan tanlangan nuqta). */
export async function updateStudentLocation(latitude: number, longitude: number, address?: string) {
  await api.put('/student/location', { latitude, longitude, address: address ?? '' })
}
export async function getStudentTelegram(studentId?: string) {
  const { data } = await api.get<TelegramStatus>('/student/telegram', { params: sid(studentId) })
  return data
}

// ---------- O'quv dasturi (curriculum roadmap) ----------
export interface CurriculumItem {
  id: string
  text: string
  note: string
  order: number
  covered: boolean
  coveredDate: string
}
export interface CurriculumTopic {
  id: string
  title: string
  note: string
  order: number
  items: CurriculumItem[]
}
export interface CurriculumLevel {
  id: string
  name: string
  note: string
  order: number
  topics: CurriculumTopic[]
}
export interface StudentCurriculum {
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
  estFinishDate: string
  levels: CurriculumLevel[]
}

/** O'quvchining har faol guruh kursi bo'yicha o'quv dasturi (o'tilgan/qolgan + prognoz). */
export async function getStudentCurriculum(studentId?: string) {
  const { data } = await api.get<StudentCurriculum[]>('/student/curriculum', { params: sid(studentId) })
  return data
}

// ---------- Baholash statistikasi (oylik + har darslik) ----------
export interface StudentGradingCriterion { id: string; name: string; done: number; total: number }
export interface StudentGradingDate { date: string; doneCriterionIds: string[] }
export interface StudentGradingGroup {
  groupId: string
  groupName: string
  months: string[]
  month: string
  dates: string[]
  criteria: StudentGradingCriterion[]
  lessons: StudentGradingDate[]
  /** Shu oyda yig'ilgan ball (bajarilgan mezonlar soni) */
  monthBall?: number
  /** Shu guruhda barcha vaqt bo'yicha yig'ilgan jami ball */
  totalBall?: number
}
export async function getStudentGrading(month?: string, studentId?: string) {
  const { data } = await api.get<StudentGradingGroup[]>('/student/grading', {
    params: { ...sid(studentId), ...(month ? { month } : {}) },
  })
  return data
}

// ---------- Dars kontenti (Duolingo node bosilganda) ----------
export type LessonType = 'text' | 'video' | 'audio' | 'vocab' | 'test' | 'pdf'
export interface LessonVocab { term: string; meaning: string }
export interface LessonQuestion { id: string; text: string; options: string[]; correctIndex: number }
export interface LessonContent {
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
  vocab: LessonVocab[]
  questions: LessonQuestion[]
}
/** Bitta darsning to'liq kontenti (video/matn/audio/lug'at/test). */
export async function getStudentLesson(itemId: string, studentId?: string) {
  const { data } = await api.get<LessonContent>(`/student/curriculum/item/${itemId}`, { params: sid(studentId) })
  return data
}

/** Kurs o'quv dasturi o'tilgan bandlar (itemId'lar). */
export async function getStudentCourseProgress(courseId: string, studentId?: string): Promise<string[]> {
  const { data } = await api.get<string[]>(`/student/curriculum/${courseId}/progress`, { params: sid(studentId) })
  return data || []
}

/** Bandni bajarilgan/bajarilmagan deb belgilash. */
export async function setStudentCourseProgress(itemId: string, done: boolean, studentId?: string): Promise<void> {
  await api.post('/student/curriculum/progress', { itemId, done }, { params: sid(studentId) })
}

// ---------- Dashboard ----------
export async function getStudentDashboard(studentId?: string) {
  const { data } = await api.get<StudentDashboard>('/student/dashboard', { params: sid(studentId) })
  return data
}

// ---------- Academic ----------
export async function getStudentGrades(studentId?: string) {
  const { data } = await api.get<StudentGradesReport>('/student/grades', { params: sid(studentId) })
  return data
}
export interface AttendanceReasonCount { reasonId: string; name: string; short: string; isLate: boolean; count: number }
export interface MonthlyAttendance {
  missedDays: Record<string, number>
  illnessDays: Record<string, number>
  missedLessons: Record<string, number>
  illnessLessons: Record<string, number>
  lateCount: Record<string, number>
}
export interface MonthlyEvaluation { month: string; grades: Record<string, number>; avg: number }
export interface SubjectEvaluation { subjectId: string; subjectName: string; avg: number; evaluations: MonthlyEvaluation[] }
export interface MonthMarks { month: string; homeworkDone: number; homeworkMissed: number; behaviorGood: number; behaviorBad: number }
export interface NotebookAssignmentScore { assignmentId: string; subjectName: string; title: string; format: string; maxScore: number; score?: number | null; completed: boolean }
export interface NotebookAssignments { count: number; gradedCount: number; totalScore: number; totalMax: number; items: NotebookAssignmentScore[] }
export interface NotebookDisciplinePoint { id: string; reasonName: string; points: number; note: string; createdAt: string; source: string }
export interface StudentNotebook {
  id: string
  fullName: string
  className: string
  balance: number
  avgGrade: number
  subjects: SubjectRef[]
  /** fan nomi → oy ("yyyy-MM") → o'rtacha baho */
  grades: Record<string, Record<string, number>>
  attendance: MonthlyAttendance
  conducted: number
  attended: number
  attendancePct: number
  reasons: AttendanceReasonCount[]
  disciplineScore: number
  disciplinePlus: number
  disciplineMinus: number
  disciplinePoints: NotebookDisciplinePoint[]
  assignments: NotebookAssignments
  evaluationTypes: { id: string; name: string }[]
  evaluations: MonthlyEvaluation[]
  evaluationsBySubject: SubjectEvaluation[]
  homeworkDone: number
  homeworkMissed: number
  behaviorGood: number
  behaviorBad: number
  marksTrend: MonthMarks[]
}

export async function getStudentNotebook(studentId?: string) {
  const { data } = await api.get<StudentNotebook>('/student/notebook', { params: sid(studentId) })
  return data
}
export async function getStudentAttendance(quarter = 1, studentId?: string) {
  const { data } = await api.get<StudentAttendanceFull>('/student/attendance', { params: { quarter, ...sid(studentId) } })
  return data
}
export async function getStudentDiscipline(studentId?: string) {
  const { data } = await api.get<StudentDiscipline>('/student/discipline', { params: sid(studentId) })
  return data
}
export async function getStudentRating(studentId?: string) {
  const { data } = await api.get<StudentRating>('/student/rating', { params: sid(studentId) })
  return data
}
export async function getStudentSubjectsProgress(quarter = 1, studentId?: string) {
  const { data } = await api.get<StudentSubjectsProgress>('/student/subjects-progress', { params: { quarter, ...sid(studentId) } })
  return data
}
export async function getStudentSubjectProgressDetail(subjectId: string, quarter = 1, studentId?: string) {
  const { data } = await api.get<SubjectProgressDetail>(`/student/subjects-progress/${subjectId}`, { params: { quarter, ...sid(studentId) } })
  return data
}

// ---------- Assignments ----------
export async function getStudentAssignments(studentId?: string) {
  const { data } = await api.get<StudentAssignment[]>('/student/assignments', { params: sid(studentId) })
  return data
}
export async function getStudentAssignment(id: string, studentId?: string) {
  const { data } = await api.get<StudentAssignmentDetail>(`/student/assignments/${id}`, { params: sid(studentId) })
  return data
}
export async function getStudentAssignmentScores(studentId?: string) {
  const { data } = await api.get<StudentAssignmentScores>('/student/assignment-scores', { params: sid(studentId) })
  return data
}
export async function submitStudentAssignment(
  id: string,
  body: { answers?: TestAnswer[]; answerText?: string; fileUrl?: string },
) {
  const { data } = await api.post<SubmitResult>(`/student/assignments/${id}/submit`, body)
  return data
}
export async function uploadStudentFile(file: File, onProgress?: (pct: number) => void) {
  const fd = new FormData()
  fd.append('file', file)
  const { data } = await api.post<UploadedFile>('/student/uploads', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100))
    },
  })
  return data
}

// ---------- Finance ----------
export async function getStudentFinance(studentId?: string) {
  const { data } = await api.get<StudentFinance>('/student/finance', { params: sid(studentId) })
  return data
}

// ---------- Chat ----------
export async function getStudentChat(since?: string, studentId?: string) {
  const { data } = await api.get<StudentChatMessage[]>('/student/chat', { params: { since, ...sid(studentId) } })
  return data
}
export async function sendStudentChat(text: string) {
  const { data } = await api.post<StudentChatMessage>('/student/chat', { text })
  return data
}

// ---------- Bildirishnomalar (ilova tarixi) ----------
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

export async function getStudentNotifications(): Promise<NotificationsResponse> {
  const { data } = await api.get<NotificationsResponse>('/student/notifications')
  return data
}
export async function markStudentNotificationsRead(): Promise<void> {
  await api.post('/student/notifications/read')
}
export async function confirmStudentNotification(id: string): Promise<void> {
  await api.post(`/student/notifications/${id}/confirm`)
}

// ---------- Feedback ----------
export async function sendStudentFeedback(type: 'suggestion' | 'complaint', text: string, image?: File | null) {
  const fd = new FormData()
  fd.append('type', type)
  fd.append('text', text)
  if (image) fd.append('image', image)
  await api.post('/student/feedback', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
}

// ---------- Sertifikatlar ----------
export interface StudentCertificateDto {
  id: string
  courseName: string
  issuedAt: string
  expiresAt?: string | null
  status: string
  fileName: string
  downloadUrl: string
  downloadCount: number
  metadata?: Record<string, string> | null
}

export async function getStudentCertificates(): Promise<StudentCertificateDto[]> {
  const { data } = await api.get<StudentCertificateDto[]>('/student/certificates')
  return data
}
