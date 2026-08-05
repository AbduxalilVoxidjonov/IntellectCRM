import { delay } from '@/lib/utils'
import { api, USE_MOCK } from '../client'

/**
 * "BOG'LANISH KERAK" — o'quvchi bilan bog'lanish navbati (follow-up).
 *
 * Bosqich va natija KALITLARI serverdan keladi (`getContactMeta`) — bu yerdagi tiplar faqat
 * shakl, yorliqlar emas. Yagona manba: backend `ContactService`.
 */

/** Talab bosqichi: navbatda turadiganlar `new`/`callback`, yakuniylar `done`/`failed`. */
export type ContactStatus = 'new' | 'callback' | 'done' | 'failed'

export interface ContactAttempt {
  id: string
  /** created | contact | note | reopen */
  type: string
  /** answered | no_answer | busy | wrong_number | other ('' — bog'lanish urinishi emas) */
  result: string
  resultLabel: string
  /** "Javobi nima dedi" */
  response: string
  nextStatus: string
  nextStatusLabel: string
  dueDate: string
  actorName: string
  createdAt: string
}

export interface ContactRequestItem {
  id: string
  studentId: string
  studentName: string
  reasonId: string
  reasonLabel: string
  note: string
  status: ContactStatus
  statusLabel: string
  /** Qayta qo'ng'iroq sanasi ("yyyy-MM-dd"), faqat `callback` da. */
  dueDate: string
  /** Muddati o'tganmi — serverda hisoblanadi (klient sanasiga ishonilmaydi). */
  overdue: boolean
  attemptCount: number
  lastResponse: string
  lastActorName: string
  lastActionAt: string
  createdAt: string
  createdBy: string
  closedAt: string
  closedBy: string
  /** O'quvchi + ota-ona raqamlari (takrorsiz). */
  phones: string[]
  /** Faqat bitta talab so'ralganda to'ladi. */
  history?: ContactAttempt[]
}

export interface ContactMeta {
  statuses: { key: string; label: string; isOpen: boolean; color: string }[]
  results: { key: string; label: string; reached: boolean }[]
  counts: { key: string; count: number }[]
  overdue: number
}

export interface ContactDailyRow {
  date: string
  created: number
  attempts: number
  /** Odam bilan HAQIQATAN gaplashilgan urinishlar. */
  reached: number
  done: number
  callback: number
  failed: number
}

export interface ContactStats {
  from: string
  to: string
  created: number
  attempts: number
  reached: number
  done: number
  callback: number
  failed: number
  openNow: number
  overdueNow: number
  daily: ContactDailyRow[]
  byStaff: { actorName: string; attempts: number; reached: number; done: number; callback: number; failed: number }[]
  byReason: { reasonLabel: string; created: number; done: number; failed: number; open: number }[]
  byResult: { key: string; label: string; count: number }[]
  /** Javoblarda eng ko'p uchragan so'zlar — "nima deb yozilyapti" ni bir qarashda ko'rsatadi. */
  topWords?: { word: string; count: number }[]
  /** Javob YOZILGAN urinishlar soni (bo'sh javoblar hisobga olinmaydi). */
  withResponse?: number
}

const emptyMeta: ContactMeta = { statuses: [], results: [], counts: [], overdue: 0 }

/** Bosqich/natija katalogi + navbat sanoqlari (sahifa bir so'rovda ochiladi). */
export async function getContactMeta(): Promise<ContactMeta> {
  if (USE_MOCK) {
    await delay()
    return emptyMeta
  }
  const { data } = await api.get<ContactMeta>('/admin/contacts/meta')
  return data
}

/**
 * Navbat. `status` berilmasa — FAQAT ochiqlar (new + callback); `'all'` — hammasi.
 */
export async function getContactRequests(params: {
  status?: string
  q?: string
  overdue?: boolean
} = {}): Promise<ContactRequestItem[]> {
  if (USE_MOCK) {
    await delay()
    return []
  }
  const { data } = await api.get<ContactRequestItem[]>('/admin/contacts', { params })
  return data
}

/** Bitta talab — TARIXI bilan. */
export async function getContactRequest(id: string): Promise<ContactRequestItem> {
  const { data } = await api.get<ContactRequestItem>(`/admin/contacts/${id}`)
  return data
}

