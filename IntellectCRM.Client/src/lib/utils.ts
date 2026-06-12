/** Tailwind class'larni shartli birlashtirish */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

/** Mock API kechikishini simulyatsiya qilish */
export function delay(ms = 500): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * ISO sanani DD.MM.YYYY ko'rinishida chiqarish.
 * MUHIM: saqlangan satrni TO'G'RIDAN-TO'G'RI o'qiymiz (yyyy-MM-dd qismi) — `new Date()` orqali emas.
 * Shu sabab brauzer vaqt mintaqasidan QAT'I NAZAR server (Toshkent) sanasi aynan ko'rinadi (siljimaydi).
 * Noma'lum formatlar uchun `new Date()` ga qaytamiz.
 */
export function formatDate(iso: string): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) // "yyyy-MM-dd" yoki "yyyy-MM-ddTHH:mm:ss" boshlanishi
  if (m) return `${m[3]}.${m[2]}.${m[1]}`
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}.${mm}.${d.getFullYear()}`
}

/**
 * ISO timestamp ("yyyy-MM-ddTHH:mm:ss") → "DD.MM.YYYY HH:mm". Vaqt qismi bo'lmasa — faqat sana.
 * Butun ilovada YAGONA sana+vaqt formati. Satrdan o'qiydi (TZ siljishisiz — server vaqti aynan ko'rinadi).
 */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const time = /T(\d{2}:\d{2})/.exec(iso) // "Thh:mm"
  const date = formatDate(iso)
  return time ? `${date} ${time[1]}` : date
}

/** ISO timestamp → "HH:mm" (faqat vaqt). Satrdan o'qiydi (TZ siljishisiz). */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const m = /T(\d{2}:\d{2})/.exec(iso)
  return m ? m[1] : ''
}

/** Ma'lumotlarni CSV faylga yuklab olish (Excel uchun UTF-8 BOM bilan) */
export function exportToCsv(filename: string, headers: string[], rows: string[][]): void {
  const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`
  const csv = [headers, ...rows].map((r) => r.map(escape).join(',')).join('\r\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Oddiy noyob ID */
export function uid(): string {
  return crypto.randomUUID()
}

/** Pulni "850 000 so'm" ko'rinishida formatlash */
export function formatMoney(n: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(n)} so'm`
}

/** Tasodifiy parol (chalkashtirmaydigan belgilardan — 0/O, 1/l/I yo'q) */
export function randomPassword(length = 6): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789'
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

/** Matnni clipboardga nusxalash (xatoni yutadi) */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
