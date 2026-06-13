import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { getStudentNotebook } from '@/api/services/studentPortal'
import { Icon, gradeColor, subjectColor, subjInitial } from '@/pages/student/lib'

/* ============================================================
   O'quvchi portali — Umumiy statistika (notebook'dan, loose).
   ============================================================ */

interface Notebook {
  avgGrade?: number
  attendancePct?: number
  attended?: number
  conducted?: number
  disciplineScore?: number
  homeworkDone?: number
  homeworkMissed?: number
  subjects?: Array<{ id: string; name: string }>
  grades?: Record<string, Record<string, number>>
}

function gradeChip(grade: number, size = 34): ReactNode {
  const col = gradeColor(grade)
  const label = grade === Math.round(grade) ? String(Math.round(grade)) : grade.toFixed(1)
  return (
    <div
      className="badge"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        background: `color-mix(in srgb,${col} 16%,var(--surface))`,
        color: col,
        fontSize: size * 0.5,
      }}
    >
      {label}
    </div>
  )
}

export function StudentStatisticsScreen() {
  const navigate = useNavigate()
  const [n, setN] = useState<Notebook | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let on = true
    getStudentNotebook()
      .then((d) => on && setN((d || {}) as Notebook))
      .catch((e) => on && setErr(e?.message || String(e)))
    return () => {
      on = false
    }
  }, [])

  const head = (
    <div className="hd">
      <div className="row gap10" style={{ minHeight: 38 }}>
        <button className="iconbtn press" onClick={() => navigate(-1)}>
          <Icon name="chevL" size={22} />
        </button>
        <div className="hd-sm" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Umumiy statistika
        </div>
      </div>
    </div>
  )

  if (err) {
    return (
      <div className="screen">
        {head}
        <div className="center">
          <Empty title="Yuklab bo'lmadi" sub={err} ic="alert" />
        </div>
      </div>
    )
  }
  if (!n) {
    return (
      <div className="screen">
        {head}
        <div className="center">
          <div className="spin" />
        </div>
      </div>
    )
  }

  const tile = (ic: string, color: string, value: string, label: string, sub?: string) => (
    <div className="card" style={{ flex: 1 }}>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 11,
          background: `color-mix(in srgb,${color} 13%,transparent)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={ic} size={18} color={color} />
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 8, color }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 700 }}>{label}</div>
      {sub && (
        <div className="faint" style={{ fontSize: 11 }}>
          {sub}
        </div>
      )}
    </div>
  )

  const hwDone = n.homeworkDone || 0
  const hwTotal = hwDone + (n.homeworkMissed || 0)
  const discScore = n.disciplineScore != null ? n.disciplineScore : 100
  const discColor = discScore >= 85 ? 'var(--green)' : discScore >= 60 ? 'var(--amber)' : 'var(--red)'
  const subjects = n.subjects || []

  return (
    <div className="screen">
      {head}
      <div className="scroll pad" style={{ paddingBottom: 24 }}>
        <div className="row gap10" style={{ marginBottom: 10 }}>
          {tile('chart', 'var(--accent)', n.avgGrade != null ? n.avgGrade.toFixed(2) : '—', "O'rtacha baho")}
          {tile(
            'checkCircle',
            'var(--green)',
            `${n.attendancePct || 0}%`,
            'Davomat',
            `${n.attended || 0}/${n.conducted || 0} dars`,
          )}
        </div>
        <div className="row gap10" style={{ marginBottom: 16 }}>
          {tile('shield', discColor, String(discScore), 'Intizom balli')}
          {tile(
            'book',
            'var(--violet)',
            hwTotal ? `${Math.round((hwDone / hwTotal) * 100)}%` : '—',
            'Uy vazifa',
            `${hwDone}/${hwTotal}`,
          )}
        </div>

        <div className="sh">
          <div className="sh-title">Fanlar bo'yicha</div>
        </div>

        {subjects.length ? (
          <div className="card" style={{ padding: 4 }}>
            {subjects.map((s, i) => {
              const months = n.grades?.[s.name] || {}
              const vals = Object.values(months).filter((v) => typeof v === 'number') as number[]
              const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
              const col = subjectColor(s.id)
              return (
                <div
                  key={s.id}
                  className="row gap12"
                  style={{ padding: 11, borderBottom: i < subjects.length - 1 ? '1px solid var(--border)' : undefined }}
                >
                  <div
                    className="subj"
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 13,
                      flex: 'none',
                      background: col + '22',
                      color: col,
                      fontSize: 16,
                    }}
                  >
                    {subjInitial(s.name)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700 }}>{s.name}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {avg > 0 ? `O'rtacha: ${avg.toFixed(2)}` : 'Baho yo‘q'}
                    </div>
                  </div>
                  {avg > 0 ? gradeChip(avg, 34) : null}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="card">
            <Empty title="Ma'lumot yo'q" ic="chart" />
          </div>
        )}
      </div>
    </div>
  )
}

function Empty({ title, sub, ic = 'sparkle' }: { title: string; sub?: string; ic?: string }) {
  return (
    <div className="empty">
      <div className="empty-ic">
        <Icon name={ic} size={30} />
      </div>
      <div style={{ fontSize: 16, fontWeight: 800 }}>{title}</div>
      {sub && (
        <div className="muted" style={{ fontSize: 13.5, marginTop: 6, lineHeight: 1.5 }}>
          {sub}
        </div>
      )}
    </div>
  )
}
