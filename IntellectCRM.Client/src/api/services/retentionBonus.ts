import { api } from '../client'

/**
 * O'QUVCHINI USHLAB TURISH BONUSI — "O'quvchilar → Bonus hisoboti" bo'limi API'si.
 *
 * O'quvchi belgilangan muddat (default 6 oy) uzluksiz o'qib to'lasa, uni o'qitgan
 * o'qituvchi(lar)ga bonus ajratiladi — o'qigan oylar nisbatida. Oylik holatlar hech qayerda
 * SAQLANMAYDI: har so'rovda qayta hisoblanadi (kechikkan to'lov kiritilsa katak o'z-o'zidan
 * "to'liq" ga aylanadi). Faqat BERILGAN bonus saqlanadi.
 */

/** Oy katagi holati: ✅ to'liq · ⏳ qarzdor · ❄️ muzlatilgan · 🚪 a'zolik yo'q */
export type RetentionState = 'paid' | 'debt' | 'frozen' | 'gone'
/** Qator holati: boshlanmagan · yo'lda · tayyor · uzilgan */
export type RetentionStatus = 'notstarted' | 'progress' | 'ready' | 'broken'

export interface RetentionMonthCell {
  month: string
  state: RetentionState
  charged: number
  paid: number
  teacherId: string
  teacherName: string
  /** Sanoqqa kirdimi (+1) */
  counted: boolean
}

export interface RetentionShare {
  teacherId: string
  teacherName: string
  /** Shu o'qituvchida o'tgan oylar (kasrli bo'lishi mumkin — parallel guruhlar) */
  months: number
  amount: number
}

export interface RetentionAward {
  id: string
  studentId: string
  studentName: string
  cycleNo: number
  periodFrom: string
  periodTo: string
  totalAmount: number
  status: 'given' | 'cancelled'
  cancelReason: string
  createdAt: string
  givenBy: string
  note: string
  shares: RetentionShare[]
}

export interface RetentionRow {
  studentId: string
  fullName: string
  groupNames: string
  days: string
  startMonth: string
  cycleNo: number
  months: RetentionMonthCell[]
  counted: number
  required: number
  status: RetentionStatus
  statusNote: string
  isArchived: boolean
  /** Taxminiy taqsimot (faqat status="ready" bo'lganda to'ladi) */
  shares: RetentionShare[]
  /** Shu o'quvchiga avval berilgan bonuslar */
  awards: RetentionAward[]
}

export interface RetentionSettings {
  monthsRequired: number
  maxGapMonths: number
  defaultAmount: number
}

export interface RetentionReport {
  rows: RetentionRow[]
  settings: RetentionSettings
  readyCount: number
}

export interface TeacherRetentionBonus {
  awardId: string
  studentId: string
  studentName: string
  periodFrom: string
  periodTo: string
  months: number
  amount: number
  givenAt: string
  givenBy: string
  status: 'given' | 'cancelled'
}

export interface TeacherRetentionSummary {
  total: number
  count: number
  items: TeacherRetentionBonus[]
}

export async function getRetentionReport(): Promise<RetentionReport> {
  const { data } = await api.get<RetentionReport>('/admin/retention-bonus')
  return data
}

export async function giveRetentionBonus(payload: {
  studentId: string
  totalAmount: number
  shares: { teacherId: string; amount: number; months: number }[]
  note?: string
}): Promise<{ id: string }> {
  const { data } = await api.post<{ id: string }>('/admin/retention-bonus/awards', payload)
  return data
}

export async function cancelRetentionBonus(awardId: string, reason?: string): Promise<void> {
  await api.post(`/admin/retention-bonus/awards/${awardId}/cancel`, { reason })
}

export async function restartRetentionCycle(studentId: string, startMonth: string): Promise<void> {
  await api.post(`/admin/retention-bonus/students/${studentId}/restart`, { startMonth })
}

export async function getTeacherRetentionBonuses(
  teacherId: string,
): Promise<TeacherRetentionSummary> {
  const { data } = await api.get<TeacherRetentionSummary>(
    `/admin/retention-bonus/teacher/${teacherId}`,
  )
  return data
}

export async function getRetentionSettings(): Promise<RetentionSettings> {
  const { data } = await api.get<RetentionSettings>('/admin/retention-bonus/settings')
  return data
}

export async function saveRetentionSettings(
  payload: RetentionSettings,
): Promise<RetentionSettings> {
  const { data } = await api.put<RetentionSettings>('/admin/retention-bonus/settings', payload)
  return data
}

export async function exportRetentionReport(): Promise<void> {
  const res = await api.get('/admin/retention-bonus/export', { responseType: 'blob' })
  const cd = String(res.headers['content-disposition'] ?? '')
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd)
  const href = URL.createObjectURL(res.data as Blob)
  const a = document.createElement('a')
  a.href = href
  a.download = match?.[1] ?? `bonus_hisobot_${new Date().toISOString().slice(0, 10)}.xlsx`
  a.click()
  URL.revokeObjectURL(href)
}

/**
 * Jami summani o'qigan OYLAR nisbatida o'qituvchilar orasida bo'ladi — serverdagi
 * taqsimot bilan bir xil qoida (yaxlitlash qoldig'i eng katta ulushga qo'shiladi, shunda
 * yig'indi jami summaga ANIQ teng chiqadi). Admin summani o'zgartirganda modal shu bilan
 * qayta hisoblaydi.
 */
export function splitByMonths(shares: RetentionShare[], total: number): RetentionShare[] {
  const totalMonths = shares.reduce((s, x) => s + x.months, 0)
  if (shares.length === 0 || totalMonths <= 0) return shares
  const out = shares.map((s) => ({ ...s, amount: Math.round((total * s.months) / totalMonths) }))
  const diff = total - out.reduce((s, x) => s + x.amount, 0)
  if (diff !== 0) {
    const biggest = out.reduce((a, b) => (b.months > a.months ? b : a), out[0])
    biggest.amount += diff
  }
  return out
}
