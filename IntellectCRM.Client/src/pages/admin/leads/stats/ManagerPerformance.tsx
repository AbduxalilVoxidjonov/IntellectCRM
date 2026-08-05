import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { LeadManagerRow } from '@/api/services/leads'
import { Card } from '@/components/ui/Card'
import { axisTick, barCursor, CATEGORICAL, gridStroke } from './palette'

/**
 * MENEJERLAR KESIMI — vertikal bar (ustun).
 *
 * NEGA vertikal bar: menejerlar nominal ro'yxat va taqqoslash "kim ko'proq" savoliga
 * javob beradi — ustunlar bitta bazadan o'sadi va yonma-yon aniq o'qiladi.
 * Ikkala seriya ham BIR XIL o'lchov birligida (lid soni), shuning uchun ular BITTA
 * o'qda turadi — ikki y-o'q (dual axis) ishlatilmaydi.
 *
 * `moves` (harakatlar soni) grafikka QO'SHILMAYDI: u boshqa o'lchov birligi va
 * masshtabi — u tooltip'da va pastdagi jadvalda beriladi.
 *
 * RANG: kategorial palitraning 1- va 2-sloti; menejerlar EMAS, SERIYALAR ranglanadi
 * (aks holda rang bar uzunligi allaqachon ko'rsatgan narsani takrorlagan bo'lardi).
 */

const CHART_LIMIT = 10

interface ChartRow {
  userId: string
  name: string
  short: string
  moves: number
  Lidlar: number
  Aylantirilgan: number
}

interface TooltipProps {
  active?: boolean
  payload?: readonly { payload?: unknown }[]
}

function ManagerTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null
  const r = payload[0]?.payload as ChartRow | undefined
  if (!r) return null
  const rate = r.Lidlar > 0 ? (r.Aylantirilgan / r.Lidlar) * 100 : null
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] shadow-[var(--shadow-1)]">
      <p className="font-semibold text-slate-800">{r.name}</p>
      <p className="mt-1 text-slate-700">
        <span className="font-mono font-semibold">{r.Lidlar.toLocaleString()}</span> ta lid
      </p>
      <p className="text-slate-700">
        <span className="font-mono font-semibold">{r.Aylantirilgan.toLocaleString()}</span> ta
        aylantirilgan
        {rate != null && <span className="text-slate-400"> · {rate.toFixed(1)}%</span>}
      </p>
      <p className="mt-0.5 text-slate-400">{r.moves.toLocaleString()} ta harakat</p>
    </div>
  )
}

/** Uzun ism ustun tagiga sig'masin — grafikda qisqartiriladi, to'lig'i tooltip va jadvalda. */
function shortName(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 12)
  return `${parts[0]} ${parts[1].slice(0, 1)}.`
}

export function ManagerPerformance({ managers }: { managers: LeadManagerRow[] }) {
  const sorted = [...managers].sort((a, b) => b.leads - a.leads)
  const chartRows: ChartRow[] = sorted.slice(0, CHART_LIMIT).map((m) => ({
    userId: m.userId,
    name: m.name,
    short: shortName(m.name),
    moves: m.moves,
    Lidlar: m.leads,
    Aylantirilgan: m.won,
  }))

  return (
    <Card>
      <div className="mb-4">
        <h2 className="font-semibold text-slate-800">Menejerlar kesimi</h2>
        <p className="mt-0.5 text-xs text-slate-400">
          Menejer bo'yicha lidlar va aylantirilganlar; harakatlar soni jadvalda
        </p>
      </div>

      {sorted.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-slate-500">Menejerlar bo'yicha ma'lumot yo'q</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-400">
            Bu xato emas: tanlangan davrda lidlar bo'yicha xodim harakati qayd etilmagan
            (yoki lidlar hech kimga biriktirilmagan). Davrni kengaytirib ko'ring.
          </p>
        </div>
      ) : (
        <>
          {/*
            Legend — ikki seriya bo'lgani uchun MAJBURIY. Recharts `Legend` o'rniga oddiy
            HTML: tartibi ustunlar tartibiga aynan mos bo'lishi kafolatlansin (Recharts v3
            da legend tartibini boshqarib bo'lmaydi). Matn — matn rangida, identity esa
            yonidagi rangli kvadratdan o'qiladi.
          */}
          <ul className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px]">
            {[
              { label: 'Lidlar', color: CATEGORICAL[0] },
              { label: 'Aylantirilgan', color: CATEGORICAL[1] },
            ].map((s) => (
              <li key={s.label} className="flex items-center gap-2 text-slate-600">
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: s.color }}
                  aria-hidden
                />
                {s.label}
              </li>
            ))}
          </ul>

          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={chartRows}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              /* Juftlikdagi ustunlar orasida 2px fon bo'shlig'i — ramka bilan emas,
                 bo'shliq bilan ajratiladi. */
              barGap={2}
              barCategoryGap="35%"
            >
              <CartesianGrid vertical={false} stroke={gridStroke} />
              <XAxis dataKey="short" tickLine={false} axisLine={false} tick={axisTick} interval={0} />
              <YAxis tickLine={false} axisLine={false} tick={axisTick} allowDecimals={false} />
              <Tooltip cursor={barCursor} content={ManagerTooltip} />
              {/* "O'sib chiqish" animatsiyasi yo'q — dashboardda raqam darrov ko'rinsin. */}
              <Bar
                dataKey="Lidlar"
                fill={CATEGORICAL[0]}
                radius={[4, 4, 0, 0]}
                maxBarSize={24}
                isAnimationActive={false}
              />
              <Bar
                dataKey="Aylantirilgan"
                fill={CATEGORICAL[1]}
                radius={[4, 4, 0, 0]}
                maxBarSize={24}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>

          {sorted.length > chartRows.length && (
            <p className="mt-1 text-xs text-slate-400">
              Diagrammada eng faol {chartRows.length} ta menejer — qolgani jadvalda.
            </p>
          )}

          {/* Jadval — grafikning "table view" juftligi: har bir qiymat hover'siz ham o'qiladi. */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="py-2 pr-3 font-medium">Menejer</th>
                  <th className="py-2 pr-3 text-right font-medium">Harakatlar</th>
                  <th className="py-2 pr-3 text-right font-medium">Lidlar</th>
                  <th className="py-2 pr-3 text-right font-medium">Aylantirilgan</th>
                  <th className="py-2 text-right font-medium">Konversiya</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((m) => (
                  <tr key={m.userId} className="border-b border-slate-50 last:border-0">
                    <td className="py-2 pr-3 text-slate-700">{m.name}</td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums text-slate-500">
                      {m.moves.toLocaleString()}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums text-slate-700">
                      {m.leads.toLocaleString()}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums text-emerald-600">
                      {m.won.toLocaleString()}
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums text-slate-500">
                      {m.leads > 0 ? `${((m.won / m.leads) * 100).toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  )
}
