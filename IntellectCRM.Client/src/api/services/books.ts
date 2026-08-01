import { api } from '../client'

/**
 * KITOBLAR SOTUVI — "O'quv bo'limi → Kitoblar sotuvi" bo'limi API'si.
 * Buyurtmalar botdan (Telegram) tushadi; admin ularni tasdiqlaydi/rad etadi.
 * Tasdiqlanganda ombor qoldig'idan ayiriladi va sotuv analitikaga tushadi.
 */

export type BookPaymentMethod = 'cash' | 'card'
export type BookOrderStatus = 'pending' | 'approved' | 'rejected'
/** Ombor harakati turi: boshlang'ich qoldiq | kirim | sotuv | qo'lda korreksiya */
export type BookStockReason = 'initial' | 'restock' | 'sale' | 'correction'

export interface Book {
  id: string
  title: string
  author: string
  description: string
  coverUrl: string
  price: number
  /** Joriy ombor qoldig'i (ostatka) */
  stock: number
  /** Botda ko'rinadimi */
  isActive: boolean
  /** Tasdiqlangan buyurtmalarda sotilgan dona */
  soldQty: number
  /** Tasdiqlangan sotuvlardan tushum */
  soldTotal: number
  /** Kutilayotgan buyurtmalardagi dona (rezerv emas — ogohlantirish uchun) */
  pendingQty: number
  createdAt: string
  createdBy: string
}

export interface BookPayload {
  title: string
  price: number
  author?: string
  description?: string
  coverUrl?: string
  isActive: boolean
  /** FAQAT yaratishda: boshlang'ich qoldiq (kirim tarixiga "initial" bo'lib yoziladi) */
  initialStock?: number
}

export interface BookStockMove {
  id: string
  bookId: string
  bookTitle: string
  /** Musbat = kirim, manfiy = chiqim (sotuv/korreksiya) */
  qty: number
  reason: BookStockReason
  orderId?: string | null
  note: string
  /** Shu harakatdan keyingi qoldiq */
  stockAfter: number
  createdAt: string
  createdBy: string
}

export interface BookOrder {
  id: string
  number: number
  customerName: string
  phone: string
  studentId?: string | null
  studentName?: string | null
  bookId: string
  bookTitle: string
  unitPrice: number
  qty: number
  total: number
  paymentMethod: BookPaymentMethod
  /** Karta to'lovida mijoz yuborgan chek (`/uploads/...`); naqdda bo'sh */
  receiptUrl: string
  status: BookOrderStatus
  rejectReason: string
  createdAt: string
  decidedAt?: string | null
  decidedBy: string
  /** Kitobning JORIY qoldig'i — tasdiqlash mumkinligini ko'rish uchun */
  bookStock: number
}

export interface BookDaySales {
  date: string
  qty: number
  cash: number
  card: number
  total: number
}

export interface BookSalesByBook {
  bookId: string
  bookTitle: string
  qty: number
  total: number
  stock: number
}

export interface BookAnalytics {
  from: string
  to: string
  ordersApproved: number
  ordersPending: number
  ordersRejected: number
  soldQty: number
  revenueCash: number
  revenueCard: number
  revenueTotal: number
  stockTotal: number
  stockInQty: number
  byDay: BookDaySales[]
  byBook: BookSalesByBook[]
  lowStock: BookSalesByBook[]
}

export interface BookSettings {
  bookSalesEnabled: boolean
  bookCardNumber: string
  bookCardHolder: string
  bookPaymentNote: string
}

export interface BookOrderFilters {
  status?: BookOrderStatus | ''
  from?: string
  to?: string
  bookId?: string
  method?: BookPaymentMethod | ''
  q?: string
}

/**
 * Karta to'lovlari bo'limi — kartaga o'tkazma bilan to'langan buyurtmalar + jamlanma.
 * Jami summalar SERVERDA butun topilma bo'yicha hisoblanadi (`orders` ro'yxati ko'rsatish
 * uchun cheklangan bo'lishi mumkin, undan qo'shib chiqarish NOTO'G'RI bo'lardi).
 */
export interface BookCardPayments {
  /** Bo'lim bog'langan karta (Sozlamalar tabidan) — pul shu kartaga tushadi */
  cardNumber: string
  cardHolder: string
  /** Tasdiqlangan — kartaga hisoblangan pul */
  countApproved: number
  totalApproved: number
  /** Chek kelgan, admin hali tasdiqlamagan */
  countPending: number
  totalPending: number
  countRejected: number
  orders: BookOrder[]
}

/** Bo'sh qiymatlarni tashlab, faqat to'ldirilgan filtrlarni yuboradi. */
function clean(params: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  )
}

