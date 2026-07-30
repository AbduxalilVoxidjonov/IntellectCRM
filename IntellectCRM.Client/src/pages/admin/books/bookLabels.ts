import type { BookOrderStatus, BookPaymentMethod, BookStockReason } from '@/api/services/books'

/** Buyurtma holati — o'zbekcha yorliq (backend `BookSalesService.StatusLabel` bilan bir xil). */
export function statusLabel(status: BookOrderStatus | string): string {
  switch (status) {
    case 'approved':
      return 'Tasdiqlangan'
    case 'rejected':
      return 'Rad etilgan'
    default:
      return 'Kutilmoqda'
  }
}

/** Holat belgisi (pill) uchun tailwind classlar. */
export function statusPillCls(status: BookOrderStatus | string): string {
  const base = 'inline-block rounded px-2 py-0.5 text-xs font-semibold'
  switch (status) {
    case 'approved':
      return `${base} bg-emerald-50 text-emerald-700`
    case 'rejected':
      return `${base} bg-red-50 text-red-700`
    default:
      return `${base} bg-amber-50 text-amber-700`
  }
}

/** To'lov turi: naqd / karta (avtomatik to'lov tizimi ishlatilmaydi). */
export function paymentLabel(method: BookPaymentMethod | string): string {
  return method === 'card' ? 'Karta' : 'Naqd'
}

/** Ombor harakati turi. */
export function stockReasonLabel(reason: BookStockReason | string): string {
  switch (reason) {
    case 'initial':
      return "Boshlang'ich qoldiq"
    case 'restock':
      return 'Kirim'
    case 'sale':
      return 'Sotuv'
    case 'correction':
      return 'Korreksiya'
    default:
      return reason
  }
}
