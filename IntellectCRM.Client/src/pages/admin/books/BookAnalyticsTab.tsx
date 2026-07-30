import { useEffect, useMemo, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import {
  Banknote, CreditCard, Wallet, Package, BookOpen, FileDown, TrendingUp, AlertTriangle, PackagePlus,
} from 'lucide-react'
import type { BookAnalytics } from '@/api/services/books'
import { exportBookAnalytics, getBookAnalytics } from '@/api/services/books'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Loader } from '@/components/ui/Loader'
import { Input } from '@/components/ui/Input'
import { StatCard } from '@/components/ui/StatCard'
import { apiErrorMessage, cn, formatMoney } from '@/lib/utils'

/** Joriy oyning 1-kuni (default davr boshi). */
function monthStart(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
const today = () => new Date().toISOString().slice(0, 10)

/**
 * ANALITIKA: davr bo'yicha qaysi kitob qancha sotilgani, tushum (naqd/karta alohida va jami),
 * kunlik grafik, top kitoblar va ombor qoldig'i ogohlantirishi. Tushum FAQAT tasdiqlangan
 * buyurtmalardan hisoblanadi.
 */
export function BookAnalyticsTab() {
  const [from, setFrom] = useState(monthStart)
  const [to, setTo] = useState(today)
  const [data, setData] = useState<BookAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    getBookAnalytics(from, to)
      .then(setData)
      .catch((err) => setError(apiErrorMessage(err, "Hisobotni yuklab bo'lmadi")))
      .finally(() => setLoading(false))
  }, [from, to])

  const chartData = useMemo(
    () =>
      (data?.byDay ?? []).map((d) => ({
        name: d.date.slice(5), // MM-DD
        Naqd: d.cash,
        Karta: d.card,
      })),
    [data],
  )

  const quick = (days: number) => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - days + 1)
    setFrom(start.toISOString().slice(0, 10))
    setTo(end.toISOString().slice(0, 10))
  }

  return (
    <div className="space-y-4">
      {/* ---- Davr ---- */}
      <Card tight>
        <div className="flex flex-wrap items-end gap-3 p-4">
          <Input label="Sanadan" type="date" className="w-auto" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input label="Sanagacha" type="date" className="w-auto" value={to} onChange={(e) => setTo(e.target.value)} />
          <div className="tabs">
            <button type="button" className="tab" onClick={() => quick(7)}>
              7 kun
            </button>
            <button type="button" className="tab" onClick={() => quick(30)}>
              30 kun
            </button>
            <button
              type="button"
              className="tab"
              onClick={() => {
                setFrom(monthStart())
                setTo(today())
              }}
            >
              Bu oy
            </button>
            <button
              type="button"
              className="tab"
              onClick={() => {
                setFrom('')
                setTo('')
              }}
            >
              Butun davr
            </button>
          </div>
          <div className="ml-auto">
            <Button variant="secondary" onClick={() => exportBookAnalytics(from, to)}>
              <FileDown className="h-4 w-4" /> Excel
            </Button>
          </div>
        </div>
      </Card>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {loading || !data ? (
        <Card>
          <Loader label="Yuklanmoqda..." />
        </Card>
      ) : (
        <>
          {/* ---- Moliyaviy ko'rsatkichlar ---- */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Tushum — jami"
              value={`${formatMoney(data.revenueTotal)} so'm`}
              icon={Wallet}
              hint={`${data.ordersApproved} ta tasdiqlangan buyurtma`}
            />
            <StatCard
              label="Naqd"
              value={`${formatMoney(data.revenueCash)} so'm`}
              icon={Banknote}
              iconBg="bg-emerald-50"
              iconColor="text-emerald-600"
              hint={pct(data.revenueCash, data.revenueTotal)}
            />
            <StatCard
              label="Karta"
              value={`${formatMoney(data.revenueCard)} so'm`}
              icon={CreditCard}
              iconBg="bg-sky-50"
              iconColor="text-sky-600"
              hint={pct(data.revenueCard, data.revenueTotal)}
            />
            <StatCard
              label="Sotilgan kitob"
              value={`${data.soldQty} dona`}
              icon={BookOpen}
              iconBg="bg-violet-50"
              iconColor="text-violet-600"
              hint={`${data.ordersPending} kutilmoqda · ${data.ordersRejected} rad etilgan`}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard
              label="Ombordagi qoldiq"
              value={`${data.stockTotal} dona`}
              icon={Package}
              iconBg="bg-slate-100"
              iconColor="text-slate-600"
              hint="Barcha kitoblar bo'yicha (davrga bog'liq emas)"
            />
            <StatCard
              label="Davr ichida kirim"
              value={`${data.stockInQty} dona`}
              icon={PackagePlus}
              iconBg="bg-amber-50"
              iconColor="text-amber-600"
              hint="Omborga qo'shilgan kitoblar"
            />
          </div>

          {/* ---- Kunlik grafik ---- */}
          <Card title="Kunlik tushum" sub="Naqd va karta bo'yicha (tasdiqlangan buyurtmalar)">
            {chartData.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">
                Bu davrda tasdiqlangan sotuv yo'q.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f4" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: '#94a3b8' }}
                    tickFormatter={(v: number) => (v >= 1_000_000 ? `${v / 1_000_000}M` : `${v / 1000}k`)}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                    contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }}
                    formatter={(value) => formatMoney(Number(value))}
                  />
                  <Legend wrapperStyle={{ fontSize: 13 }} />
                  <Bar dataKey="Naqd" stackId="a" fill="#16a34a" maxBarSize={28} />
                  <Bar dataKey="Karta" stackId="a" fill="#0284c7" radius={[6, 6, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* ---- Kitob kesimi ---- */}
            <Card
              title="Kitoblar bo'yicha sotuv"
              sub="Qaysi kitob qancha sotildi va hozir qancha qoldi"
              tight
            >
              {data.byBook.length === 0 ? (
                <p className="p-6 text-center text-sm text-slate-400">Bu davrda sotuv yo'q.</p>
              ) : (
                <div className="max-h-[420px] overflow-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Kitob</th>
                        <th className="text-right">Sotilgan</th>
                        <th className="text-right">Tushum</th>
                        <th className="text-right">Qoldiq</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byBook.map((b, i) => (
                        <tr key={b.bookId}>
                          <td>
                            <span className="mr-1.5 font-mono text-xs text-slate-400">{i + 1}.</span>
                            <span className="text-slate-700">{b.bookTitle}</span>
                          </td>
                          <td className="text-right font-mono font-semibold text-slate-800">{b.qty}</td>
                          <td className="text-right font-mono text-slate-700">{formatMoney(b.total)}</td>
                          <td
                            className={cn(
                              'text-right font-mono',
                              b.stock === 0 ? 'text-red-600' : b.stock <= 3 ? 'text-amber-600' : 'text-slate-500',
                            )}
                          >
                            {b.stock}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* ---- Qoldiq ogohlantirishi ---- */}
            <Card
              title="Qoldiq kam qolgan kitoblar"
              sub="3 donadan kam qolgan (yoki tugagan) sotuvdagi kitoblar"
              tight
            >
              {data.lowStock.length === 0 ? (
                <div className="state">
                  <div className="state-icon">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <h4>Hammasi joyida</h4>
                  <p>Barcha sotuvdagi kitoblarning qoldig'i yetarli.</p>
                </div>
              ) : (
                <div className="max-h-[420px] overflow-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Kitob</th>
                        <th className="text-right">Qoldiq</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.lowStock.map((b) => (
                        <tr key={b.bookId}>
                          <td className="text-slate-700">{b.bookTitle}</td>
                          <td
                            className={cn(
                              'text-right font-mono font-semibold',
                              b.stock === 0 ? 'text-red-600' : 'text-amber-600',
                            )}
                          >
                            {b.stock === 0 ? 'tugagan' : b.stock}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

/** "Jami"dan ulush foizi (0 bo'lsa bo'sh). */
function pct(part: number, total: number): string {
  if (total <= 0) return ''
  return `jamining ${Math.round((part / total) * 100)}%`
}