// ---------- Ombor (kitoblar) ----------

export async function getBooks(activeOnly = false): Promise<Book[]> {
  const { data } = await api.get<Book[]>('/admin/books', { params: clean({ activeOnly }) })
  return data
}

export async function createBook(payload: BookPayload): Promise<Book> {
  const { data } = await api.post<Book>('/admin/books', payload)
  return data
}

export async function updateBook(id: string, payload: BookPayload): Promise<Book> {
  const { data } = await api.put<Book>(`/admin/books/${id}`, payload)
  return data
}

export async function deleteBook(id: string): Promise<void> {
  await api.delete(`/admin/books/${id}`)
}

/** Omborga kirim (qty > 0) yoki qo'lda ayirish (qty < 0). Har amal tarixga yoziladi. */
export async function addBookStock(id: string, qty: number, note?: string): Promise<Book> {
  const { data } = await api.post<Book>(`/admin/books/${id}/stock`, { qty, note })
  return data
}

/** Kitob muqovasini yuklaydi va `/uploads/...` URL'ini qaytaradi. */
export async function uploadBookCover(file: File): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post<{ url: string }>('/admin/books/cover', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data.url
}

export async function getBookStockMoves(params: {
  from?: string
  to?: string
  bookId?: string
  onlyIn?: boolean
} = {}): Promise<BookStockMove[]> {
  const { data } = await api.get<BookStockMove[]>('/admin/books/stock-moves', { params: clean(params) })
  return data
}

// ---------- Buyurtmalar ----------

export async function getBookOrders(filters: BookOrderFilters = {}): Promise<BookOrder[]> {
  const { data } = await api.get<BookOrder[]>('/admin/books/orders', { params: clean(filters) })
  return data
}

/** Karta to'lovlari (chek rasmi bilan) + shu karta bo'yicha jamlanma. `method` yubormaymiz —
 *  server har doim faqat karta buyurtmalarini qaytaradi. */
export async function getBookCardPayments(
  filters: Omit<BookOrderFilters, 'method'> = {},
): Promise<BookCardPayments> {
  const { data } = await api.get<BookCardPayments>('/admin/books/card-payments', {
    params: clean(filters),
  })
  return data
}

export async function getPendingBookOrderCount(): Promise<number> {
  const { data } = await api.get<{ count: number }>('/admin/books/orders/pending-count')
  return data.count
}

/** Tasdiqlash: qoldiqdan ayiriladi + mijozga botda xabar ketadi. */
export async function approveBookOrder(id: string): Promise<BookOrder> {
  const { data } = await api.post<BookOrder>(`/admin/books/orders/${id}/approve`)
  return data
}

/** Rad etish: sabab mijozga botda yuboriladi. */
export async function rejectBookOrder(id: string, reason: string): Promise<BookOrder> {
  const { data } = await api.post<BookOrder>(`/admin/books/orders/${id}/reject`, { reason })
  return data
}

// ---------- Analitika ----------

export async function getBookAnalytics(from?: string, to?: string): Promise<BookAnalytics> {
  const { data } = await api.get<BookAnalytics>('/admin/books/analytics', { params: clean({ from, to }) })
  return data
}

// ---------- Sozlamalar (botdagi to'lov rekvizitlari) ----------

export async function getBookSettings(): Promise<BookSettings> {
  const { data } = await api.get<BookSettings>('/admin/books/settings')
  return data
}

export async function saveBookSettings(payload: BookSettings): Promise<BookSettings> {
  const { data } = await api.put<BookSettings>('/admin/books/settings', payload)
  return data
}

// ---------- Excel eksport ----------

async function download(url: string, params: object, fallbackName: string) {
  const res = await api.get(url, { params: clean(params), responseType: 'blob' })
  const cd = String(res.headers['content-disposition'] ?? '')
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd)
  const href = URL.createObjectURL(res.data as Blob)
  const a = document.createElement('a')
  a.href = href
  a.download = match?.[1] ?? fallbackName
  a.click()
  URL.revokeObjectURL(href)
}

const today = () => new Date().toISOString().slice(0, 10)

export const exportBookOrders = (filters: BookOrderFilters = {}) =>
  download('/admin/books/orders/export', filters, `kitob_sotuvlari_${today()}.xlsx`)

export const exportBookStockMoves = (
  params: { from?: string; to?: string; bookId?: string; onlyIn?: boolean } = {},
) => download('/admin/books/stock-moves/export', params, `kitob_ombor_${today()}.xlsx`)

export const exportBookAnalytics = (from?: string, to?: string) =>
  download('/admin/books/analytics/export', { from, to }, `kitob_hisobot_${today()}.xlsx`)
