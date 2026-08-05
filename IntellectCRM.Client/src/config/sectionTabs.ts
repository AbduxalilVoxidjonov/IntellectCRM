import type { CardTabItem } from '@/components/ui/CardTabs'

/**
 * Bir bo'limning ichki sahifalari — `CardTabs` uchun yagona manba.
 *
 * Menyuda bo'lim BITTA band bo'lib turadi, sahifalar orasida esa shu cardlar orqali o'tiladi
 * (marshrutlar o'zgarmaydi — eski havolalar ishlayveradi).
 */

/**
 * O'qituvchilar bo'limi: Ro'yxati · Davomati · Hisoboti.
 * «Hisoboti» alohida ruxsat (`teacherReports`) talab qiladi — sidebar'dagi qoida bilan bir xil.
 */
export function teacherTabs(canSeeReports: boolean): CardTabItem[] {
  return [
    // `end` — `/admin/teachers/attendance` ochilganda «Ro'yxati» ham faol bo'lib qolmasin
    { label: "Ro'yxati", to: '/admin/teachers', end: true },
    { label: 'Davomati', to: '/admin/teachers/attendance' },
    { label: 'Hisoboti', to: '/admin/teacher-reports', hidden: !canSeeReports },
  ]
}

/** Xonalar (O'quv bo'limi ichida): Xonalar ro'yxati · Samaradorlik. */
export const roomTabs: CardTabItem[] = [
  { label: "Xonalar ro'yxati", to: '/admin/rooms', end: true },
  { label: 'Samaradorlik', to: '/admin/rooms/utilization' },
]
