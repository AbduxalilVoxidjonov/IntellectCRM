import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: ReactNode
  sub?: ReactNode
  /** O'ng tomondagi amallar (tugmalar, filtrlar) */
  actions?: ReactNode
  className?: string
}

/** Sahifa sarlavhasi — crm/ namuna `.page-header` ko'rinishida. */
export function PageHeader({ title, sub, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'mb-5 flex flex-wrap items-end justify-between gap-4',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">{title}</h1>
        {sub != null && <p className="mt-1 text-sm text-slate-400">{sub}</p>}
      </div>
      {actions != null && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
