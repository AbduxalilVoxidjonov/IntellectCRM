import { useEffect, useState } from 'react'
import { Archive, Activity, TrendingDown, HelpCircle } from 'lucide-react'
import type { TeacherReportRow, TeacherReportDetail } from '@/types'
import { getTeacherReport, getTeacherReportDetail } from '@/api/services/teacherReports'
import { formatDate, cn } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { Badge } from '@/components/ui/Badge'
import type { BadgeTone } from '@/components/ui/Badge'
import { Loader } from '@/components/ui/Loader'
import { Modal } from '@/components/ui/Modal'

const statusMeta: Record<TeacherReportRow['status'], { label: string; tone: BadgeTone }> = {
  active: { label: 'Faol', tone: 'green' },
  low: { label: 'Sust', tone: 'amber' },
  none: { label: "Ma'lumot yo'q", tone: 'default' },
}

export function TeacherReportsPage() {
  const [rows, setRows] = useState<TeacherReportRow[]>([])
  const [loading, setLoading] = useState(true)

  const [detail, setDetail] = useState<TeacherReportDetail | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    getTeacherReport()
      .then(setRows)
      .finally(() => setLoading(false))
  }, [])

  const openDetail = (id: string) => {
    setDetailOpen(true)
    setDetail(null)
    setDetailLoading(true)
    getTeacherReportDetail(id)
      .then(setDetail)
      .finally(() => setDetailLoading(false))
  }

  const counts = {
    active: rows.filter((r) => r.status === 'active').length,
    low: rows.filter((r) => r.status === 'low').length,
    none: rows.filter((r) => r.status === 'none').length,
  }

  return (
    <div>
      <PageHeader
        title="O'qituvchilar hisoboti"
        sub="Dars o'tilishi, baho, mavzu va uy vazifa faolligi"
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Faol"
          value={counts.active}
          icon={Activity}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <StatCard
          label="Sust"
          value={counts.low}
          icon={TrendingDown}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
        />
        <StatCard
          label="Ma'lumot yo'q"
          value={counts.none}
          icon={HelpCircle}
          iconBg="bg-slate-100"
          iconColor="text-slate-500"
        />
      </div>

      <Card tight>
        {loading ? (
          <Loader label="Yuklanmoqda..." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>O'qituvchi</th>
                  <th className="num">Reja</th>
                  <th className="num">O'tdi</th>
                  <th className="num">Bajarildi</th>
                  <th className="num">Baho</th>
                  <th className="num">Mavzu</th>
                  <th className="num">Uy vaz.</th>
                  <th>Oxirgi faollik</th>
                  <th>Holat</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.teacherId}
                    onClick={() => openDetail(r.teacherId)}
                    className="cursor-pointer"
                  >
                    <td className="font-medium text-slate-800">
                      <span className="flex items-center gap-2">
                        {r.fullName}
                        {r.isArchived && (
                          <Badge tone="default">
                            <Archive className="h-3 w-3" /> arxiv
                          </Badge>
                        )}
                      </span>
                    </td>
                    <td className="num text-slate-600">{r.expected}</td>
                    <td className="num text-slate-600">{r.conducted}</td>
                    <td className="num">
                      <PctCell v={r.donePct} />
                    </td>
                    <td className="num text-slate-600">{r.grades}</td>
                    <td className="num">
                      <PctCell v={r.topicPct} />
                    </td>
                    <td className="num">
                      <PctCell v={r.homeworkPct} />
                    </td>
                    <td className="font-mono text-slate-500">
                      {r.lastActivity ? formatDate(r.lastActivity) : '—'}
                    </td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                      O'qituvchi yo'q
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        size="xl"
        title={detail ? `${detail.fullName} — hisobot` : 'Hisobot'}
      >
        {detailLoading || !detail ? (
          <Loader label="Yuklanmoqda..." />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="Reja" value={String(detail.expected)} />
              <Metric label="O'tildi" value={`${detail.conducted}`} />
              <Metric label="Bajarildi" value={detail.donePct == null ? '—' : `${detail.donePct}%`} />
              <Metric label="Baholar" value={String(detail.grades)} />
            </div>

            <div className="table-wrap rounded-xl border border-slate-100">
              <table className="table">
                <thead>
                  <tr>
                    <th>Guruh</th>
                    <th>Fan</th>
                    <th className="num">Reja</th>
                    <th className="num">O'tdi</th>
                    <th className="num">Bajarildi</th>
                    <th className="num">Baho</th>
                    <th className="num">Mavzu</th>
                    <th className="num">Uy vaz.</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.rows.map((b, i) => (
                    <tr key={i}>
                      <td className="font-medium text-slate-700">{b.className}</td>
                      <td className="text-slate-600">{b.subjectName}</td>
                      <td className="num text-slate-600">{b.expected}</td>
                      <td className="num text-slate-600">{b.conducted}</td>
                      <td className="num">
                        <PctCell v={b.donePct} />
                      </td>
                      <td className="num text-slate-600">{b.grades}</td>
                      <td className="num">
                        <PctCell v={b.topicPct} />
                      </td>
                      <td className="num">
                        <PctCell v={b.homeworkPct} />
                      </td>
                    </tr>
                  ))}
                  {detail.rows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center text-slate-400">
                        Bu davr uchun ma'lumot yo'q
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function PctCell({ v }: { v: number | null }) {
  if (v == null) return <span className="font-mono text-slate-300">—</span>
  const color = v >= 70 ? 'text-emerald-600' : v >= 40 ? 'text-amber-600' : 'text-red-600'
  return <span className={cn('font-mono font-semibold', color)}>{v}%</span>
}

function StatusBadge({ status }: { status: TeacherReportRow['status'] }) {
  const m = statusMeta[status]
  return (
    <Badge tone={m.tone} dot>
      {m.label}
    </Badge>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 font-mono text-lg font-semibold text-slate-800">{value}</p>
    </div>
  )
}
