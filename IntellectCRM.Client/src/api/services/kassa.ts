import { api, USE_MOCK } from '../client'

/** Kassa qidiruvida chiqadigan o'quvchi qatori (to'liq profil emas — kassirga kerakli minimum). */
export interface KassaStudent {
  id: string
  fullName: string
  /** O'quvchining o'z telefoni (bo'sh bo'lishi mumkin) */
  phone: string
  /** Ota-ona telefoni */
  parentPhone: string
  /** Faol a'zoliklaridagi guruh nomlari */
  groups: string[]
  /** UMUMIY balans (so'm): manfiy = qarzdor, musbat = avans */
  balance: number
  /** Arxivlangan o'quvchi (to'lov qabul qilinaveradi) */
  isArchived: boolean
}

/**
 * O'quvchini F.I.Sh yoki telefon (o'zi/ota/ona/ota-ona) bo'yicha qidiradi — server tomonda,
 * eng ko'pi 30 ta natija. Kamida 2 belgi kerak (kamroqda bo'sh ro'yxat qaytadi).
 */
export async function searchKassaStudents(q: string): Promise<KassaStudent[]> {
  const term = q.trim()
  if (term.length < 2) return []
  if (USE_MOCK) return []
  const { data } = await api.get<KassaStudent[]>('/admin/kassa/students', { params: { q: term } })
  return data
}

/**
 * KASSA orqali to'lov kiritish. Server tomonda mantiq o'quvchilar bo'limidagi to'lov bilan AYNAN
 * bir xil (`PaymentIntake`) — kvitansiya takrorlanmasligi, idempotentlik, avans hisobi, audit va
 * avto-xabar. Farqi faqat RUXSAT: "kassa" (o'quvchilarni tahrirlash huquqi shart emas).
 *
 * Kvitansiya raqami band bo'lsa server 409 qaytaradi — `receiptDuplicateOf` (students servisi)
 * uni ajratadi va to'lov oynasi ogohlantirish kartochkasini ko'rsatadi.
 *
 * Qaytadi: yaratilgan tranzaksiya id'si (chek chiqarish uchun) yoki null.
 */
export async function addKassaPayment(
  studentId: string,
  amount: number,
  month?: string,
  groupId?: string,
  comment?: string,
  method?: string,
  date?: string,
  extra?: { receiptNo?: string; paidTime?: string; cardLast4?: string; forceReceipt?: boolean },
): Promise<string | null> {
  if (USE_MOCK) return null
  const { data } = await api.post<{ id: string }>(`/admin/kassa/students/${studentId}/payments`, {
    amount,
    month,
    groupId,
    comment,
    method,
    date,
    receiptNo: extra?.receiptNo,
    paidTime: extra?.paidTime,
    cardLast4: extra?.cardLast4,
    forceReceipt: extra?.forceReceipt ?? false,
  })
  return data?.id ?? null
}
