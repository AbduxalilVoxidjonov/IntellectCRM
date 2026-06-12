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
  MessageSquare,
  ClipboardCheck,
  Settings,
  Smartphone,
  BarChart3,
  Building2,
  BookOpen,
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
      label: "O'quvchilar",
      to: '/admin/students',
      icon: Users,
      perm: 'students',
      children: [
        { label: "O'quvchilar ro'yxati", to: '/admin/students', end: true },
        { label: 'Turniket', to: '/admin/students/turniket' },
        { label: "O'quvchilarga feedback", to: '/admin/students/baholash' },
        { label: 'Feedback nomi', to: '/admin/students/baholash-turlari' },
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
        { label: 'Oylik hisoblash', to: '/admin/teachers/salary' },
      ],
    },
    { label: 'Guruhlar', to: '/admin/classes', icon: School, perm: 'classes' },
    {
      label: "O'quv bo'limi",
      to: '/admin/oquv-bolimi',
      icon: BookOpen,
      children: [
        { label: 'Kurslar', to: '/admin/subjects', perm: 'schedule' },
        { label: 'Daraja testi', to: '/admin/level-tests', perm: 'schedule' },
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
    {
      label: 'Ilova',
      to: '/admin/assignments',
      icon: Smartphone,
      perm: 'app',
      children: [
        { label: 'Topshiriqlar', to: '/admin/assignments' },
        { label: 'Topshiriqlar bali', to: '/admin/assignment-scores' },
        { label: "Ta'lim (LMS)", to: '/admin/lms' },
        { label: 'Joylashuv', to: '/admin/locations' },
        { label: 'Ota-onalar', to: '/admin/parents' },
        { label: "O'qituvchilar", to: '/admin/app/teachers' },
      ],
    },
    { label: "O'qituvchilar hisoboti", to: '/admin/teacher-reports', icon: BarChart3, perm: 'teacherReports' },
    { label: 'Moliya', to: '/admin/finance', icon: Wallet, perm: 'finance' },
    {
      label: 'Boshqaruv',
      to: '/admin/boshqaruv/staff',
      icon: Building2,
      children: [
        { label: 'Kameralar', to: '/admin/boshqaruv/cameras', perm: 'cameras' },
        { label: 'Filiallar', to: '/admin/boshqaruv/branches', roles: ['superadmin'] },
        { label: 'Xodimlar va rollar', to: '/admin/boshqaruv/staff', perm: 'staff' },
        { label: 'Taklif va shikoyatlar', to: '/admin/boshqaruv/feedback', perm: 'feedback' },
      ],
    },
    {
      label: 'Sozlamalar',
      to: '/admin/settings/school',
      icon: Settings,
      perm: 'settings',
      children: [
        { label: "Markaz ma'lumotlari", to: '/admin/settings/school' },
        { label: 'Telegram bot', to: '/admin/settings/telegram' },
        { label: 'Push (Firebase)', to: '/admin/settings/firebase' },
        { label: 'Turniket integratsiya', to: '/admin/settings/turnstile' },
        { label: 'Kamera integratsiya', to: '/admin/settings/cameras' },
        { label: "To'lov eslatmasi", to: '/admin/settings/payment-reminders' },
      ],
    },
  ],
  teacher: [
    { label: 'Bosh sahifa', to: '/teacher', icon: LayoutDashboard },
    { label: 'Jurnal', to: '/teacher/journal', icon: NotebookText, perm: 'journal' },
    { label: 'Feedback', to: '/teacher/evaluation', icon: ClipboardList },
    { label: 'Topshiriqlar', to: '/teacher/assignments', icon: ClipboardCheck, perm: 'assignments' },
    { label: "Ta'lim (LMS)", to: '/teacher/lms', icon: BookOpen },
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
  // O'quvchi/ota-ona web orqali kira olmaydi (mobil ilova) — login sahifasiga.
  student: '/login',
  parent: '/login',
  staff: '/admin',
}

export const roleLabels: Record<Role, string> = {
  superadmin: 'Tizim egasi',
  admin: 'Administrator',
  teacher: "O'qituvchi",
  student: "O'quvchi",
  parent: 'Ota-ona',
  staff: 'Xodim',
}
