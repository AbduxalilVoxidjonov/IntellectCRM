import type { Credentials, MonthStatus, Student, StudentLedger } from '@/types'
import { delay, uid } from '@/lib/utils'
import { api, USE_MOCK } from '../client'
import { studentsMock } from '../mock/students'
import { classesMock } from '../mock/classes'
import { financeMock } from '../mock/finance'

/** Serverga yuklangan fayl haqida (admin uploads javobi). */
export interface UploadedFile {
  name: string
  url: string
  size: number
  contentType: string
}

/**
 * Barcha o'quvchilarni login/parol bilan Excel (.xlsx) ga yuklab oladi (faqat superadmin).
 * Parol faqat foydalanuvchi hali kirmagan bo'lsa to'ldiriladi (kirgach bo'sh).
 */
export async function downloadStudentCredentials(): Promise<void> {
  if (USE_MOCK) {
    alert('Eksport faqat real serverda ishlaydi (VITE_USE_MOCK=false).')
    return
  }
  const res = await api.get('/admin/students/export', { responseType: 'blob' })
  const url = URL.createObjectURL(res.data as Blob)
  const a = document.createElement('a')
  a.href = url
  const cd = (res.headers['content-disposition'] as string | undefined) ?? ''
  const m = cd.match(/filename="?([^"]+)"?/)
  a.download = m?.[1] ?? `oquvchilar_${new Date().toISOString().slice(0, 10)}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Excel'dan ommaviy import natijasi (bitta xato qator). */
export interface StudentImportRowError {
  row: number
  message: string
}

/** Excel'dan ommaviy import yakuniy hisoboti. */
export interface StudentImportResult {
  created: number
  failed: number
  skipped: number
  errors: StudentImportRowError[]
}

/** O'quvchilarni ommaviy kiritish uchun bo'sh Excel shablonini yuklab oladi (.xlsx). */
export async function downloadStudentImportTemplate(): Promise<void> {
  if (USE_MOCK) {
    alert('Shablon faqat real serverda ishlaydi (VITE_USE_MOCK=false).')
    return
  }
  const res = await api.get('/admin/students/import-template', { responseType: 'blob' })
  const url = URL.createObjectURL(res.data as Blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'oquvchilar_shablon.xlsx'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** To'ldirilgan Excel (.xlsx) shablonini yuklab, o'quvchilarni ommaviy yaratadi. */
export async function importStudents(file: File): Promise<StudentImportResult> {
  if (USE_MOCK) {
    await delay(300)
    return { created: 0, failed: 0, skipped: 0, errors: [] }
  }
  const fd = new FormData()
  fd.append('file', file)
  const { data } = await api.post<StudentImportResult>('/admin/students/import', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

/** Faylni serverga yuklash (rasm/PDF, ~20 MB). URL qaytaradi — uni keyin entity'da saqlash mumkin. */
export async function uploadAdminFile(file: File): Promise<UploadedFile> {
  if (USE_MOCK) {
    await delay(200)
    return { name: file.name, url: `/uploads/mock-${Date.now()}-${file.name}`, size: file.size, contentType: file.type }
  }
  const fd = new FormData()
  fd.append('file', file)
  const { data } = await api.post<UploadedFile>('/admin/uploads', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

/** Forma maydonlari (balans bu yerda emas — u to'lov orqali o'zgaradi).
 *  newPassword — ixtiyoriy: tahrirda kiritilsa o'quvchi akkaunti paroli almashtiriladi. */
export type StudentPayload = Omit<Student, 'id' | 'balance' | 'parentFullName' | 'parentPhone'> & {
  newPassword?: string
  /** Backend father/mother'dan o'zi hosil qiladi — forma yubormaydi (ixtiyoriy). */
  parentFullName?: string
  parentPhone?: string
}

export async function getStudents(): Promise<Student[]> {
  if (USE_MOCK) {
    await delay()
    return studentsMock
  }
  const { data } = await api.get<Student[]>('/admin/students')
  return data
}

/**
 * Global qidiruv (Ctrl+K) uchun o'quvchilarni FISH yoki telefon (o'z/ota/ona/ota-ona) bo'yicha
 * qidiradi — ARXIVLANGANLAR ham qaytadi (natijada `isArchived` bilan belgilanadi). Mavjud
 * `GET /admin/students?includeArchived=true` endpointidan foydalanadi (yangi backend shart emas);
 * filtrlash frontend'da. `limit` — qaytariladigan maksimal natija.
 */
export async function searchStudents(q: string, limit = 12): Promise<Student[]> {
  const term = q.trim().toLowerCase()
  if (!term) return []
  let all: Student[]
  if (USE_MOCK) {
    await delay(100)
    all = studentsMock
  } else {
    const { data } = await api.get<Student[]>('/admin/students', {
      params: { includeArchived: true },
    })
    all = data
  }
  // Telefonni faqat raqamlar bo'yicha solishtirish uchun normallashtiramiz (oxirgi raqamlar).
  const digits = term.replace(/\D/g, '')
  const matches = all.filter((s) => {
    if (s.fullName?.toLowerCase().includes(term)) return true
    if (digits.length >= 3) {
      const phones = [s.phone, s.fatherPhone, s.motherPhone, s.parentPhone]
      return phones.some((p) => p && p.replace(/\D/g, '').includes(digits))
    }
    return false
  })
  return matches.slice(0, limit)
}

/** Faqat arxivlangan o'quvchilar ro'yxati (alohida ko'rish uchun). */
export async function getArchivedStudents(): Promise<Student[]> {
  if (USE_MOCK) {
    await delay()
    return []
  }
  const { data } = await api.get<Student[]>('/admin/students/archived')
  return data
}

/** O'quvchini arxivga ko'chirish (sabab yoki reasonId bilan). Login bloklanadi. */
export async function archiveStudent(id: string, reason?: string, reasonId?: string): Promise<void> {
  if (USE_MOCK) {
    await delay(150)
    return
  }
  await api.post(`/admin/students/${id}/archive`, { reason, reasonId })
}

/** Arxivdan qaytarish. Ixtiyoriy yangi parol bilan (parol bo'sh = login bloklangicha qoladi). */
export async function restoreStudent(id: string, newPassword?: string): Promise<void> {
  if (USE_MOCK) {
    await delay(150)
    return
  }
  await api.post(`/admin/students/${id}/restore`, { newPassword: newPassword ?? null })
}

export async function createStudent(payload: StudentPayload): Promise<Student> {
  if (USE_MOCK) {
    await delay(300)
    // Kelgan oyidan joriy oygacha har oy uchun qarz: balans = -fee * oylar soni
    const fee = classesMock.find((c) => c.name === payload.className)?.monthlyFee ?? 0
    const cur = new Date().toISOString().slice(0, 7)
    const enr = (payload.enrollmentDate || cur).slice(0, 7)
    let months = 0
    if (enr <= cur) {
      const [ey, em] = enr.split('-').map(Number)
      const [cy, cm] = cur.split('-').map(Number)
      months = (cy - ey) * 12 + (cm - em) + 1
    }
    return {
      ...payload,
      parentFullName: payload.parentFullName ?? payload.fatherFullName ?? payload.motherFullName ?? '',
      parentPhone: payload.parentPhone ?? payload.fatherPhone ?? payload.motherPhone ?? '',
      id: uid(),
      balance: -fee * months,
    }
  }
  const { data } = await api.post<Student>('/admin/students', payload)
  return data
}

/** Telefon dublikati — mos kelgan mavjud o'quvchi (arxivdagilar ham). */
export interface PhoneMatch {
  /** Kiritilgan (mos kelgan) raqam */
  phone: string
  studentId: string
  fullName: string
  className: string
  isArchived: boolean
  /** Mavjud yozuvda qaysi raqam mos keldi: O'quvchi / Ota / Ona / Ota-ona */
  role: string
}

/**
 * Kiritilgan raqamlar (o'quvchi o'zi / ota / ona) allaqachon biror o'quvchida (ARXIVDAGILAR ham)
 * bormi — tekshiradi. `excludeId` — tahrirdagi o'quvchining o'zi. Bo'sh massiv = dublikat yo'q.
 */
export async function checkStudentPhones(req: {
  phone?: string
  fatherPhone?: string
  motherPhone?: string
  parentPhone?: string
  excludeId?: string
}): Promise<PhoneMatch[]> {
  if (USE_MOCK) {
    await delay(150)
    return []
  }
  const { data } = await api.post<PhoneMatch[]>('/admin/students/check-phones', req)
  return data
}

/** Update o'quvchini tahrirlash.
 *  `applyDiscount=true` — chegirma o'zgargan bo'lsa, joriy oy hisobi yangi summaga
 *  to'g'rilanadi (balans deltaga moslab tuziladi). false (default) — joriy oy eski summada
 *  qoladi, yangi chegirma keyingi accrual'dan amal qiladi. */
export async function updateStudent(
  id: string,
  payload: StudentPayload,
  applyDiscount?: boolean,
): Promise<void> {
  if (USE_MOCK) {
    await delay(300)
    return
  }
  await api.put(`/admin/students/${id}`, payload, {
    params: applyDiscount ? { applyDiscount: true } : undefined,
  })
}

export async function deleteStudent(id: string, reasonId?: string): Promise<void> {
  if (USE_MOCK) {
    await delay(200)
    return
  }
  await api.delete(`/admin/students/${id}`, { params: reasonId ? { reasonId } : undefined })
}

/** O'quvchining tizim akkaunti (login/parol) */
export async function getStudentCredentials(id: string): Promise<Credentials> {
  if (USE_MOCK) {
    await delay(200)
    return { login: 'aliyevvali', password: 'demo23', role: 'student' }
  }
  const { data } = await api.get<Credentials>(`/admin/students/${id}/credentials`)
  return data
}

/** O'quvchiga yangi tasodifiy parol generatsiya qiladi — parol bir marta qaytadi. */
export async function resetStudentPassword(id: string): Promise<Credentials> {
  if (USE_MOCK) {
    await delay(200)
    return { login: 'aliyevvali', password: 'yangi' + Math.random().toString(36).slice(2, 8), role: 'student' }
  }
  const { data } = await api.post<Credentials>(`/admin/students/${id}/reset-password`)
  return data
}

/** Bitta guruh bo'yicha o'quvchining oylik hisobi (to'lov oynasi uchun) — aggregate emas. */
export async function getGroupLedger(
  studentId: string,
  groupId: string,
): Promise<import('@/types').GroupLedger> {
  const { data } = await api.get<import('@/types').GroupLedger>(
    `/admin/students/${studentId}/group-ledger`,
    { params: { groupId } },
  )
  return data
}

/** O'quvchiga to'lov kiritish — balansga qo'shiladi.
 *  `month` ("YYYY-MM") berilsa, to'lov shu oy uchun hisoblanadi.
 *  `groupId` berilsa, to'lov shu guruh uchun hisoblanadi (o'qituvchi foizli maoshi shunga tayanadi). */
export async function addPayment(
  id: string,
  amount: number,
  month?: string,
  groupId?: string,
  comment?: string,
  method?: string,
): Promise<string | null> {
  if (USE_MOCK) {
    await delay(250)
    return null
  }
  const { data } = await api.post<{ id: string }>(`/admin/students/${id}/payments`, {
    amount,
    month,
    groupId,
    comment,
    method,
  })
  return data?.id ?? null
}

const LEDGER_MONTHS = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05']

/** O'quvchi to'lov tarixi: oylar bo'yicha hisoblangan/to'langan holat */
export async function getStudentLedger(id: string): Promise<StudentLedger> {
  if (USE_MOCK) {
    await delay()
    const student = studentsMock.find((s) => s.id === id)
    if (!student) throw new Error('O\'quvchi topilmadi')
    const rawFee = classesMock.find((c) => c.name === student.className)?.monthlyFee ?? 0
    const monthDiscount = Math.max(
      0,
      Math.min(rawFee, (rawFee * student.discountPct) / 100 + student.discountAmount),
    )
    const fee = Math.max(0, rawFee - monthDiscount)
    const totalCharged = rawFee * LEDGER_MONTHS.length
    const totalDiscount = monthDiscount * LEDGER_MONTHS.length
    let pool = Math.max(0, fee * LEDGER_MONTHS.length + student.balance)
    const totalPaid = pool
    const months = LEDGER_MONTHS.map((month) => {
      const paid = Math.min(pool, fee)
      pool -= paid
      const remaining = fee - paid
      const status: MonthStatus = remaining === 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid'
      return { month, charged: rawFee, discount: monthDiscount, paid, remaining, status, courses: [] }
    })
    const payments = financeMock
      .filter((t) => t.studentId === id && t.category === 'tuition')
      .map((t) => ({ date: t.date, amount: t.amount, note: t.note }))
      .sort((a, b) => (a.date < b.date ? 1 : -1))
    return {
      student,
      balance: student.balance,
      monthlyFee: fee,
      totalCharged,
      totalDiscount,
      totalPaid,
      months,
      payments,
    }
  }
  const { data } = await api.get<StudentLedger>(`/admin/students/${id}/ledger`)
  return data
}

/** FAQAT super admin: shu oyning hisoblangan (avtomatik) summasini qo'lda tahrirlaydi.
 *  `groupId` berilsa — shu guruh hisobi; null/bo'sh — guruhsiz (ClassName) hisobi. */
export async function editStudentCharge(
  id: string,
  month: string,
  amount: number,
  groupId?: string,
): Promise<void> {
  if (USE_MOCK) {
    await delay(150)
    return
  }
  // Olib tashla :1/:0 agar bor bo'lsa (backend Month faqat YYYY-MM formatda kutadi)
  const cleanMonth = month.split(':')[0]
  await api.put(`/admin/students/${id}/charges/${cleanMonth}`, { amount }, {
    params: groupId ? { groupId } : undefined,
  })
}

/* ---------- Tugatgan kurslar + sertifikatlar ---------- */

/** Admin: o'quvchining tugatgan kursi + sertifikati. */
export interface StudentCompletedCourse {
  certificateId: string
  courseId: string
  courseName: string
  issuedAt: string
  expiresAt: string
  status: string
  fileName: string
  downloadUrl: string
  downloadCount: number
  groupName: string
}

/** Support o'qituvchidan kelgan feedback (o'tilgan support darsi: mavzu + izoh). */
export interface StudentSupportFeedback {
  date: string
  startTime: string
  endTime: string
  teacherName: string
  topic: string
  notes: string
}

/** AI tahlilidagi sohaviy baholar (0-100) — radar/diagramma uchun. */
export interface AiRatings {
  akademik: number
  davomat: number
  intizom: number
  uyVazifa: number
  faollik: number
  umumiy: number
}
/** AI tahlilining strukturali natijasi (matn bo'limlari + diagramma sonlari). */
export interface StudentAiAnalysisResult {
  umumiy: string
  kuchli: string[]
  zaif: string[]
  dinamika: string
  ozgarishlar: string
  tavsiyalar: string[]
  baholar: AiRatings
  /** "yaxshilanmoqda" | "barqaror" | "yomonlashmoqda" */
  trend: string
}
/** Saqlangan bitta AI tahlil yozuvi (tarix elementi). */
export interface StudentAiAnalysisRecord {
  id: string
  /** "yyyy-MM-dd" */
  date: string
  createdAt: string
  model: string
  overallScore: number
  result: StudentAiAnalysisResult
}
/** AI tahlil yaratish javobi. */
export interface StudentAiAnalysisResponse {
  ok: boolean
  /** true bo'lsa bugun allaqachon tahlil qilingan (yangi Gemini chaqirig'i bo'lmadi). */
  alreadyToday: boolean
  record: StudentAiAnalysisRecord | null
  error: string | null
}

/** O'quvchining saqlangan AI tahlillari tarixi (eng yangisi birinchi). */
export async function getStudentAiAnalyses(studentId: string): Promise<StudentAiAnalysisRecord[]> {
  if (USE_MOCK) {
    await delay()
    return []
  }
  const { data } = await api.get<StudentAiAnalysisRecord[]>(`/admin/students/${studentId}/ai-analyses`)
  return data
}

/**
 * O'quvchining BARCHA ma'lumotlarini Gemini orqali tahlil qiladi (kuniga bir marta).
 * Bugun qilingan bo'lsa mavjud yozuv qaytadi (alreadyToday=true), yangi chaqiruv bo'lmaydi.
 * Sozlamalar → AI Tahlil (Gemini) bo'limida API kaliti kiritilgan bo'lishi kerak.
 */
export async function generateStudentAiAnalysis(studentId: string): Promise<StudentAiAnalysisResponse> {
  const { data } = await api.post<StudentAiAnalysisResponse>(`/admin/students/${studentId}/ai-analysis`)
  return data
}

/** O'quvchiga support o'qituvchilar bergan feedback (o'tilgan support darslari). */
export async function getStudentSupportFeedback(
  studentId: string,
): Promise<StudentSupportFeedback[]> {
  if (USE_MOCK) {
    await delay()
    return []
  }
  const { data } = await api.get<StudentSupportFeedback[]>(
    `/admin/students/${studentId}/support-feedback`,
  )
  return data
}

/** O'quvchining tugatgan kurslari + sertifikatlari ro'yxati. */
export async function getStudentCertificates(studentId: string): Promise<StudentCompletedCourse[]> {
  if (USE_MOCK) {
    await delay()
    return []
  }
  const { data } = await api.get<StudentCompletedCourse[]>(
    `/admin/students/${studentId}/certificates`,
  )
  return data
}

/** Admin: o'quvchiga qo'lda sertifikat yaratish (kurs bo'yicha). */
export async function generateStudentCertificate(
  studentId: string,
  courseId: string,
  notes?: string,
): Promise<StudentCompletedCourse> {
  const { data } = await api.post<StudentCompletedCourse>(
    `/admin/students/${studentId}/certificates/generate`,
    { courseId, notes },
  )
  return data
}

/** Sertifikat faylini yuklab olish (admin). Auth header avtomatik qo'shiladi. */
export async function downloadStudentCertificate(
  studentId: string,
  certificateId: string,
  fileName: string,
): Promise<void> {
  if (USE_MOCK) {
    alert('Sertifikat faqat real serverda yuklanadi.')
    return
  }
  const res = await api.get(
    `/admin/students/${studentId}/certificates/${certificateId}/download`,
    { responseType: 'blob' },
  )
  const url = URL.createObjectURL(res.data as Blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName || `sertifikat_${certificateId}.html`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
