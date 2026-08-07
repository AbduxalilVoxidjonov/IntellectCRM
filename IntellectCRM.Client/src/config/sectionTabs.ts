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

/**
 * FORMALAR bo'limi (O'quv bo'limi ichida): Lid formalari · Statistika · Daraja testlari.
 *
 * Ikki turdagi forma bitta bo'limda turadi, lekin RUXSATLARI har xil: lid formalari — `leads`
 * (ular lid ishlab chiqaradi), daraja testi esa tarixan `schedule` (kurs bilan bog'liq). Shu sabab
 * cardlar alohida-alohida yashiriladi — bir turi yopiq bo'lgan xodim ikkinchisini baribir ko'radi.
 */
export function formTabs(canForms: boolean, canTests: boolean): CardTabItem[] {
  return [
    // `end` — `/admin/forms/statistika` ochilganda «Lid formalari» ham faol bo'lib qolmasin
    { label: 'Lid formalari', to: '/admin/forms', end: true, hidden: !canForms },
    // ⚠️ Nomi ATAYIN «Lid statistikasi» — yonida «Daraja testlari» turgani uchun yalang
    // "Statistika" qaysi turga tegishli ekani noaniq bo'lardi (daraja testining O'Z statistikasi
    // ham bor: `/admin/level-tests/stats`).
    { label: 'Lid statistikasi', to: '/admin/forms/statistika', hidden: !canForms },
    { label: 'Daraja testlari', to: '/admin/level-tests', hidden: !canTests },
  ]
}

/** Xonalar (O'quv bo'limi ichida): Xonalar ro'yxati · Samaradorlik. */
export const roomTabs: CardTabItem[] = [
  { label: "Xonalar ro'yxati", to: '/admin/rooms', end: true },
  { label: 'Samaradorlik', to: '/admin/rooms/utilization' },
]
