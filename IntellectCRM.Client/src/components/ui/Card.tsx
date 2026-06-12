import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface CardProps {
  className?: string
  children: ReactNode
  /** Sarlavha — berilsa card-header ko'rsatiladi */
  title?: ReactNode
  /** Sarlavha ostidagi kichik izoh */
  sub?: ReactNode
  /** Sarlavhaning o'ng tomonidagi amallar (tugmalar) */
  actions?: ReactNode
  /** Ichki padding'siz (jadval/list uchun) */
  tight?: boolean
  /** Tana uchun qo'shimcha class (tight bo'lmaganda) */
  bodyClassName?: string
}

export function Card({
  className,
  children,
  title,
  sub,
  actions,
  tight,
  bodyClassName,
}: CardProps) {
  const hasHeader = title != null || actions != null

  // Backward-compatible: sarlavhasiz va tight bo'lmaganda — eski "padded div" ko'rinishi
  if (!hasHeader && !tight) {
    return (
      <div
        className={cn(
          'rounded-xl border border-slate-200 bg-white p-5 shadow-[var(--shadow-1)]',
          className,
        )}
      >
        {children}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200 bg-white shadow-[var(--shadow-1)]',
        className,
      )}
    >
      {hasHeader && (
        <div className="flex items-center justify-between border-b border-slate-100 px-[18px] py-4">
          <div className="min-w-0">
            {title != null && (
              <h3 className="text-sm font-bold tracking-tight text-slate-800">{title}</h3>
            )}
            {sub != null && <p className="mt-0.5 text-xs font-medium text-slate-400">{sub}</p>}
          </div>
          {actions != null && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {tight ? children : <div className={cn('p-[18px]', bodyClassName)}>{children}</div>}
    </div>
  )
}
