import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ClassPerformance } from '@/types'

export type Metric = 'grade' | 'attendance'

interface Props {
  data: ClassPerformance[]
  metric: Metric
}

/**
 * Guruhlar statistikasi — ustunlar GURUH bo'yicha, lekin x o'qida O'QITUVCHI nomi ko'rsatiladi
 * (bir o'qituvchining guruhlari yonma-yon). Guruh nomi faqat ustunga yaqinlashganda (hover) chiqadi.
 * Bir o'qituvchi nomi faqat bir marta (ketma-ket guruhlarining birinchisida) yoziladi — takror emas.
 */
export function ClassPerformanceChart({ data, metric }: Props) {
  const isGrade = metric === 'grade'
  const dataKey = isGrade ? 'averageGrade' : 'attendanceRate'
  const color = isGrade ? '#1f47f5' : '#16a34a'
  const domain: [number, number] = isGrade ? [0, 5] : [0, 100]
  const unit = isGrade ? '' : '%'
  const label = isGrade ? "O'rtacha baho" : 'Davomat'

  // Har bir ustun uchun: o'qituvchi nomi avvalgisidan farq qilsagina ko'rsatiladi (guruhlash effekti).
  const teacherAt = data.map((d) => d.teacherName || '—')
  const showTeacherAt = (i: number) => i === 0 || teacherAt[i] !== teacherAt[i - 1]

  // Indeks bo'yicha xususiy x-tick — o'qituvchi nomini faqat guruh boshida chiqaradi.
  // (recharts tick render-prop tipi keng — `any` qabul qilamiz va son qiymatlarni majburlaymiz.)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderTick = (props: any) => {
    const x = Number(props?.x) || 0
    const y = Number(props?.y) || 0
    const index = Number(props?.index) || 0
    if (!showTeacherAt(index)) return <g />
    return (
      <text x={x} y={y + 14} textAnchor="middle" fontSize={12} fill="#94a3b8">
        {teacherAt[index]}
      </text>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f4" />
        <XAxis
          dataKey="classId"
          tickLine={false}
          axisLine={false}
          interval={0}
          tick={renderTick}
        />
        <YAxis
          domain={domain}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12, fill: '#94a3b8' }}
        />
        <Tooltip
          cursor={{ fill: 'rgba(0,0,0,0.03)' }}
          contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }}
          // Hoverda guruh nomi (+ o'qituvchi) chiqadi.
          labelFormatter={(_, payload) => {
            const p = payload?.[0]?.payload as ClassPerformance | undefined
            if (!p) return ''
            return p.teacherName ? `${p.className} · ${p.teacherName}` : p.className
          }}
          formatter={(value) => [`${value}${unit}`, label]}
        />
        <Bar dataKey={dataKey} fill={color} radius={[6, 6, 0, 0]} maxBarSize={42} />
      </BarChart>
    </ResponsiveContainer>
  )
}
