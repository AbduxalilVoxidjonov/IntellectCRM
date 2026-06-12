import type { LucideIcon } from 'lucide-react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  /** Ikon foni uchun tailwind class, masalan "bg-brand-50" */
  iconBg?: string
  /** Ikon rangi uchun tailwind class, masalan "text-brand-600" */
  iconColor?: string
  hint?: string
  /** O'zgarish ko'rsatkichi: {value:"+12%", dir:"up"|"down"} */
  delta?: { value: string; dir: 'up' | 'down' }
}

export function StatCard({
  label,
  value,
  icon: Icon,
  iconBg = 'bg-brand-50',
  iconColor = 'text-brand-600',
  hint,
  delta,
}: StatCardProps) {
  return (
    <div className="flex flex-col gap-2.5 overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-[var(--shadow-1)]">
      <div className="flex items-start justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {label}
        </span>
        <div
          className={cn('flex h-8 w-8 items-center justify-center rounded-lg', iconBg, iconColor)}
        >
          <Icon className="h-[18px] w-[18px]" />
        </div>
      </div>
      <div className="font-mono text-[26px] font-semibold leading-none tracking-tight text-slate-800">
        {value}
      </div>
      {(delta || hint) && (
        <div className="flex items-center gap-2 text-xs">
          {delta && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-mono font-semibold',
                delta.dir === 'up'
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-red-50 text-red-600',
              )}
            >
              {delta.dir === 'up' ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {delta.value}
            </span>
          )}
          {hint && <span className="text-slate-400">{hint}</span>}
        </div>
      )}
    </div>
  )
}
