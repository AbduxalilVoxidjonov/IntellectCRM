import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  UserPlus,
  Users,
  GraduationCap,
  School,
  NotebookText,
  ClipboardList,
  Wallet,
  Banknote,
  MessageSquare,
  ClipboardCheck,
  Settings,
  Smartphone,
  Building2,
  BookOpen,
  Archive,
  DoorOpen,
  Megaphone,
  Headset,
  PhoneCall,
} from 'lucide-react'
import type { Role } from '@/types'

export interface NavChild {
  label: string
  to: string
  /** NavLink exact match (faqat shu manzilda faol) */
  end?: boolean
  /** Faqat shu rollarga ko'rinadi (yo'q = barcha rollarga) */
  roles?: Role[]
  /** Ruxsat kaliti — xodim (staff) shu bo'limga ega bo'lsagina ko'rinadi */
  perm?: string
  /** Ichki bo'lim (3-daraja) — masalan "O'quv bo'limi" → "Guruhlar" → "Reyting" */
  children?: NavChild[]
}

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  children?: NavChild[]
  /** Bo'lim ruxsat kaliti (o'qituvchi/xodim filtri uchun; yo'q = har doim ko'rinadi) */
  perm?: string
  /** Faqat shu rollarga ko'rinadi (yo'q = barcha rollarga) */
  roles?: Role[]
}

