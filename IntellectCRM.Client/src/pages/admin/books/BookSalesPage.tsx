import { useCallback, useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ShoppingCart, Package, BarChart3, CreditCard, Wallet } from 'lucide-react'
import { getPendingBookOrderCount } from '@/api/services/books'
import { PageHeader } from '@/components/ui/PageHeader'
import { cn } from '@/lib/utils'
import { usePerm } from '@/lib/permissions'
import { BookOrdersTab } from './BookOrdersTab'
import { BookCardPaymentsTab } from './BookCardPaymentsTab'
import { BookInventoryTab } from './BookInventoryTab'
import { BookAnalyticsTab } from './BookAnalyticsTab'
import { BookSettingsTab } from './BookSettingsTab'

type Tab = 'orders' | 'card' | 'inventory' | 'analytics' | 'settings'

/**
 * KITOBLAR SOTUVI — bitta sahifa, 5 tab:
 *  • Buyurtmalar — botdan tushgan so'rovlarni tasdiqlash/rad etish (chek rasmi bilan);
 *  • Karta to'lovlari — kartaga o'tkazma qilganlar: chek rasmi ro'yxatda ko'rinadi,
 *    tepada shu kartaga hisoblangan jami summa;
 *  • Ombor — kitob yaratish/tahrirlash, narx, qoldiq kirim + kirim tarixi;
 *  • Analitika — sotuv/tushum (naqd/karta), kunlik grafik, top kitoblar, qoldiq;
 *  • Sozlamalar — botda ko'rinadigan karta rekvizitlari.
 */
export function BookSalesPage() {
  const { can } = usePerm()
  const [tab, setTab] = useState<Tab>('orders')
  const [pending, setPending] = useState(0)

  const refreshPending = useCallback(() => {
    getPendingBookOrderCount()
      .then(setPending)
      .catch(() => setPending(0))
  }, [])

  useEffect(refreshPending, [refreshPending])

  return (
    <div>
      <PageHeader
        title="Kitoblar sotuvi"
        sub="Botdan tushgan buyurtmalar, ombor qoldig'i va sotuv hisobotlari"
        actions={
          <div className="tabs">
            <TabButton active={tab === 'orders'} onClick={() => setTab('orders')} icon={ShoppingCart}>
              <span className="inline-flex items-center gap-1.5">
                Buyurtmalar
                {pending > 0 && (
                  <span className="rounded-full bg-red-500 px-1.5 py-px text-[11px] font-bold text-white">
                    {pending}
                  </span>
                )}
              </span>
            </TabButton>
            <TabButton active={tab === 'card'} onClick={() => setTab('card')} icon={Wallet}>
              Karta to'lovlari
            </TabButton>
            <TabButton active={tab === 'inventory'} onClick={() => setTab('inventory')} icon={Package}>
              Ombor
            </TabButton>
            <TabButton active={tab === 'analytics'} onClick={() => setTab('analytics')} icon={BarChart3}>
              Analitika
            </TabButton>
            <TabButton active={tab === 'settings'} onClick={() => setTab('settings')} icon={CreditCard}>
              Sozlamalar
            </TabButton>
          </div>
        }
      />

      {tab === 'orders' ? (
        <BookOrdersTab canDecide={can('books', 'edit')} onDecided={refreshPending} />
      ) : tab === 'card' ? (
        <BookCardPaymentsTab canDecide={can('books', 'edit')} onDecided={refreshPending} />
      ) : tab === 'inventory' ? (
        <BookInventoryTab
          canCreate={can('books', 'create')}
          canEdit={can('books', 'edit')}
          canDelete={can('books', 'delete')}
        />
      ) : tab === 'analytics' ? (
        <BookAnalyticsTab />
      ) : (
        <BookSettingsTab canEdit={can('books', 'edit')} />
      )}
    </div>
  )
}

interface TabButtonProps {
  active: boolean
  onClick: () => void
  icon: LucideIcon
  children: React.ReactNode
}

function TabButton({ active, onClick, icon: Icon, children }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('tab inline-flex items-center gap-1.5', active && 'active')}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  )
}
