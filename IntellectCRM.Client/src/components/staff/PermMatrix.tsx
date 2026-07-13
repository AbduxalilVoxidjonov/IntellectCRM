import { adminPermissions } from '@/config/constants'
import { PERM_ACTIONS, sectionActions, type PermAction } from '@/lib/permissions'
import { cn } from '@/lib/utils'

interface Props {
  /** Joriy ruxsat tokenlari to'plami (yalang "section" yoki "section:action"). */
  perms: Set<string>
  /** Katak bosilganda — shu bo'lim+amalni almashtirish (chaqiruvchi toggleSectionAction'ni qo'llaydi). */
  onToggle: (section: string, action: PermAction) => void
}

/**
 * Rol berish matritsasi: har bo'lim (qator) × 4 amal (Ko'rish/Qo'shish/Tahrir/O'chirish) katakchalari.
 * StaffPage'da ham yangi xodim formasida, ham xodim kartasi ruxsatlarida bir xil ishlatiladi.
 */
export function PermMatrix({ perms, onToggle }: Props) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
            <th className="px-3 py-2 text-left font-semibold">Bo'lim</th>
            {PERM_ACTIONS.map((a) => (
              <th key={a.key} className="px-2 py-2 text-center font-semibold">
                {a.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {adminPermissions.map((p) => {
            const acts = sectionActions(perms, p.key)
            return (
              <tr key={p.key} className="hover:bg-slate-50/60">
                <td className="px-3 py-1.5 font-medium text-slate-700">{p.label}</td>
                {PERM_ACTIONS.map((a) => {
                  const checked = acts.has(a.key)
                  return (
                    <td key={a.key} className="px-2 py-1.5 text-center">
                      <label className="inline-flex cursor-pointer items-center justify-center">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => onToggle(p.key, a.key)}
                          className={cn(
                            'h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-400 focus:ring-offset-0',
                          )}
                        />
                      </label>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
