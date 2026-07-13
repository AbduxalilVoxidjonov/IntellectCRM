import { useAuth } from '@/context/auth-context'

/** Bo'lim ichidagi amal: ko'rish / qo'shish / tahrir / o'chirish. */
export type PermAction = 'view' | 'create' | 'edit' | 'delete'

/** Amallar ro'yxati (rol berish UI'si va tekshiruvlar uchun yagona manba). */
export const PERM_ACTIONS: { key: PermAction; label: string }[] = [
  { key: 'view', label: "Ko'rish" },
  { key: 'create', label: "Qo'shish" },
  { key: 'edit', label: 'Tahrir' },
  { key: 'delete', label: "O'chirish" },
]

/**
 * Xodimning `permissions` ro'yxatida `section` bo'limi uchun `action` amaliga ruxsati bormi?
 *
 * Token turlari:
 *  - `permissions` = undefined/null → admin/superadmin (ruxsat cheklovi yo'q) → har doim `true`.
 *  - yalang `"section"` → shu bo'limda TO'LIQ ruxsat (barcha amallar) — eski ma'lumot/shablonlar.
 *  - `"section:action"` → faqat shu amal.
 *  - `view` — biror amal (create/edit/delete) ruxsati bo'lsa ham bo'limni ko'ra oladi.
 */
export function can(
  permissions: string[] | null | undefined,
  section: string,
  action: PermAction,
): boolean {
  if (!permissions) return true // admin/superadmin — cheklovsiz
  if (permissions.includes(section)) return true // yalang = to'liq
  if (permissions.includes(`${section}:${action}`)) return true
  // Ko'rish: shu bo'limda biror amal ruxsati bo'lsa — ko'rish ham ochiq.
  if (action === 'view') return permissions.some((p) => p.startsWith(`${section}:`))
  return false
}

/** Joriy foydalanuvchining ruxsatiga bog'langan tekshiruv: `can('students', 'edit')`. */
export function usePerm() {
  const { user } = useAuth()
  const perms = user?.permissions
  return {
    /** Bo'lim + amalga ruxsat bormi? */
    can: (section: string, action: PermAction) => can(perms, section, action),
  }
}

// ---------- Rol berish (matritsa) yordamchilari ----------

const ALL_ACTIONS: PermAction[] = ['view', 'create', 'edit', 'delete']

/**
 * Ruxsat tokenlari to'plamidan bir bo'lim uchun TANLANGAN amallarni chiqaradi.
 * Yalang `"section"` → barcha amallar. Biror amal (create/edit/delete) bo'lsa `view` ham qo'shiladi.
 */
export function sectionActions(perms: Set<string>, section: string): Set<PermAction> {
  if (perms.has(section)) return new Set(ALL_ACTIONS)
  const out = new Set<PermAction>()
  for (const a of ALL_ACTIONS) if (perms.has(`${section}:${a}`)) out.add(a)
  if (out.size > 0) out.add('view')
  return out
}

/**
 * Bir bo'limning amallar to'plamini token to'plamiga qayta yozadi (mavjud shu bo'lim tokenlarini
 * almashtiradi). Barcha 4 amal tanlansa — yalang `"section"` (ixcham, backward-compat) saqlanadi.
 */
export function writeSection(perms: Set<string>, section: string, acts: Set<PermAction>): Set<string> {
  const next = new Set(perms)
  next.delete(section)
  for (const a of ALL_ACTIONS) next.delete(`${section}:${a}`)
  if (acts.size === 0) return next
  if (ALL_ACTIONS.every((a) => acts.has(a))) {
    next.add(section) // to'liq → yalang
    return next
  }
  for (const a of acts) next.add(`${section}:${a}`)
  return next
}

/**
 * Matritsada bitta katakni bosish: shu bo'lim+amalni almashtiradi.
 * Qoidalar: yozish amali (create/edit/delete) yoqilsa `view` ham yoqiladi; `view` o'chirilsa
 * shu bo'limning barcha amallari o'chadi (ko'rmasdan yozib bo'lmaydi).
 */
export function toggleSectionAction(
  perms: Set<string>,
  section: string,
  action: PermAction,
): Set<string> {
  const acts = sectionActions(perms, section)
  if (acts.has(action)) {
    acts.delete(action)
    if (action === 'view') acts.clear()
  } else {
    acts.add(action)
    if (action !== 'view') acts.add('view')
  }
  return writeSection(perms, section, acts)
}