/** Har bir rol uchun yon menyu (sidebar) elementlari */
export const navByRole: Record<Role, NavItem[]> = {
  admin: [
    { label: 'Bosh sahifa', to: '/admin', icon: LayoutDashboard },
    {
      label: 'Lidlar',
      to: '/admin/leads',
      icon: UserPlus,
      perm: 'leads',
      children: [
        { label: 'Lidlar (Kanban)', to: '/admin/leads', end: true },
        { label: 'CRM statistika', to: '/admin/crm-stats', perm: 'leads' },
      ],
    },
    {
      // Guruhning O'ZIDA `perm` YO'Q — bolalarga ko'chirilgan ("Sozlamalar" bilan bir xil sabab):
      // "Bog'lanish kerak" boshqa ruxsat (`contacts`) bilan ishlaydi, guruhda `perm: 'students'`
      // qolsa faqat `contacts` berilgan operator uni umuman ko'rmasdi. Bolalari qolmagan guruhni
      // Sidebar o'zi yashiradi (filterNav) — ruxsatsiz xodimga guruh baribir ko'rinmaydi.
      label: "O'quvchilar",
      to: '/admin/students',
      icon: Users,
      children: [
        { label: "O'quvchilar ro'yxati", to: '/admin/students', end: true, perm: 'students' },
        { label: "Bog'lanish kerak", to: '/admin/students/boglanish', perm: 'contacts' },
        { label: "O'quvchilar davomati", to: '/admin/students/davomat', perm: 'students' },
        { label: 'Bonus hisoboti', to: '/admin/students/bonus', perm: 'students' },
        { label: 'Turniket', to: '/admin/students/turniket', perm: 'students' },
        { label: "O'quvchilarga feedback", to: '/admin/students/baholash', perm: 'students' },
        { label: 'Feedback nomi', to: '/admin/students/baholash-turlari', perm: 'students' },
      ],
    },
    {
      label: "O'qituvchilar",
      to: '/admin/teachers',
      icon: GraduationCap,
      perm: 'teachers',
      children: [
        { label: "O'qituvchilar ro'yxati", to: '/admin/teachers', end: true },
        { label: "O'qituvchilar davomati", to: '/admin/teachers/attendance' },
        { label: "O'qituvchilar hisoboti", to: '/admin/teacher-reports', perm: 'teacherReports' },
      ],
    },
    { label: 'Guruhlar', to: '/admin/classes', icon: School, perm: 'classes' },
    {
      label: 'Xonalar',
      to: '/admin/rooms',
      icon: DoorOpen,
      perm: 'classes',
      children: [
        { label: "Xonalar ro'yxati", to: '/admin/rooms', end: true },
        { label: 'Samaradorlik', to: '/admin/rooms/utilization' },
      ],
    },
    {
      label: "O'quv bo'limi",
      to: '/admin/oquv-bolimi',
      icon: BookOpen,
      children: [
        { label: 'Kurslar', to: '/admin/subjects', perm: 'schedule' },
        { label: 'Kurslar analitikasi', to: '/admin/subjects/analitika', perm: 'schedule' },
        { label: "O'quv dasturi", to: '/admin/curricula', perm: 'schedule' },
        { label: 'Baholash mezonlari', to: '/admin/grading', perm: 'schedule' },
        { label: 'Testlar natijalari', to: '/admin/test-results', perm: 'classes' },
        { label: 'Daraja testi', to: '/admin/level-tests', perm: 'schedule' },
        { label: 'Kitoblar sotuvi', to: '/admin/books', perm: 'books' },
        { label: 'Sabablar', to: '/admin/reasons', perm: 'settings' },
        {
          label: 'Intizomiy ball',
          to: '/admin/discipline',
          perm: 'discipline',
          children: [
            { label: 'Ballar nazorati', to: '/admin/discipline', end: true },
            { label: 'Ball sabablar', to: '/admin/discipline/reasons' },
          ],
        },
        { label: 'Shartnomalar', to: '/admin/contracts', perm: 'contracts' },
      ],
    },
    { label: 'Xabarlar', to: '/admin/messages', icon: MessageSquare, perm: 'messages' },
    { label: 'Support Telegram', to: '/admin/support-telegram', icon: Headset, perm: 'messages' },
    {
      label: 'Ilova',
      to: '/admin/assignments',
      icon: Smartphone,
      perm: 'app',
      children: [
        { label: 'Topshiriqlar', to: '/admin/assignments' },
        { label: 'Topshiriqlar bali', to: '/admin/assignment-scores' },
        { label: 'AI check', to: '/admin/ai-check' },
        { label: 'Support', to: '/admin/support' },
        { label: 'Joylashuv', to: '/admin/locations' },
        { label: 'Ota-onalar', to: '/admin/parents' },
        { label: "O'qituvchilar", to: '/admin/app/teachers' },
      ],
    },
    {
      label: 'Call Center', to: '/admin/calls', icon: PhoneCall, perm: 'calls',
      children: [
        { label: "Bulut (MoiZvonki)", to: '/admin/calls', end: true },
        { label: 'Local Call', to: '/admin/calls/local' },
      ],
    },
    { label: 'Kassa', to: '/admin/kassa', icon: Banknote, perm: 'kassa' },
    { label: 'Moliya', to: '/admin/finance', icon: Wallet, perm: 'finance' },
    {
      label: 'Marketing',
      to: '/admin/marketing',
      icon: Megaphone,
      perm: 'marketing',
      children: [
        { label: 'Boshqaruv paneli', to: '/admin/marketing', end: true },
        { label: 'Inbox', to: '/admin/marketing/inbox' },
        { label: 'Javob qoidalari', to: '/admin/marketing/rules' },
        { label: 'Kanallar', to: '/admin/marketing/channels' },
        { label: 'AI yordamchi', to: '/admin/marketing/ai' },
        { label: 'Analitika', to: '/admin/marketing/analytics' },
      ],
    },
    {
      label: 'Boshqaruv',
      to: '/admin/boshqaruv/staff',
      icon: Building2,
      children: [
        { label: 'Vakansiyalar', to: '/admin/boshqaruv/vacancies', perm: 'vacancies' },
        { label: 'Kameralar', to: '/admin/boshqaruv/cameras', perm: 'cameras' },
        { label: 'Filiallar', to: '/admin/boshqaruv/branches', roles: ['superadmin'] },
        { label: 'Adminga topshiriq', to: '/admin/boshqaruv/staff-tasks', roles: ['superadmin'] },
        { label: 'Xodimlar va rollar', to: '/admin/boshqaruv/staff', perm: 'staff' },
        { label: 'Taklif va shikoyatlar', to: '/admin/boshqaruv/feedback', perm: 'feedback' },
      ],
    },
    {
      // DIQQAT: guruhning O'ZIDA `perm` YO'Q — u ATAYIN bolalarga ko'chirilgan. Sabab:
      // "O'zgarishlar tarixi" boshqa ruxsat (`audit`) bilan ishlaydi, guruhda `perm: 'settings'`
      // qolsa faqat `audit` berilgan xodim uni umuman ko'rmasdi. Sidebar bolalari qolmagan
      // guruhni o'zi yashiradi (filterNav), ya'ni ruxsatsiz xodimga guruh baribir ko'rinmaydi.
      label: 'Sozlamalar',
      to: '/admin/settings/school',
      icon: Settings,
      children: [
        { label: "Markaz ma'lumotlari", to: '/admin/settings/school', perm: 'settings' },
        { label: 'Tuman va maktablar', to: '/admin/districts', perm: 'settings' },
        { label: 'Xabar kanallari', to: '/admin/settings/channels', perm: 'settings' },
        { label: 'Zaxira nusxa', to: '/admin/settings/backup', perm: 'settings' },
        { label: 'Mobil ilova (APK)', to: '/admin/settings/apk', perm: 'settings' },
        { label: 'Speaking (Azure)', to: '/admin/settings/azure-speech', perm: 'settings' },
        { label: 'AI Tahlil (Gemini)', to: '/admin/settings/gemini', perm: 'settings' },
        { label: "To'lov cheki", to: '/admin/settings/check', perm: 'settings' },
        { label: 'Turniket integratsiya', to: '/admin/settings/turnstile', perm: 'settings' },
        { label: 'Kamera integratsiya', to: '/admin/settings/cameras', perm: 'settings' },
        { label: "O'zgarishlar tarixi", to: '/admin/settings/history', perm: 'audit' },
      ],
    },
    { label: 'Arxiv', to: '/admin/archive', icon: Archive, perm: 'settings' },
  ],
  teacher: [
    { label: 'Bosh sahifa', to: '/teacher', icon: LayoutDashboard },
    { label: 'Jurnal', to: '/teacher/journal', icon: NotebookText, perm: 'journal' },
    { label: 'Feedback', to: '/teacher/evaluation', icon: ClipboardList },
    // Asosiy navigatsiyada "Test" (onlayn/oflayn test yaratish); Topshiriqlar profil menyusida.
    { label: 'Test', to: '/teacher/tests', icon: ClipboardCheck, perm: 'journal' },
    { label: 'Xabarlar', to: '/teacher/messages', icon: MessageSquare, perm: 'messages' },
  ],
  student: [{ label: 'Bosh sahifa', to: '/student', icon: LayoutDashboard }],
  parent: [{ label: 'Bosh sahifa', to: '/parent', icon: LayoutDashboard }],
  // Superadmin admin bilan bir xil nav'ni ishlatadi (qo'shimcha menyusiz, faqat ruxsat farqli)
  superadmin: [],
  // Xodim ham admin nav'ini ishlatadi — Sidebar uni permissions bo'yicha filtrlaydi
  staff: [],
}

