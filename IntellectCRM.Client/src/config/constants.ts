import type { ClassLanguage, FinanceDirection, Gender, MonthStatus } from '@/types'

export const genderLabels: Record<Gender, string> = {
  male: 'Erkak',
  female: 'Ayol',
}

export const genderOptions: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Erkak' },
  { value: 'female', label: 'Ayol' },
]

/** O'qituvchi toifalari (vestigial — maosh endi per-guruh, o'qituvchi "Maosh" tabida belgilanadi) */
export const teacherCategories: { value: string; label: string }[] = [
  { value: 'oliy', label: 'Oliy toifa' },
  { value: '1', label: '1-toifa' },
  { value: '2', label: '2-toifa' },
  { value: 'mutaxasis', label: 'Mutaxasis' },
]
export const teacherCategoryLabel = (c?: string): string =>
  teacherCategories.find((x) => x.value === c)?.label ?? '—'

/**
 * Lid manbalari (CRM) — FALLBACK: manbalar endi serverdan (`/admin/lead-sources`,
 * Sozlamalar → Sabablar → "Lid manbalari") keladi; bu ro'yxat faqat server bo'sh/xato
 * bo'lganda ishlatiladi (LeadFormModal, LeadsPage filtri).
 */
export const leadSourceOptions: string[] = [
  'Instagram',
  'Referral',
  'Sayt',
  'Telegram',
  'Tashrif',
  'Boshqa',
]

export const languageLabels: Record<ClassLanguage, string> = {
  uz: "O'zbek",
  ru: 'Rus',
}

export const languageOptions: { value: ClassLanguage; label: string }[] = [
  { value: 'uz', label: "O'zbek" },
  { value: 'ru', label: 'Rus' },
]

/**
 * Xodimlar (barcha o'qituvchi + admin) umumiy guruh chati uchun maxsus kanal kaliti.
 * Backenddagi ChatService.StaffChannel bilan bir xil bo'lishi shart.
 */
export const STAFF_CHANNEL = '__xodimlar__'
/** Xodimlar kanalining ko'rsatiladigan nomi */
export const STAFF_CHANNEL_LABEL = 'Xodimlar'

/** O'qituvchi web paneli bo'limlari (admin ruxsat beradi). Kalitlar backend bilan bir xil. */
export const teacherPermissions: { key: string; label: string }[] = [
  { key: 'journal', label: 'Jurnal' },
  { key: 'assignments', label: 'Topshiriqlar' },
  { key: 'schedule', label: 'Dars jadvali' },
  { key: 'messages', label: 'Xabarlar (chat)' },
  { key: 'salary', label: 'Maosh' },
]

/**
 * Xodim (role="staff") admin panelida ko'ra oladigan bo'limlar. Kalitlar nav (navigation.ts)
 * va route himoyasi (RequirePerm) bilan bir xil. Superadmin "Xodimlar va rollar" bo'limida belgilaydi.
 * (Filiallar bu ro'yxatda yo'q — u faqat superadmin uchun.)
 */
export const adminPermissions: { key: string; label: string }[] = [
  { key: 'marketing', label: 'Marketing' },
  { key: 'leads', label: 'Lidlar' },
  { key: 'students', label: "O'quvchilar" },
  { key: 'teachers', label: "O'qituvchilar" },
  { key: 'schedule', label: 'Kurslar' },
  { key: 'classes', label: 'Guruhlar' },
  { key: 'messages', label: 'Xabarlar' },
  { key: 'app', label: 'Ilova' },
  { key: 'teacherReports', label: "O'qituvchilar hisoboti" },
  { key: 'contracts', label: 'Shartnomalar' },
  { key: 'finance', label: 'Moliya' },
  { key: 'settings', label: 'Sozlamalar' },
  { key: 'staff', label: 'Xodimlar' },
  { key: 'feedback', label: 'Taklif va shikoyatlar' },
  { key: 'cameras', label: 'Kameralar' },
  { key: 'discipline', label: 'Intizomiy ball' },
  { key: 'calls', label: 'Call Center' },
  // Bosh sahifadagi markaz AI tahlili — DEFAULT faqat superadmin ko'radi; xodimga shu yerdan
  // ruxsat beriladi ("Ko'rish" = karta ko'rinadi, "Qo'shish" = qo'lda tahlil yaratish tugmasi).
  { key: 'ai', label: 'AI tahlil (bosh sahifa)' },
]