/** O'quvchining barcha talablari (profil sahifasi uchun). */
export async function getStudentContactRequests(studentId: string): Promise<ContactRequestItem[]> {
  if (USE_MOCK) {
    await delay()
    return []
  }
  const { data } = await api.get<ContactRequestItem[]>(`/admin/contacts/student/${studentId}`)
  return data
}

/**
 * Yangi talab ("Bog'lanish kerak"). O'quvchida allaqachon ochiq talab bo'lsa server 400 qaytaradi
 * va javobda `existingId` beradi — klient o'sha talabni ocha oladi.
 */
export async function createContactRequest(payload: {
  studentId: string
  reasonId?: string
  note?: string
  dueDate?: string
}): Promise<ContactRequestItem> {
  const { data } = await api.post<ContactRequestItem>('/admin/contacts', payload)
  return data
}

/** BOG'LANILDI — natija + javobi + keyingi bosqich. */
export async function addContactAttempt(
  id: string,
  payload: { result: string; response?: string; nextStatus: string; dueDate?: string },
): Promise<ContactRequestItem> {
  const { data } = await api.post<ContactRequestItem>(`/admin/contacts/${id}/attempt`, payload)
  return data
}

/** Bosqichni o'zgartirmasdan izoh qo'shish. */
export async function addContactNote(id: string, text: string): Promise<ContactRequestItem> {
  const { data } = await api.post<ContactRequestItem>(`/admin/contacts/${id}/note`, { text })
  return data
}

/** Yakunlangan talabni qayta ochish. */
export async function reopenContactRequest(id: string, note?: string): Promise<ContactRequestItem> {
  const { data } = await api.post<ContactRequestItem>(`/admin/contacts/${id}/reopen`, { note })
  return data
}

export async function deleteContactRequest(id: string): Promise<void> {
  await api.delete(`/admin/contacts/${id}`)
}

/** Davr bo'yicha hisobot (kunlik oqim, xodimlar/sabablar/natijalar kesimi). */
export async function getContactStats(from?: string, to?: string): Promise<ContactStats> {
  const { data } = await api.get<ContactStats>('/admin/contacts/stats', { params: { from, to } })
  return data
}

/* ---------- Ko'plab qo'shish (o'quvchilar ro'yxatidan) ---------- */

export interface ContactBulkResult {
  created: number
  /** Ochiq talabi borligi uchun chetlab o'tilganlar. */
  skipped: number
  /** Ulardan bir nechtasining ismi (xabarda ko'rsatish uchun). */
  skippedNames: string[]
  /** Topilmagan o'quvchilar (ro'yxat eskirgan bo'lsa). */
  notFound: number
}

/**
 * Bir nechta o'quvchini birdan navbatga qo'shadi.
 *
 * ⚠️ Ochiq talabi bor o'quvchi CHETLAB O'TILADI (butun amal to'xtamaydi) — natijada
 * `skipped` qaytadi. Bitta o'quvchi uchun ham shu ishlatiladi.
 */
export async function createContactRequestsBulk(payload: {
  studentIds: string[]
  reasonId?: string
  note?: string
  dueDate?: string
}): Promise<ContactBulkResult> {
  if (USE_MOCK) {
    await delay()
    return { created: payload.studentIds.length, skipped: 0, skippedNames: [], notFound: 0 }
  }
  const { data } = await api.post<ContactBulkResult>('/admin/contacts/bulk', payload)
  return data
}

/* ---------- Javoblar tahlili ---------- */

/** Yozilgan javob ("javobi nima dedi") — hisobotdagi javoblar lentasi. */
export interface ContactResponseRow {
  id: string
  requestId: string
  studentId: string
  studentName: string
  reasonLabel: string
  result: string
  resultLabel: string
  nextStatus: string
  nextStatusLabel: string
  response: string
  actorName: string
  createdAt: string
}

/** Javob YOZILGAN urinishlar (bo'sh javoblar qaytmaydi) — o'qish uchun. */
export async function getContactResponses(params: {
  from?: string
  to?: string
  result?: string
  actor?: string
  q?: string
  limit?: number
} = {}): Promise<ContactResponseRow[]> {
  if (USE_MOCK) {
    await delay()
    return []
  }
  const { data } = await api.get<ContactResponseRow[]>('/admin/contacts/responses', { params })
  return data
}
