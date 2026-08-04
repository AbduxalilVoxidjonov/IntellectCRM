import { api } from '../client'

/**
 * TEST SERTIFIKATLARI — Word (.docx) andozalari va test bo'yicha beriladigan sertifikatlar.
 *
 * Andozalarni FAQAT admin boshqaradi ("O'quv bo'limi → Testlar natijalari → Sertifikat shablonlari"),
 * o'qituvchi esa ularni test yaratishda tanlaydi va sertifikat yaratadi. Shuning uchun quyida
 * admin (`/admin/test-results/...`) va o'qituvchi (`/teacher/test-results/...`) variantlari alohida.
 */

/** `ready` — PDF tayyor; `docx` — serverda LibreOffice yo'q, faqat Word fayl saqlangan. */
export type TestCertificateStatus = 'ready' | 'docx'

/** Andozada yozilishi mumkin bo'lgan bitta `@`-o'zgaruvchi. */
export interface CertificateToken {
  token: string
  label: string
  example: string
}

export interface TestCertificateTemplate {
  id: string
  name: string
  /** Yuklangan .docx manzili ("/uploads/xxx.docx") */
  fileUrl: string
  /** Faylning asl nomi */
  fileName: string
  /** Standart — test formasida shablon tanlanmasa shu ishlatiladi */
  isDefault: boolean
  isActive: boolean
  createdAt: string
  createdBy: string
}

export interface TestCertificateTemplatePayload {
  name: string
  /** Tahrirlashda bo'sh qoldirilsa fayl o'zgarmaydi */
  fileUrl?: string
  fileName?: string
  isDefault?: boolean
  isActive?: boolean
}

export interface TestCertificate {
  id: string
  testResultId: string
  studentId: string
  studentName: string
  /** "SRT-2026-0042" */
  number: string
  templateName: string
  docxUrl: string
  /** Bo'sh bo'lsa PDF yaratilmagan (status='docx') */
  pdfUrl: string
  status: TestCertificateStatus
  score: number
  maxScore: number
  percent: number
  issuedAt: string
}

export interface GenerateCertificatesResult {
  created: number
  /** false — serverda LibreOffice yo'q, faqat .docx yaratildi */
  pdfAvailable: boolean
  items: TestCertificate[]
  warning?: string | null
}

// ---------------------------------------------------------------- Admin: andozalar

/** Andozada ishlatiladigan o'zgaruvchilar ro'yxati (yagona manba — server). */
export async function getCertificateTokens(): Promise<{
  tokens: CertificateToken[]
  pdfAvailable: boolean
}> {
  const { data } = await api.get<{ tokens: CertificateToken[]; pdfAvailable: boolean }>(
    '/admin/test-results/certificate-tokens',
  )
  return data
}

export async function getCertificateTemplates(activeOnly = false): Promise<TestCertificateTemplate[]> {
  const { data } = await api.get<TestCertificateTemplate[]>(
    '/admin/test-results/certificate-templates',
    { params: { activeOnly } },
  )
  return data
}

export async function createCertificateTemplate(
  payload: TestCertificateTemplatePayload,
): Promise<TestCertificateTemplate> {
  const { data } = await api.post<TestCertificateTemplate>(
    '/admin/test-results/certificate-templates',
    payload,
  )
  return data
}

export async function updateCertificateTemplate(
  id: string,
  payload: TestCertificateTemplatePayload,
): Promise<TestCertificateTemplate> {
  const { data } = await api.put<TestCertificateTemplate>(
    `/admin/test-results/certificate-templates/${id}`,
    payload,
  )
  return data
}

export async function deleteCertificateTemplate(id: string): Promise<void> {
  await api.delete(`/admin/test-results/certificate-templates/${id}`)
}

// ---------------------------------------------------------------- Admin: sertifikatlar

/** Test bo'yicha sertifikatlarni yaratish (ball kiritilgan har o'quvchiga bittadan).
 *  Qayta chaqirilsa mavjudlari YANGILANADI — nusxa yaratilmaydi. */
export async function generateTestCertificates(testId: string): Promise<GenerateCertificatesResult> {
  const { data } = await api.post<GenerateCertificatesResult>(
    `/admin/test-results/${testId}/certificates`,
  )
  return data
}

export async function getTestCertificates(testId: string): Promise<TestCertificate[]> {
  const { data } = await api.get<TestCertificate[]>(`/admin/test-results/${testId}/certificates`)
  return data
}

// ---------------------------------------------------------------- O'qituvchi

/** Tanlash uchun FAOL andozalar (o'qituvchi yarata/o'chira olmaydi — faqat tanlaydi). */
export async function getTeacherCertificateTemplates(): Promise<{
  templates: TestCertificateTemplate[]
  pdfAvailable: boolean
}> {
  const { data } = await api.get<{
    templates: TestCertificateTemplate[]
    pdfAvailable: boolean
  }>('/teacher/test-results/certificate-templates')
  return data
}

export async function generateTeacherTestCertificates(
  testId: string,
): Promise<GenerateCertificatesResult> {
  const { data } = await api.post<GenerateCertificatesResult>(
    `/teacher/test-results/${testId}/certificates`,
  )
  return data
}

// ---------------------------------------------------------------- Yuklab olish

/** Blob'ni brauzerda saqlash (server `Content-Disposition` da to'g'ri nom beradi). */
async function download(url: string, fallbackName: string) {
  const res = await api.get(url, { responseType: 'blob' })
  const cd = String(res.headers['content-disposition'] ?? '')
  // filename*=UTF-8''... yoki filename="..." — ikkalasini ham qo'llab-quvvatlaymiz.
  const star = /filename\*=UTF-8''([^;]+)/i.exec(cd)?.[1]
  const plain = /filename="?([^";]+)"?/i.exec(cd)?.[1]
  const name = star ? decodeURIComponent(star) : plain || fallbackName

  const href = URL.createObjectURL(res.data as Blob)
  const a = document.createElement('a')
  a.href = href
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(href)
}

/** Bitta sertifikat (standart — PDF; `format='docx'` bilan Word). */
export function downloadCertificate(certificateId: string, teacher = false, format?: 'docx') {
  const base = teacher ? '/teacher/test-results' : '/admin/test-results'
  const q = format ? `?format=${format}` : ''
  return download(`${base}/certificates/${certificateId}/download${q}`, 'sertifikat.pdf')
}

/** Test bo'yicha BARCHA sertifikatlar — bitta ZIP. */
export function downloadAllCertificates(testId: string, teacher = false) {
  const base = teacher ? '/teacher/test-results' : '/admin/test-results'
  return download(`${base}/${testId}/certificates/download`, 'sertifikatlar.zip')
}