/* ---------- Moliya ---------- */

export const financeDirectionLabels: Record<FinanceDirection, string> = {
  income: 'Kirim',
  expense: 'Chiqim',
}

export interface CategoryOption {
  value: string
  label: string
}

/** Kirim toifalari */
export const incomeCategories: CategoryOption[] = [
  { value: 'tuition', label: "O'quvchi to'lovi" },
  { value: 'donation', label: 'Homiylik' },
  { value: 'rent_in', label: 'Ijaradan kirim' },
  { value: 'other', label: 'Boshqa kirim' },
]

/** Chiqim toifalari */
export const expenseCategories: CategoryOption[] = [
  { value: 'salary', label: 'Oylik maosh' },
  { value: 'utilities', label: 'Kommunal' },
  { value: 'supplies', label: 'Jihoz/materiallar' },
  { value: 'rent', label: 'Ijara' },
  { value: 'repair', label: "Ta'mirlash" },
  { value: 'other', label: 'Boshqa chiqim' },
]

export const categoriesByDirection: Record<FinanceDirection, CategoryOption[]> = {
  income: incomeCategories,
  expense: expenseCategories,
}

/** Toifa kodini o'qiladigan nomga aylantirish */
export function financeCategoryLabel(category: string): string {
  // Vozvrat — qo'lda kiritilmaydi (faqat to'lovdan qaytariladi), shuning uchun kategoriya ro'yxatida yo'q.
  if (category === 'refund') return 'Vozvrat'
  const all = [...incomeCategories, ...expenseCategories]
  return all.find((c) => c.value === category)?.label ?? category
}

/** To'lov usullari (kirim/to'lov uchun): kod -> yorliq. */
export const paymentMethods: { value: string; label: string }[] = [
  { value: 'cash', label: 'Naqd' },
  { value: 'card', label: 'Karta' },
  { value: 'bank', label: 'Bank orqali' },
]
/** To'lov usuli kodidan yorliq ("cash" -> "Naqd"). Bo'sh/noma'lum -> "—". */
export function paymentMethodLabel(method?: string | null): string {
  if (!method) return '—'
  return paymentMethods.find((m) => m.value === method)?.label ?? method
}

/** Qisqa o'zbekcha oy nomlari (1-12) */
export const monthShortNames: string[] = [
  'Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn',
  'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek',
]

/** "YYYY-MM" -> "May 2026" */
export function formatMonth(ym: string): string {
  const [y, m] = ym.split('-')
  return `${monthShortNames[Number(m) - 1] ?? m} ${y}`
}

export const monthStatusLabels: Record<MonthStatus, string> = {
  paid: "To'langan",
  partial: 'Qisman',
  unpaid: "To'lanmagan",
}

/**
 * O'quvchining holat belgisi (qidiruv natijalari va ro'yxatlar uchun). Arxiv eng ustun,
 * so'ng a'zolik holati (`Student.memberState`: active | trial | frozen | "").
 * `null` — normal holat (aktiv), belgi ko'rsatilmaydi.
 */
export function studentStateBadge(
  memberState?: string,
  isArchived?: boolean,
): { label: string; className: string } | null {
  if (isArchived) return { label: 'arxiv', className: 'bg-amber-100 text-amber-700' }
  if (memberState === 'frozen') return { label: 'muzlatilgan', className: 'bg-sky-100 text-sky-700' }
  if (memberState === 'trial') return { label: 'sinov', className: 'bg-violet-100 text-violet-700' }
  return null
}