// Superadmin va xodim admin nav'ini qayta ishlatadi (Sidebar rol/ruxsat bo'yicha filtrlaydi).
navByRole.superadmin = navByRole.admin
navByRole.staff = navByRole.admin

/** Rol bo'yicha asosiy sahifa manzili */
export const homeByRole: Record<Role, string> = {
  superadmin: '/admin',
  admin: '/admin',
  teacher: '/teacher',
  // O'quvchi va ota-ona — o'quvchi portali (mobil web ilova).
  student: '/student',
  parent: '/student',
  staff: '/admin',
}

/**
 * FAQAT KASSA xodimimi? — ruxsatlari orasida boshqa bo'lim yo'q (masalan `["kassa"]` yoki
 * `["kassa:create"]`). Bunday xodim uchun admin paneli (bosh sahifa, yon menyu) KERAK EMAS:
 * u telefondagi kassa portalida (`/kassa`) ishlaydi.
 */
export function isKassaOnly(user: { role: Role; permissions?: string[] | null } | null): boolean {
  if (!user || user.role !== 'staff') return false
  const perms = user.permissions ?? []
  if (perms.length === 0) return false
  const sections = new Set(perms.map((p) => p.split(':')[0]))
  return sections.size === 1 && sections.has('kassa')
}

/** Foydalanuvchining bosh sahifasi — rol, kassa xodimi uchun esa kassa portali. */
export function homeFor(user: { role: Role; permissions?: string[] | null } | null): string {
  if (!user) return '/login'
  if (isKassaOnly(user)) return '/kassa'
  return homeByRole[user.role]
}

export const roleLabels: Record<Role, string> = {
  superadmin: 'Tizim egasi',
  admin: 'Administrator',
  teacher: "O'qituvchi",
  student: "O'quvchi",
  parent: 'Ota-ona',
  staff: 'Xodim',
}
